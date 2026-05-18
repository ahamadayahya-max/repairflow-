-- =============================================================================
-- Migration : table shops + liaison tickets → shops
-- Chaque atelier inscrit sur TickeeFlow a sa propre ligne dans cette table.
-- Les tickets sont rattachés à un atelier via shop_id.
-- La RPC get_ticket_by_token retourne les infos de l'atelier avec le ticket.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE : shops
-- Créée et remplie lors de l'onboarding de chaque atelier.
-- owner_id correspond à l'utilisateur Supabase Auth (email + mot de passe).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shops (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name        text NOT NULL,
  phone       text,
  email       text,
  address     text,
  hours       text,        -- ex : "Lun–Sam 9h–18h, fermé dimanche"
  logo_url    text,        -- URL publique Supabase Storage
  slug        text UNIQUE, -- identifiant URL-friendly (optionnel)

  -- Informations de facturation / plan SaaS (extensible)
  plan        text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION fn_shops_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION fn_shops_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : shops
-- Un atelier ne voit et ne modifie que sa propre ligne.
-- ---------------------------------------------------------------------------
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Propriétaire uniquement — lecture"
  ON public.shops FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Propriétaire uniquement — modification"
  ON public.shops FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- La création d'un shop se fait via service_role à l'onboarding
CREATE POLICY "Service role — toutes opérations"
  ON public.shops FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- COLONNE shop_id sur tickets
-- Rattache chaque ticket à l'atelier qui l'a créé.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_shop_id ON public.tickets (shop_id);

-- ---------------------------------------------------------------------------
-- RPC : get_ticket_by_token (mise à jour)
-- Retourne les données du ticket ET les infos publiques de l'atelier.
-- Utilisée par la page de suivi client — pas d'authentification requise.
-- SECURITY DEFINER pour bypasser le RLS sur tickets et shops.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ticket_by_token(token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    -- Données du ticket
    'id',                   t.id,
    'tracking_token',       t.tracking_token,
    'status',               t.status,
    'device_type',          t.device_type,
    'device_brand',         t.device_brand,
    'device_model',         t.device_model,
    'issue_description',    t.issue_description,
    'received_at',          t.received_at,
    'estimated_ready_at',   t.estimated_ready_at,
    'intake_channel',       t.intake_channel,
    -- Infos publiques de l'atelier (jamais de données sensibles)
    'shop', jsonb_build_object(
      'name',     s.name,
      'phone',    s.phone,
      'address',  s.address,
      'hours',    s.hours,
      'logo_url', s.logo_url
    )
  )
  INTO v_result
  FROM public.tickets t
  LEFT JOIN public.shops s ON s.id = t.shop_id
  WHERE t.tracking_token = token
  LIMIT 1;

  -- Retourne null si le token n'existe pas
  RETURN v_result;
END;
$$;

-- Accessible sans authentification (page de suivi publique)
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Mise à jour de fn_intake_create_ticket pour renseigner shop_id
-- (si la migration intake_conversations a déjà été appliquée)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_intake_create_ticket(
  p_phone               text,
  p_device_type         text,
  p_device_brand        text,
  p_device_model        text DEFAULT NULL,
  p_issue_description   text DEFAULT NULL,
  p_customer_name       text DEFAULT NULL,
  p_shop_id             uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id     uuid;
  v_ticket_id      uuid;
  v_tracking_token text;
  v_first_name     text;
  v_last_name      text;
BEGIN
  IF p_customer_name IS NOT NULL AND p_customer_name <> '' THEN
    v_first_name := split_part(trim(p_customer_name), ' ', 1);
    v_last_name  := CASE
      WHEN array_length(string_to_array(trim(p_customer_name), ' '), 1) > 1
      THEN trim(substring(p_customer_name FROM length(v_first_name) + 2))
      ELSE NULL
    END;
  END IF;

  SELECT id INTO v_contact_id
    FROM public.contacts
   WHERE phone = p_phone
   LIMIT 1;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts (phone, first_name, last_name)
    VALUES (p_phone, v_first_name, v_last_name)
    RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.contacts
       SET first_name = COALESCE(first_name, v_first_name),
           last_name  = COALESCE(last_name, v_last_name)
     WHERE id = v_contact_id
       AND (first_name IS NULL OR last_name IS NULL);
  END IF;

  INSERT INTO public.tickets (
    contact_id,
    shop_id,
    device_type,
    device_brand,
    device_model,
    issue_description,
    status,
    intake_channel
  )
  VALUES (
    v_contact_id,
    p_shop_id,
    p_device_type,
    p_device_brand,
    p_device_model,
    p_issue_description,
    'pending',
    'sms_intake'
  )
  RETURNING id, tracking_token INTO v_ticket_id, v_tracking_token;

  RETURN jsonb_build_object(
    'success',        true,
    'ticket_id',      v_ticket_id,
    'tracking_token', v_tracking_token,
    'contact_id',     v_contact_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_intake_create_ticket FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_intake_create_ticket TO service_role;
