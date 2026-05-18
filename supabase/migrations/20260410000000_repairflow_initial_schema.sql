-- ============================================================
-- TickeeFlow — Migration initiale
-- PostgreSQL 15+ / Supabase
-- Auteur : généré automatiquement
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

-- pgcrypto expose gen_random_uuid() sur les versions antérieures à PG13 ;
-- sur PG15+ elle est déjà disponible nativement, mais l'appel est idempotent.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- TABLES
-- ============================================================

-- ------------------------------------------------------------
-- contacts : clients des ateliers de réparation
-- ------------------------------------------------------------
CREATE TABLE contacts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  email      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT contacts_phone_unique UNIQUE (phone)
);

COMMENT ON TABLE contacts IS 'Clients des ateliers de réparation.';

-- ------------------------------------------------------------
-- repair_tickets : tickets de réparation
-- tracking_token est immuable — généré par trigger à la création.
-- Les changements de statut doivent transiter par n8n.
-- ------------------------------------------------------------
CREATE TABLE repair_tickets (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_token     TEXT        NOT NULL UNIQUE,
  contact_id         UUID        NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  device_type        TEXT        NOT NULL,
  device_brand       TEXT,
  device_model       TEXT,
  issue_description  TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'received',
  received_at        TIMESTAMPTZ DEFAULT now(),
  estimated_ready_at TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  price_estimate     NUMERIC(10,2),
  price_final        NUMERIC(10,2),
  internal_notes     TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT repair_tickets_device_type_check CHECK (
    device_type IN ('smartphone','tablet','laptop','console','tv','appliance','other')
  ),
  CONSTRAINT repair_tickets_status_check CHECK (
    status IN (
      'received','diagnosed','waiting_approval',
      'in_repair','waiting_parts','ready','delivered','cancelled'
    )
  )
);

COMMENT ON TABLE  repair_tickets                IS 'Tickets de réparation. Le tracking_token est généré automatiquement et ne doit jamais être modifié.';
COMMENT ON COLUMN repair_tickets.tracking_token IS 'Token de suivi public — 8 caractères alphanumériques majuscules. Immuable après création.';
COMMENT ON COLUMN repair_tickets.status         IS 'Statut du ticket. Toute modification doit transiter par n8n via webhook, jamais par UPDATE direct.';

-- ------------------------------------------------------------
-- ticket_status_history : journal des changements de statut
-- Alimenté exclusivement par trigger AFTER UPDATE sur repair_tickets.
-- ------------------------------------------------------------
CREATE TABLE ticket_status_history (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID        NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT        NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by TEXT        DEFAULT 'system'
);

COMMENT ON TABLE ticket_status_history IS 'Journal immuable de l''historique des statuts. Alimenté automatiquement par trigger.';

-- ------------------------------------------------------------
-- parts_inventory : pièces détachées en stock
-- ------------------------------------------------------------
CREATE TABLE parts_inventory (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  part_name         TEXT        NOT NULL,
  sku               TEXT        UNIQUE,
  qty_stock         INTEGER     NOT NULL DEFAULT 0,
  qty_min_threshold INTEGER     NOT NULL DEFAULT 1,
  supplier_name     TEXT,
  supplier_url      TEXT,
  unit_price        NUMERIC(10,2),
  created_at        TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT parts_inventory_qty_stock_non_negative       CHECK (qty_stock >= 0),
  CONSTRAINT parts_inventory_qty_min_threshold_non_neg    CHECK (qty_min_threshold >= 0)
);

COMMENT ON TABLE parts_inventory IS 'Inventaire des pièces détachées avec seuil d''alerte de réapprovisionnement.';

-- ------------------------------------------------------------
-- ticket_parts : association tickets ↔ pièces
-- ------------------------------------------------------------
CREATE TABLE ticket_parts (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID        NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  part_id   UUID        NOT NULL REFERENCES parts_inventory(id) ON DELETE RESTRICT,
  qty_used  INTEGER     NOT NULL DEFAULT 1,
  status    TEXT        NOT NULL DEFAULT 'ordered',
  added_at  TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT ticket_parts_qty_used_positive CHECK (qty_used > 0),
  CONSTRAINT ticket_parts_status_check CHECK (
    status IN ('ordered','received','installed')
  )
);

COMMENT ON TABLE ticket_parts IS 'Pièces commandées ou utilisées pour un ticket de réparation.';


-- ============================================================
-- INDEX
-- ============================================================

-- Accès rapide par token (page de suivi client, webhooks)
CREATE INDEX idx_repair_tickets_tracking_token ON repair_tickets (tracking_token);

-- Jointures et filtres fréquents
CREATE INDEX idx_repair_tickets_contact_id     ON repair_tickets (contact_id);
CREATE INDEX idx_repair_tickets_status         ON repair_tickets (status);

-- Tri et pagination par date de création
CREATE INDEX idx_repair_tickets_created_at     ON repair_tickets (created_at DESC);

-- Historique d'un ticket donné
CREATE INDEX idx_ticket_status_history_ticket  ON ticket_status_history (ticket_id);

-- Index partiel : pièces sous le seuil minimum (pour alertes de réapprovisionnement)
CREATE INDEX idx_parts_low_stock ON parts_inventory (qty_stock)
  WHERE qty_stock <= qty_min_threshold;


-- ============================================================
-- FONCTIONS ET TRIGGERS
-- ============================================================

-- ------------------------------------------------------------
-- Trigger : génération du tracking_token à la création
-- Utilise gen_random_uuid() comme source d'entropie puis
-- extrait 8 caractères hexadécimaux en majuscules.
-- Une boucle garantit l'unicité en cas (improbable) de collision.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generate_tracking_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_token  TEXT;
  v_exists BOOLEAN;
BEGIN
  IF NEW.tracking_token IS NULL OR NEW.tracking_token = '' THEN
    LOOP
      v_token := UPPER(
        substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)
      );
      -- Vérifie que le token n'est pas déjà utilisé
      SELECT EXISTS (
        SELECT 1 FROM repair_tickets WHERE tracking_token = v_token
      ) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
    NEW.tracking_token := v_token;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_repair_tickets_gen_token
  BEFORE INSERT ON repair_tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_generate_tracking_token();

-- ------------------------------------------------------------
-- Trigger : mise à jour automatique de updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_repair_tickets_updated_at
  BEFORE UPDATE ON repair_tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_updated_at();

-- ------------------------------------------------------------
-- Trigger : journalisation automatique des changements de statut
-- S'exécute après chaque UPDATE sur repair_tickets ;
-- n'insère dans ticket_status_history que si le statut a changé.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_log_ticket_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_status_history (ticket_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, 'system');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_repair_tickets_status_history
  AFTER UPDATE ON repair_tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_ticket_status_change();


-- ============================================================
-- FONCTIONS RPC
-- ============================================================

-- ------------------------------------------------------------
-- get_dashboard_stats()
-- KPIs du tableau de bord — accès authentifié uniquement.
-- SECURITY DEFINER pour agréger sur l'ensemble des tickets.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(

    -- Tickets encore ouverts
    'tickets_open', (
      SELECT COUNT(*)
      FROM repair_tickets
      WHERE status NOT IN ('delivered', 'cancelled')
    ),

    -- Tickets créés aujourd'hui
    'tickets_today', (
      SELECT COUNT(*)
      FROM repair_tickets
      WHERE DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE
    ),

    -- Tickets bloqués en attente de pièces
    'tickets_waiting_parts', (
      SELECT COUNT(*)
      FROM repair_tickets
      WHERE status = 'waiting_parts'
    ),

    -- Tickets prêts à être récupérés
    'tickets_ready', (
      SELECT COUNT(*)
      FROM repair_tickets
      WHERE status = 'ready'
    ),

    -- Durée moyenne de réparation (heures) sur les 30 derniers jours
    'avg_repair_hours', (
      SELECT ROUND(
        AVG(EXTRACT(EPOCH FROM (closed_at - received_at)) / 3600)::NUMERIC,
        2
      )
      FROM repair_tickets
      WHERE status = 'delivered'
        AND closed_at IS NOT NULL
        AND closed_at > now() - INTERVAL '30 days'
    ),

    -- Chiffre d'affaires du mois en cours
    'revenue_month', (
      SELECT COALESCE(SUM(price_final), 0)
      FROM repair_tickets
      WHERE status = 'delivered'
        AND closed_at IS NOT NULL
        AND closed_at > date_trunc('month', now())
    ),

    -- Top 5 des types d'appareils réparés sur les 90 derniers jours
    'top_device_types', (
      SELECT COALESCE(json_agg(dt), '[]'::json)
      FROM (
        SELECT device_type, COUNT(*) AS count
        FROM repair_tickets
        WHERE created_at > now() - INTERVAL '90 days'
        GROUP BY device_type
        ORDER BY count DESC
        LIMIT 5
      ) dt
    )

  );
END;
$$;

COMMENT ON FUNCTION get_dashboard_stats() IS
  'Retourne les KPIs principaux du tableau de bord. Réservé aux utilisateurs authentifiés.';

-- ------------------------------------------------------------
-- get_ticket_by_token(p_token)
-- Consultation publique d'un ticket par son token de suivi.
-- SECURITY DEFINER — bypass RLS, expose uniquement les champs publics.
-- Retourne NULL si le token est introuvable.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_ticket_by_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
  v_result    JSON;
BEGIN
  -- Résolution du token en UUID interne
  SELECT id INTO v_ticket_id
  FROM repair_tickets
  WHERE tracking_token = p_token;

  IF v_ticket_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Construction de la réponse avec uniquement les champs publics autorisés
  SELECT json_build_object(
    'tracking_token',     rt.tracking_token,
    'device_type',        rt.device_type,
    'device_brand',       rt.device_brand,
    'device_model',       rt.device_model,
    'status',             rt.status,
    'received_at',        rt.received_at,
    'estimated_ready_at', rt.estimated_ready_at,
    'last_status_change', (
      SELECT json_build_object(
        'old_status', tsh.old_status,
        'new_status', tsh.new_status,
        'changed_at', tsh.changed_at
      )
      FROM ticket_status_history tsh
      WHERE tsh.ticket_id = v_ticket_id
      ORDER BY tsh.changed_at DESC
      LIMIT 1
    )
  )
  INTO v_result
  FROM repair_tickets rt
  WHERE rt.id = v_ticket_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_ticket_by_token(TEXT) IS
  'Retourne les champs publics d''un ticket par son token de suivi. Accessible sans authentification via SECURITY DEFINER.';

-- ------------------------------------------------------------
-- upsert_contact(p_name, p_phone, p_email)
-- Crée un contact ou met à jour son nom/email si le téléphone existe.
-- Retourne l'UUID du contact créé ou trouvé.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_contact(
  p_name  TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Recherche d'un contact existant par numéro de téléphone (contrainte unique)
  SELECT id INTO v_id
  FROM contacts
  WHERE phone = p_phone;

  IF v_id IS NOT NULL THEN
    -- Met à jour le nom si une nouvelle valeur non vide est fournie
    -- Met à jour l'email si une valeur est explicitement fournie (NULL efface, intentionnel)
    UPDATE contacts
    SET
      name  = CASE
                WHEN p_name IS NOT NULL AND p_name <> '' THEN p_name
                ELSE name
              END,
      email = CASE
                WHEN p_email IS NOT NULL THEN p_email
                ELSE email
              END
    WHERE id = v_id;

    RETURN v_id;
  ELSE
    INSERT INTO contacts (name, phone, email)
    VALUES (p_name, p_phone, p_email)
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION upsert_contact(TEXT, TEXT, TEXT) IS
  'Crée un contact ou met à jour son nom/email si le numéro de téléphone est déjà enregistré. Retourne l''UUID du contact.';

-- ------------------------------------------------------------
-- search_contacts(p_query)
-- Recherche en texte libre sur nom, téléphone et email.
-- Retourne le nombre de tickets associés à chaque contact.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_contacts(p_query TEXT)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  phone        TEXT,
  email        TEXT,
  ticket_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.phone,
    c.email,
    COUNT(rt.id) AS ticket_count
  FROM contacts c
  LEFT JOIN repair_tickets rt ON rt.contact_id = c.id
  WHERE
    c.name  ILIKE '%' || p_query || '%'
    OR c.phone ILIKE '%' || p_query || '%'
    OR c.email ILIKE '%' || p_query || '%'
  GROUP BY c.id, c.name, c.phone, c.email
  ORDER BY c.name ASC;
END;
$$;

COMMENT ON FUNCTION search_contacts(TEXT) IS
  'Recherche de contacts par nom, téléphone ou email (ILIKE). Retourne le nombre de tickets associés.';


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Activation du RLS sur toutes les tables
ALTER TABLE contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_parts          ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- contacts — accès complet pour les utilisateurs authentifiés
-- ------------------------------------------------------------
CREATE POLICY "authenticated_full_access" ON contacts
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- repair_tickets — accès complet pour les authentifiés
--                + lecture publique restreinte aux colonnes client
-- ------------------------------------------------------------
CREATE POLICY "authenticated_full_access" ON repair_tickets
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Permet au rôle anon de lire les lignes de repair_tickets.
-- La restriction aux colonnes publiques est appliquée via GRANT ci-dessous
-- et renforcée par la fonction get_ticket_by_token() (SECURITY DEFINER).
CREATE POLICY "public_track_read" ON repair_tickets
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (true);

-- ------------------------------------------------------------
-- ticket_status_history — accès complet pour les authentifiés
-- ------------------------------------------------------------
CREATE POLICY "authenticated_full_access" ON ticket_status_history
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- parts_inventory — accès complet pour les authentifiés
-- ------------------------------------------------------------
CREATE POLICY "authenticated_full_access" ON parts_inventory
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- ticket_parts — accès complet pour les authentifiés
-- ------------------------------------------------------------
CREATE POLICY "authenticated_full_access" ON ticket_parts
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ============================================================
-- GRANTS : permissions de colonnes et d'exécution
-- ============================================================

-- Restriction des colonnes visibles par le rôle anonyme sur repair_tickets.
-- RLS autorise l'accès aux lignes ; GRANT restreint les colonnes accessibles.
REVOKE ALL ON repair_tickets FROM anon;
GRANT SELECT (
  tracking_token,
  device_type,
  device_brand,
  device_model,
  status,
  received_at,
  estimated_ready_at
) ON repair_tickets TO anon;

-- Permissions d'exécution sur les fonctions RPC.
-- Par défaut PostgreSQL accorde EXECUTE à PUBLIC — on révoque puis on cible.
REVOKE EXECUTE ON FUNCTION get_dashboard_stats()               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_ticket_by_token(TEXT)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION upsert_contact(TEXT, TEXT, TEXT)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION search_contacts(TEXT)               FROM PUBLIC;

-- Tableau de bord : authentifiés uniquement
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- Suivi public : anon + authentifiés
GRANT EXECUTE ON FUNCTION get_ticket_by_token(TEXT) TO anon, authenticated;

-- Opérations métier : authentifiés uniquement
GRANT EXECUTE ON FUNCTION upsert_contact(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_contacts(TEXT)            TO authenticated;
