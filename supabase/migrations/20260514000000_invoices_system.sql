-- ============================================================
-- SYSTÈME DE FACTURATION — TickeeFlow
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id           uuid        REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  ticket_id         uuid        REFERENCES tickets(id) ON DELETE SET NULL,
  invoice_number    text        NOT NULL,
  client_name       text        NOT NULL,
  client_email      text,
  client_phone      text,
  client_address    text,
  status            text        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','sent','paid','cancelled')),
  subtotal_ht       numeric(10,2) NOT NULL DEFAULT 0,
  tva_rate          numeric(5,2)  NOT NULL DEFAULT 20,
  tva_amount        numeric(10,2) NOT NULL DEFAULT 0,
  total_ttc         numeric(10,2) NOT NULL DEFAULT 0,
  qualirepar_bonus  numeric(10,2) NOT NULL DEFAULT 0,
  total_net         numeric(10,2) NOT NULL DEFAULT 0,
  notes             text,
  issued_at         timestamptz DEFAULT now(),
  due_at            timestamptz,
  paid_at           timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id      uuid          REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description     text          NOT NULL,
  qty             integer       NOT NULL DEFAULT 1,
  unit_price_ht   numeric(10,2) NOT NULL DEFAULT 0,
  tva_rate        numeric(5,2)  NOT NULL DEFAULT 20,
  created_at      timestamptz   DEFAULT now()
);

ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_shop_isolation" ON invoices
  FOR ALL USING (shop_id = (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "invoice_lines_shop_isolation" ON invoice_lines
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE shop_id = (SELECT id FROM shops WHERE owner_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION next_invoice_number(p_shop_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_count integer; v_year text;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COUNT(*) INTO v_count FROM invoices
  WHERE shop_id = p_shop_id AND to_char(created_at, 'YYYY') = v_year;
  RETURN 'FAC-' || v_year || '-' || LPAD((v_count + 1)::text, 4, '0');
END;$$;
