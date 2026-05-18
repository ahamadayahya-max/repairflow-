-- ============================================================
-- Module Facturation & Devis — TickeeFlow
-- ============================================================

-- Table devis
CREATE TABLE IF NOT EXISTS quotes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES clients(id) ON DELETE SET NULL,
  ticket_id         uuid REFERENCES tickets(id) ON DELETE SET NULL,
  quote_number      text UNIQUE NOT NULL,
  status            text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','accepted','refused','expired','converted')),
  valid_until       date,
  labour_cost       numeric(10,2) DEFAULT 0,
  parts_cost        numeric(10,2) DEFAULT 0,
  discount_amount   numeric(10,2) DEFAULT 0,
  tax_rate          numeric(5,2)  DEFAULT 20.00,
  total_ht          numeric(10,2) GENERATED ALWAYS AS (
    ROUND(labour_cost + parts_cost - discount_amount, 2)
  ) STORED,
  total_ttc         numeric(10,2) GENERATED ALWAYS AS (
    ROUND((labour_cost + parts_cost - discount_amount) * (1 + tax_rate/100), 2)
  ) STORED,
  notes             text,
  internal_notes    text,
  converted_at      timestamptz,
  sent_at           timestamptz,
  accepted_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Lignes du devis
CREATE TABLE IF NOT EXISTS quote_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description   text NOT NULL,
  quantity      numeric(10,2) DEFAULT 1,
  unit_price    numeric(10,2) NOT NULL,
  line_type     text DEFAULT 'labour'
    CHECK (line_type IN ('labour','part','other')),
  part_id       uuid REFERENCES parts_inventory(id) ON DELETE SET NULL,
  sort_order    int DEFAULT 0
);

-- Table factures
CREATE TABLE IF NOT EXISTS invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES clients(id) ON DELETE SET NULL,
  ticket_id         uuid REFERENCES tickets(id) ON DELETE SET NULL,
  quote_id          uuid REFERENCES quotes(id) ON DELETE SET NULL,
  invoice_number    text UNIQUE NOT NULL,
  status            text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','paid','partial','overdue','cancelled')),
  issue_date        date NOT NULL DEFAULT CURRENT_DATE,
  due_date          date,
  labour_cost       numeric(10,2) DEFAULT 0,
  parts_cost        numeric(10,2) DEFAULT 0,
  discount_amount   numeric(10,2) DEFAULT 0,
  qr_deduction      numeric(10,2) DEFAULT 0,
  tax_rate          numeric(5,2)  DEFAULT 20.00,
  total_ht          numeric(10,2) GENERATED ALWAYS AS (
    ROUND(labour_cost + parts_cost - discount_amount, 2)
  ) STORED,
  total_ttc         numeric(10,2) GENERATED ALWAYS AS (
    ROUND((labour_cost + parts_cost - discount_amount) * (1 + tax_rate/100), 2)
  ) STORED,
  total_net         numeric(10,2) GENERATED ALWAYS AS (
    ROUND((labour_cost + parts_cost - discount_amount) * (1 + tax_rate/100) - qr_deduction, 2)
  ) STORED,
  amount_paid       numeric(10,2) DEFAULT 0,
  payment_method    text CHECK (payment_method IN ('cash','card','transfer','check','other')),
  payment_date      timestamptz,
  notes             text,
  pdf_url           text,
  sent_at           timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Lignes de facture
CREATE TABLE IF NOT EXISTS invoice_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description   text NOT NULL,
  quantity      numeric(10,2) DEFAULT 1,
  unit_price    numeric(10,2) NOT NULL,
  line_type     text DEFAULT 'labour'
    CHECK (line_type IN ('labour','part','other','qualirepar')),
  part_id       uuid REFERENCES parts_inventory(id) ON DELETE SET NULL,
  sort_order    int DEFAULT 0
);

-- Paiements (suivi partiel)
CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  shop_id         uuid NOT NULL REFERENCES shops(id),
  amount          numeric(10,2) NOT NULL,
  method          text NOT NULL CHECK (method IN ('cash','card','transfer','check','other')),
  paid_at         timestamptz DEFAULT now(),
  reference       text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- Séquences de numérotation par atelier
CREATE TABLE IF NOT EXISTS invoice_sequences (
  shop_id         uuid PRIMARY KEY REFERENCES shops(id),
  quote_prefix    text DEFAULT 'DEV',
  invoice_prefix  text DEFAULT 'FAC',
  quote_counter   int DEFAULT 0,
  invoice_counter int DEFAULT 0,
  year_reset      boolean DEFAULT true
);

-- Initialise la séquence pour tous les shops existants
INSERT INTO invoice_sequences (shop_id)
SELECT id FROM shops
ON CONFLICT DO NOTHING;

-- Fonction de génération de numéro
CREATE OR REPLACE FUNCTION next_document_number(
  p_shop_id uuid,
  p_type text  -- 'quote' ou 'invoice'
)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_seq invoice_sequences%ROWTYPE;
  v_num text;
  v_year text := to_char(now(), 'YYYY');
BEGIN
  INSERT INTO invoice_sequences (shop_id)
  VALUES (p_shop_id)
  ON CONFLICT DO NOTHING;

  UPDATE invoice_sequences SET
    quote_counter   = CASE WHEN p_type = 'quote'   THEN quote_counter + 1   ELSE quote_counter END,
    invoice_counter = CASE WHEN p_type = 'invoice' THEN invoice_counter + 1 ELSE invoice_counter END
  WHERE shop_id = p_shop_id
  RETURNING * INTO v_seq;

  IF p_type = 'quote' THEN
    v_num := v_seq.quote_prefix || '-' || v_year || '-' || LPAD(v_seq.quote_counter::text, 4, '0');
  ELSE
    v_num := v_seq.invoice_prefix || '-' || v_year || '-' || LPAD(v_seq.invoice_counter::text, 4, '0');
  END IF;
  RETURN v_num;
END;
$$;
GRANT EXECUTE ON FUNCTION next_document_number(uuid, text) TO authenticated;

-- RPC stats comptabilité
CREATE OR REPLACE FUNCTION get_accounting_stats(p_month int DEFAULT NULL, p_year int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shop_id uuid;
  v_year int := COALESCE(p_year, EXTRACT(year FROM now())::int);
BEGIN
  SELECT id INTO v_shop_id FROM shops WHERE owner_id = auth.uid() LIMIT 1;
  RETURN (
    SELECT jsonb_build_object(
      'total_facture_ttc',  COALESCE(SUM(total_ttc), 0),
      'total_encaisse',     COALESCE(SUM(amount_paid), 0),
      'total_en_attente',   COALESCE(SUM(GREATEST(total_net - amount_paid, 0)) FILTER (WHERE status NOT IN ('cancelled','paid')), 0),
      'nb_factures',        COUNT(*),
      'nb_payees',          COUNT(*) FILTER (WHERE status = 'paid'),
      'nb_en_retard',       COUNT(*) FILTER (WHERE status = 'overdue'),
      'ca_ht',              COALESCE(SUM(total_ht), 0),
      'tva_collectee',      COALESCE(SUM(total_ttc - total_ht), 0)
    )
    FROM invoices
    WHERE shop_id = v_shop_id
      AND EXTRACT(year FROM issue_date) = v_year
      AND (p_month IS NULL OR EXTRACT(month FROM issue_date) = p_month)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_accounting_stats(int, int) TO authenticated;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER quotes_updated_at   BEFORE UPDATE ON quotes   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS
ALTER TABLE quotes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY quotes_shop   ON quotes         FOR ALL TO authenticated USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY qlines_shop   ON quote_lines    FOR ALL TO authenticated USING (quote_id IN (SELECT id FROM quotes WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY invoices_shop ON invoices       FOR ALL TO authenticated USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ilines_shop   ON invoice_lines  FOR ALL TO authenticated USING (invoice_id IN (SELECT id FROM invoices WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY payments_shop ON payments       FOR ALL TO authenticated USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY seq_shop      ON invoice_sequences FOR ALL TO authenticated USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
