-- =============================================================================
-- 20260416000003_tickeeflow_corrective_migration.sql
-- Correction des incohérences entre les migrations initiales.
-- Doit tourner APRÈS 20260416000001 (shops) — d'où le timestamp 20260416000003.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────
-- 1. contacts : name → first_name + last_name
-- ─────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;

-- Migre les données existantes (premier mot = prénom, reste = nom)
UPDATE contacts
SET
  first_name = split_part(trim(name), ' ', 1),
  last_name  = CASE
    WHEN array_length(string_to_array(trim(name), ' '), 1) > 1
    THEN trim(substring(name FROM length(split_part(trim(name), ' ', 1)) + 2))
    ELSE ''
  END
WHERE name IS NOT NULL AND first_name IS NULL;

ALTER TABLE contacts DROP COLUMN IF EXISTS name;

-- ─────────────────────────────────────────────
-- 2. contacts : ajout de shop_id si manquant
-- ─────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS shop_id uuid
    REFERENCES shops(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contacts_shop_id ON contacts (shop_id);

-- ─────────────────────────────────────────────
-- 3. parts_inventory : ajout de shop_id si manquant
-- ─────────────────────────────────────────────
ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS shop_id uuid
    REFERENCES shops(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_parts_inventory_shop_id ON parts_inventory (shop_id);

-- ─────────────────────────────────────────────
-- 4. repair_tickets : ajout de shop_id si manquant
--    (la migration 20260416000001 ciblait la mauvaise table "tickets")
-- ─────────────────────────────────────────────
ALTER TABLE repair_tickets
  ADD COLUMN IF NOT EXISTS shop_id uuid
    REFERENCES shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_repair_tickets_shop_id ON repair_tickets (shop_id);

-- ─────────────────────────────────────────────
-- 5. RPC upsert_contact — signature avec first_name / last_name
-- ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS upsert_contact(text, text, text);

CREATE OR REPLACE FUNCTION upsert_contact(
  p_first_name text,
  p_last_name  text,
  p_phone      text,
  p_email      text DEFAULT NULL
)
RETURNS contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_contact contacts;
BEGIN
  SELECT id INTO v_shop_id FROM shops WHERE owner_id = auth.uid() LIMIT 1;

  INSERT INTO contacts (shop_id, first_name, last_name, phone, email)
  VALUES (v_shop_id, p_first_name, p_last_name, p_phone, p_email)
  ON CONFLICT (phone) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name,
        email      = COALESCE(EXCLUDED.email, contacts.email)
  RETURNING * INTO v_contact;

  RETURN v_contact;
END;
$$;

REVOKE ALL ON FUNCTION upsert_contact(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_contact(text, text, text, text) TO authenticated;

-- ─────────────────────────────────────────────
-- 6. RPC get_ticket_by_token
--    Correction : repair_tickets (pas tickets) + paramètre "token" (pas "p_token")
--    car server.js appelle rpc('get_ticket_by_token', { token }) → PostgREST
--    cherche un paramètre nommé exactement "token"
-- ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_ticket_by_token(text);

CREATE OR REPLACE FUNCTION get_ticket_by_token(token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    -- Champs publics du ticket uniquement (pas internal_notes, price_*)
    'id',                 rt.id,
    'tracking_token',     rt.tracking_token,
    'status',             rt.status,
    'device_type',        rt.device_type,
    'device_brand',       rt.device_brand,
    'device_model',       rt.device_model,
    'issue_description',  rt.issue_description,
    'received_at',        rt.received_at,
    'estimated_ready_at', rt.estimated_ready_at,
    'intake_channel',     rt.intake_channel,
    'last_status_change', (
      SELECT jsonb_build_object(
        'old_status', h.old_status,
        'new_status', h.new_status,
        'changed_at', h.changed_at
      )
      FROM ticket_status_history h
      WHERE h.ticket_id = rt.id
      ORDER BY h.changed_at DESC
      LIMIT 1
    ),
    -- Infos publiques de l'atelier (pas owner_id, plan, etc.)
    'shop', jsonb_build_object(
      'name',     s.name,
      'phone',    s.phone,
      'address',  s.address,
      'hours',    s.hours,
      'logo_url', s.logo_url
    )
  )
  INTO v_result
  FROM repair_tickets rt
  LEFT JOIN shops s ON s.id = rt.shop_id
  WHERE rt.tracking_token = token
  LIMIT 1;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_ticket_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_ticket_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION get_ticket_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_by_token(text) TO service_role;

-- ─────────────────────────────────────────────
-- 7. RPC search_contacts — first_name / last_name + filtrage par atelier
-- ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS search_contacts(text);

CREATE OR REPLACE FUNCTION search_contacts(p_query text)
RETURNS TABLE (
  id           uuid,
  first_name   text,
  last_name    text,
  phone        text,
  email        text,
  ticket_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT id INTO v_shop_id FROM shops WHERE owner_id = auth.uid() LIMIT 1;

  RETURN QUERY
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.phone,
    c.email,
    COUNT(rt.id) AS ticket_count
  FROM contacts c
  LEFT JOIN repair_tickets rt ON rt.contact_id = c.id
  WHERE c.shop_id = v_shop_id
    AND (
      c.first_name ILIKE '%' || p_query || '%' OR
      c.last_name  ILIKE '%' || p_query || '%' OR
      c.phone      ILIKE '%' || p_query || '%' OR
      c.email      ILIKE '%' || p_query || '%'
    )
  GROUP BY c.id
  ORDER BY c.last_name, c.first_name;
END;
$$;

REVOKE ALL ON FUNCTION search_contacts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_contacts(text) TO authenticated;

-- ─────────────────────────────────────────────
-- 8. RLS — isolation multi-tenant
--    Chaque atelier ne voit que ses propres données
-- ─────────────────────────────────────────────

-- Helper : shop_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION fn_my_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM shops WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- contacts
DROP POLICY IF EXISTS "authenticated_full_access" ON contacts;
CREATE POLICY "Atelier — accès contacts"
  ON contacts FOR ALL TO authenticated
  USING     (shop_id = fn_my_shop_id())
  WITH CHECK (shop_id = fn_my_shop_id());

-- repair_tickets
DROP POLICY IF EXISTS "authenticated_full_access" ON repair_tickets;
CREATE POLICY "Atelier — accès tickets"
  ON repair_tickets FOR ALL TO authenticated
  USING     (shop_id = fn_my_shop_id())
  WITH CHECK (shop_id = fn_my_shop_id());

-- ticket_status_history
DROP POLICY IF EXISTS "authenticated_full_access" ON ticket_status_history;
CREATE POLICY "Atelier — accès historique"
  ON ticket_status_history FOR ALL TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM repair_tickets WHERE shop_id = fn_my_shop_id()
    )
  );

-- parts_inventory
DROP POLICY IF EXISTS "authenticated_full_access" ON parts_inventory;
CREATE POLICY "Atelier — accès stock"
  ON parts_inventory FOR ALL TO authenticated
  USING     (shop_id = fn_my_shop_id())
  WITH CHECK (shop_id = fn_my_shop_id());

-- ticket_parts
DROP POLICY IF EXISTS "authenticated_full_access" ON ticket_parts;
CREATE POLICY "Atelier — accès pièces ticket"
  ON ticket_parts FOR ALL TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM repair_tickets WHERE shop_id = fn_my_shop_id()
    )
  );

-- ─────────────────────────────────────────────
-- 9. get_dashboard_stats — filtrage par atelier
-- ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_dashboard_stats();

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  v_shop_id := fn_my_shop_id();

  RETURN jsonb_build_object(
    'tickets_open', (
      SELECT COUNT(*) FROM repair_tickets
      WHERE shop_id = v_shop_id AND status NOT IN ('delivered', 'cancelled')
    ),
    'tickets_today', (
      SELECT COUNT(*) FROM repair_tickets
      WHERE shop_id = v_shop_id
        AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE
    ),
    'tickets_waiting_parts', (
      SELECT COUNT(*) FROM repair_tickets
      WHERE shop_id = v_shop_id AND status = 'waiting_parts'
    ),
    'tickets_ready', (
      SELECT COUNT(*) FROM repair_tickets
      WHERE shop_id = v_shop_id AND status = 'ready'
    ),
    'avg_repair_hours', (
      SELECT ROUND(
        AVG(EXTRACT(EPOCH FROM (closed_at - received_at)) / 3600)::numeric, 2
      )
      FROM repair_tickets
      WHERE shop_id = v_shop_id
        AND status = 'delivered'
        AND closed_at IS NOT NULL
        AND closed_at > now() - INTERVAL '30 days'
    ),
    'revenue_month', (
      SELECT COALESCE(SUM(price_final), 0)
      FROM repair_tickets
      WHERE shop_id = v_shop_id
        AND status = 'delivered'
        AND closed_at IS NOT NULL
        AND closed_at > date_trunc('month', now())
    ),
    'top_device_types', (
      SELECT COALESCE(jsonb_agg(dt), '[]'::jsonb)
      FROM (
        SELECT device_type, COUNT(*) AS count
        FROM repair_tickets
        WHERE shop_id = v_shop_id
          AND created_at > now() - INTERVAL '90 days'
        GROUP BY device_type
        ORDER BY count DESC
        LIMIT 5
      ) dt
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION get_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

COMMIT;
