-- =============================================================================
-- Migration : table intake_conversations
-- Stocke l'historique multi-turn des échanges entre le client et l'agent IA.
-- Chaque ligne représente une session de conversation active pour un contact.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE intake_conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_conversations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Numéro de téléphone du client (clé de lookup rapide, pas de FK obligatoire
  -- car le contact peut ne pas encore exister au premier message)
  phone        text        NOT NULL,

  -- FK optionnelle vers clients une fois le contact identifié
  contact_id   uuid        REFERENCES public.clients(id) ON DELETE SET NULL,

  -- FK optionnelle vers le ticket créé en fin de conversation
  ticket_id    uuid        REFERENCES public.tickets(id) ON DELETE SET NULL,

  -- Tableau de messages au format [{ role: "user"|"assistant", content: "..." }]
  -- Compatible avec le format attendu par l'API Anthropic Claude
  messages     jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Données de ticket accumulées au fil des échanges (merge progressif)
  -- Ex : { device_type: "smartphone", device_brand: "Apple", ... }
  partial_data jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Nombre de tours effectués (pour détecter les conversations bloquées)
  turn_count   integer     NOT NULL DEFAULT 0,

  -- Statut de la conversation
  -- open      : en attente d'informations supplémentaires
  -- completed : ticket créé avec succès
  -- closed    : abandonnée ou hors périmètre
  status       text        NOT NULL DEFAULT 'open'
    CONSTRAINT intake_conversations_status_check
    CHECK (status IN ('open', 'completed', 'closed')),

  -- Dernière action retournée par Claude
  last_action  text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index pour retrouver rapidement la session ouverte d'un numéro
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_conversations_phone_open
  ON public.intake_conversations (phone)
  WHERE status = 'open';

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION fn_intake_conversations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_intake_conversations_updated_at
  BEFORE UPDATE ON public.intake_conversations
  FOR EACH ROW EXECUTE FUNCTION fn_intake_conversations_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : seul le service_role peut lire/écrire (appelé exclusivement par n8n)
-- Les conversations contiennent des données personnelles — jamais exposées au client
-- ---------------------------------------------------------------------------
ALTER TABLE public.intake_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role uniquement"
  ON public.intake_conversations FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- RPC fn_get_or_create_conversation
-- Récupère la conversation ouverte d'un numéro ou en crée une nouvelle.
-- Appelée par n8n en début de workflow pour charger l'historique.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_or_create_conversation(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row intake_conversations;
BEGIN
  -- Tente de récupérer une conversation ouverte existante
  SELECT * INTO v_row
  FROM public.intake_conversations
  WHERE phone = p_phone AND status = 'open'
  LIMIT 1;

  IF v_row.id IS NULL THEN
    -- Crée une nouvelle session
    INSERT INTO public.intake_conversations (phone)
    VALUES (p_phone)
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id',           v_row.id,
    'phone',        v_row.phone,
    'contact_id',   v_row.contact_id,
    'messages',     v_row.messages,
    'partial_data', v_row.partial_data,
    'turn_count',   v_row.turn_count,
    'status',       v_row.status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC fn_update_conversation
-- Sauvegarde l'état de la conversation après chaque échange.
-- Appelée par n8n après avoir obtenu la réponse de Claude.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_conversation(
  p_id          uuid,
  p_messages    jsonb,
  p_partial     jsonb,
  p_turn_count  integer,
  p_status      text,
  p_last_action text,
  p_ticket_id   uuid DEFAULT NULL,
  p_contact_id  uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.intake_conversations
  SET
    messages     = p_messages,
    partial_data = p_partial,
    turn_count   = p_turn_count,
    status       = p_status,
    last_action  = p_last_action,
    ticket_id    = COALESCE(p_ticket_id,  ticket_id),
    contact_id   = COALESCE(p_contact_id, contact_id)
  WHERE id = p_id;
END;
$$;

-- Accès réservé au service_role (n8n)
REVOKE ALL ON FUNCTION public.fn_get_or_create_conversation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_update_conversation(uuid, jsonb, jsonb, integer, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_get_or_create_conversation(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_update_conversation(uuid, jsonb, jsonb, integer, text, text, uuid, uuid) TO service_role;
