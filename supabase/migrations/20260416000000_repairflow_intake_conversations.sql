-- =============================================================================
-- Migration : table intake_conversations + RPC fn_intake_create_ticket
-- Gère le stockage multi-tours des conversations d'intake IA (SMS/WhatsApp)
-- et la création atomique contact + ticket depuis n8n.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE : intake_conversations
-- Stocke l'historique de chaque session de conversation d'intake.
-- Une session est liée à un numéro de téléphone et reste "open" tant que
-- l'agent n'a pas collecté toutes les informations ou ne s'est pas escaladé.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_conversations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone               text NOT NULL,

  -- Tableau de messages au format { role: 'user'|'assistant', content: text }
  -- Compatible avec le format attendu par l'API Claude (messages array)
  messages            jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Données de ticket accumulées au fil des tours (merge progressif)
  partial_ticket_data jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Nombre de tours effectués (user + assistant = 2 par échange)
  turn_count          integer NOT NULL DEFAULT 0,

  -- Statut de la session
  -- open       : en cours, l'agent attend plus d'informations
  -- completed  : ticket créé avec succès
  -- closed     : escalade ou hors-sujet, aucun ticket créé
  status              text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'closed')),

  -- Dernière action retournée par Claude
  last_action         text,

  -- Ticket créé en cas de succès (NULL sinon)
  ticket_id           uuid REFERENCES public.tickets(id) ON DELETE SET NULL,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Index pour retrouver rapidement la session ouverte d'un numéro
CREATE INDEX IF NOT EXISTS idx_intake_conversations_phone_open
  ON public.intake_conversations (phone, status)
  WHERE status = 'open';

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION fn_intake_conversations_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_intake_conversations_updated_at
  BEFORE UPDATE ON public.intake_conversations
  FOR EACH ROW EXECUTE FUNCTION fn_intake_conversations_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : intake_conversations
-- Seuls les services authentifiés avec la service_role peuvent lire/écrire.
-- Aucun accès public — les conversations contiennent des données personnelles.
-- ---------------------------------------------------------------------------
ALTER TABLE public.intake_conversations ENABLE ROW LEVEL SECURITY;

-- Politique réservée au service role (n8n, Edge Functions)
-- Le service_role bypasse le RLS par défaut dans Supabase — cette politique
-- est définie explicitement pour la lisibilité et la documentation.
CREATE POLICY "Service role uniquement"
  ON public.intake_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- RPC : fn_intake_create_ticket
-- Crée atomiquement un contact (ou le retrouve) et un ticket de réparation
-- à partir des données extraites par l'agent IA.
-- Appelée par n8n après que Claude a retourné action="create_ticket".
-- Retourne le ticket_id et le tracking_token pour le SMS de confirmation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_intake_create_ticket(
  p_phone               text,
  p_device_type         text,
  p_device_brand        text,
  p_device_model        text DEFAULT NULL,
  p_issue_description   text DEFAULT NULL,
  p_customer_name       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id    uuid;
  v_ticket_id     uuid;
  v_tracking_token text;
  v_first_name    text;
  v_last_name     text;
BEGIN
  -- Décompose le nom en prénom / nom si possible
  IF p_customer_name IS NOT NULL AND p_customer_name <> '' THEN
    v_first_name := split_part(trim(p_customer_name), ' ', 1);
    v_last_name  := CASE
      WHEN array_length(string_to_array(trim(p_customer_name), ' '), 1) > 1
      THEN trim(substring(p_customer_name FROM length(v_first_name) + 2))
      ELSE NULL
    END;
  END IF;

  -- Retrouve ou crée le contact par numéro de téléphone
  SELECT id INTO v_contact_id
    FROM public.contacts
   WHERE phone = p_phone
   LIMIT 1;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts (phone, first_name, last_name)
    VALUES (p_phone, v_first_name, v_last_name)
    RETURNING id INTO v_contact_id;
  ELSE
    -- Met à jour le nom si on l'a maintenant et qu'il manquait
    UPDATE public.contacts
       SET first_name = COALESCE(first_name, v_first_name),
           last_name  = COALESCE(last_name, v_last_name)
     WHERE id = v_contact_id
       AND (first_name IS NULL OR last_name IS NULL);
  END IF;

  -- Crée le ticket (le tracking_token est généré par le trigger BEFORE INSERT)
  INSERT INTO public.tickets (
    contact_id,
    device_type,
    device_brand,
    device_model,
    issue_description,
    status,
    intake_channel
  )
  VALUES (
    v_contact_id,
    p_device_type,
    p_device_brand,
    p_device_model,
    p_issue_description,
    'pending',
    'sms_intake'        -- canal d'origine pour statistiques
  )
  RETURNING id, tracking_token INTO v_ticket_id, v_tracking_token;

  RETURN jsonb_build_object(
    'success',          true,
    'ticket_id',        v_ticket_id,
    'tracking_token',   v_tracking_token,
    'contact_id',       v_contact_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM
  );
END;
$$;

-- Seul le service_role peut appeler cette fonction
REVOKE ALL ON FUNCTION public.fn_intake_create_ticket FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_intake_create_ticket TO service_role;

-- ---------------------------------------------------------------------------
-- Colonne intake_channel sur tickets (si absente)
-- Permet de distinguer les tickets créés via intake IA de ceux créés manuellement.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS intake_channel text DEFAULT 'manual'
    CHECK (intake_channel IN ('manual', 'sms_intake', 'whatsapp_intake', 'web_form'));
