-- ---------------------------------------------------------------------------
-- Table ticket_parts : pièces utilisées pour un ticket de réparation
-- Chaque ligne associe une pièce (parts_inventory) à un ticket avec une qté
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ticket_parts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  part_id    uuid        NOT NULL REFERENCES parts_inventory(id) ON DELETE CASCADE,
  quantity   integer     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10,2),          -- prix snapshot au moment de l'ajout
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, part_id)
);

ALTER TABLE ticket_parts ENABLE ROW LEVEL SECURITY;

-- Le technicien de l'atelier peut tout faire sur ses propres tickets
CREATE POLICY "shop_owner_select_ticket_parts" ON ticket_parts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tickets t
      JOIN shops s ON s.id = t.shop_id
      WHERE t.id = ticket_parts.ticket_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "shop_owner_insert_ticket_parts" ON ticket_parts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tickets t
      JOIN shops s ON s.id = t.shop_id
      WHERE t.id = ticket_parts.ticket_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "shop_owner_update_ticket_parts" ON ticket_parts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM tickets t
      JOIN shops s ON s.id = t.shop_id
      WHERE t.id = ticket_parts.ticket_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "shop_owner_delete_ticket_parts" ON ticket_parts
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM tickets t
      JOIN shops s ON s.id = t.shop_id
      WHERE t.id = ticket_parts.ticket_id
        AND s.owner_id = auth.uid()
    )
  );

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_ticket_parts_ticket_id ON ticket_parts(ticket_id);
