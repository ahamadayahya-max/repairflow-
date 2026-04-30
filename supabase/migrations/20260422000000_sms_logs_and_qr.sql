-- ---------------------------------------------------------------------------
-- Migration : champs QualiRépar + table sms_logs + index clients
-- Appliquée directement via Supabase MCP le 2026-04-23
-- ---------------------------------------------------------------------------

-- 1. Colonnes QualiRépar sur tickets
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS qr_eligible   boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_montant    numeric(10,2),
  ADD COLUMN IF NOT EXISTS qr_eco_org    text;

-- 2. Table sms_logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid        REFERENCES tickets(id) ON DELETE SET NULL,
  shop_id    uuid        REFERENCES shops(id)   ON DELETE SET NULL,
  phone      text        NOT NULL,
  template   text        NOT NULL,
  message    text,
  twilio_sid text,
  status     text        DEFAULT 'sent',
  sent_at    timestamptz DEFAULT now()
);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_logs_read" ON sms_logs
  FOR SELECT TO authenticated
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "sms_logs_service" ON sms_logs
  FOR ALL TO service_role USING (true);

-- 3. Index recherche full-text sur clients
CREATE INDEX IF NOT EXISTS idx_clients_search
  ON clients USING gin(
    to_tsvector('french',
      COALESCE(first_name, '') || ' ' ||
      COALESCE(last_name,  '') || ' ' ||
      COALESCE(phone,      '')
    )
  );
