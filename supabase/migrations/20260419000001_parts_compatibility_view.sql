-- 20260419000001_parts_compatibility_view.sql
-- Vue de compatibilité : expose parts_inventory avec les noms de colonnes
-- attendus par l'application Next.js (name, reference, stock, price)
-- Raison : parts_inventory utilise des noms verbeux (part_name, sku, qty_stock…)
-- mais l'app query supabase.from('parts') avec des noms courts.

CREATE OR REPLACE VIEW parts AS
SELECT
  id,
  shop_id,
  part_name    AS name,
  sku          AS reference,
  qty_stock    AS stock,
  qty_min_thresh AS min_stock,
  unit_price   AS price,
  supplier_name,
  supplier_url,
  created_at
FROM parts_inventory;

CREATE OR REPLACE RULE parts_insert AS ON INSERT TO parts DO INSTEAD
  INSERT INTO parts_inventory (shop_id, part_name, sku, qty_stock, unit_price)
  VALUES (NEW.shop_id, NEW.name, NEW.reference, COALESCE(NEW.stock, 0), NEW.price);

CREATE OR REPLACE RULE parts_update AS ON UPDATE TO parts DO INSTEAD
  UPDATE parts_inventory SET
    part_name  = NEW.name,
    sku        = NEW.reference,
    qty_stock  = COALESCE(NEW.stock, 0),
    unit_price = NEW.price
  WHERE id = OLD.id;

CREATE OR REPLACE RULE parts_delete AS ON DELETE TO parts DO INSTEAD
  DELETE FROM parts_inventory WHERE id = OLD.id;

GRANT SELECT, INSERT, UPDATE, DELETE ON parts TO authenticated;
