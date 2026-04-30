-- Migration : iFixit Device Picker
-- Ajoute la table de cache ifixit_devices et les colonnes associées sur tickets.

-- Table de cache des appareils iFixit
CREATE TABLE IF NOT EXISTS ifixit_devices (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL,
  subcategory text,
  image_url   text,
  ifixit_url  text,
  synced_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ifixit_devices_category    ON ifixit_devices(category);
CREATE INDEX IF NOT EXISTS idx_ifixit_devices_subcategory ON ifixit_devices(subcategory);
CREATE INDEX IF NOT EXISTS idx_ifixit_devices_search
  ON ifixit_devices USING gin(to_tsvector('simple', name));

-- RLS : lecture publique, écriture réservée à service_role
ALTER TABLE ifixit_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ifixit_read_all" ON ifixit_devices FOR SELECT USING (true);

-- Colonnes iFixit sur la table tickets
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS ifixit_device_id   text,
  ADD COLUMN IF NOT EXISTS ifixit_device_name text,
  ADD COLUMN IF NOT EXISTS ifixit_category    text,
  ADD COLUMN IF NOT EXISTS ifixit_subcategory text,
  ADD COLUMN IF NOT EXISTS ifixit_image_url   text;

-- Seed : 30 appareils populaires
INSERT INTO ifixit_devices (id, name, category, subcategory, image_url, ifixit_url) VALUES
  ('iPhone_15_Pro',          'iPhone 15 Pro',              'Phone',     'Apple iPhone',           NULL, 'https://www.ifixit.com/Device/iPhone_15_Pro'),
  ('iPhone_15',              'iPhone 15',                  'Phone',     'Apple iPhone',           NULL, 'https://www.ifixit.com/Device/iPhone_15'),
  ('iPhone_14',              'iPhone 14',                  'Phone',     'Apple iPhone',           NULL, 'https://www.ifixit.com/Device/iPhone_14'),
  ('iPhone_13',              'iPhone 13',                  'Phone',     'Apple iPhone',           NULL, 'https://www.ifixit.com/Device/iPhone_13'),
  ('iPhone_12',              'iPhone 12',                  'Phone',     'Apple iPhone',           NULL, 'https://www.ifixit.com/Device/iPhone_12'),
  ('Samsung_Galaxy_S24',     'Samsung Galaxy S24',         'Phone',     'Samsung Galaxy',         NULL, 'https://www.ifixit.com/Device/Samsung_Galaxy_S24'),
  ('Samsung_Galaxy_S23',     'Samsung Galaxy S23',         'Phone',     'Samsung Galaxy',         NULL, 'https://www.ifixit.com/Device/Samsung_Galaxy_S23'),
  ('Samsung_Galaxy_S22',     'Samsung Galaxy S22',         'Phone',     'Samsung Galaxy',         NULL, 'https://www.ifixit.com/Device/Samsung_Galaxy_S22'),
  ('Samsung_Galaxy_A54',     'Samsung Galaxy A54',         'Phone',     'Samsung Galaxy',         NULL, 'https://www.ifixit.com/Device/Samsung_Galaxy_A54'),
  ('Google_Pixel_8',         'Google Pixel 8',             'Phone',     'Google Pixel',           NULL, 'https://www.ifixit.com/Device/Google_Pixel_8'),
  ('MacBook_Pro_14_2023',    'MacBook Pro 14" 2023',       'Laptop',    'Apple MacBook',          NULL, 'https://www.ifixit.com/Device/MacBook_Pro_14-Inch_2023_Two_USB-C_Ports'),
  ('MacBook_Air_M2',         'MacBook Air M2 (2022)',      'Laptop',    'Apple MacBook',          NULL, 'https://www.ifixit.com/Device/MacBook_Air_13%22_2022'),
  ('MacBook_Pro_13_M2',      'MacBook Pro 13" M2',         'Laptop',    'Apple MacBook',          NULL, 'https://www.ifixit.com/Device/MacBook_Pro_13%22_2022'),
  ('Dell_XPS_15',            'Dell XPS 15',                'Laptop',    'Dell',                   NULL, 'https://www.ifixit.com/Device/Dell_XPS_15'),
  ('Lenovo_ThinkPad_X1',     'Lenovo ThinkPad X1 Carbon',  'Laptop',    'Lenovo',                 NULL, 'https://www.ifixit.com/Device/Lenovo_ThinkPad_X1_Carbon'),
  ('HP_Spectre_x360',        'HP Spectre x360',            'Laptop',    'HP',                     NULL, 'https://www.ifixit.com/Device/HP_Spectre_x360'),
  ('iPad_Pro_12_9_2022',     'iPad Pro 12.9" 2022',        'Tablet',    'Apple iPad',             NULL, 'https://www.ifixit.com/Device/iPad_Pro_12.9%22_2022_Wi-Fi'),
  ('iPad_Air_5',             'iPad Air 5',                 'Tablet',    'Apple iPad',             NULL, 'https://www.ifixit.com/Device/iPad_Air_5th_Generation'),
  ('iPad_10',                'iPad 10e génération',        'Tablet',    'Apple iPad',             NULL, 'https://www.ifixit.com/Device/iPad_10th_Generation'),
  ('Samsung_Galaxy_Tab_S9',  'Samsung Galaxy Tab S9',      'Tablet',    'Samsung Galaxy Tab',     NULL, 'https://www.ifixit.com/Device/Samsung_Galaxy_Tab_S9'),
  ('PlayStation_5',          'PlayStation 5',              'Console',   'Sony PlayStation',       NULL, 'https://www.ifixit.com/Device/PlayStation_5'),
  ('PlayStation_4',          'PlayStation 4',              'Console',   'Sony PlayStation',       NULL, 'https://www.ifixit.com/Device/PlayStation_4'),
  ('Xbox_Series_X',          'Xbox Series X',              'Console',   'Microsoft Xbox',         NULL, 'https://www.ifixit.com/Device/Xbox_Series_X'),
  ('Nintendo_Switch',        'Nintendo Switch',            'Console',   'Nintendo',               NULL, 'https://www.ifixit.com/Device/Nintendo_Switch'),
  ('Nintendo_Switch_OLED',   'Nintendo Switch OLED',       'Console',   'Nintendo',               NULL, 'https://www.ifixit.com/Device/Nintendo_Switch_OLED_Model'),
  ('Samsung_QLED_65',        'Samsung QLED 65"',           'TV',        'Samsung',                NULL, 'https://www.ifixit.com/Device/Samsung_TV'),
  ('LG_OLED_C3',             'LG OLED C3',                 'TV',        'LG',                     NULL, 'https://www.ifixit.com/Device/LG_OLED_TV'),
  ('Sony_Bravia_XR',         'Sony Bravia XR',             'TV',        'Sony',                   NULL, 'https://www.ifixit.com/Device/Sony_Bravia_XR'),
  ('Dyson_V15',              'Dyson V15 Detect',           'Appliance', 'Dyson',                  NULL, 'https://www.ifixit.com/Device/Dyson_V15_Detect'),
  ('iRobot_Roomba_j7',       'iRobot Roomba j7',           'Appliance', 'iRobot',                 NULL, 'https://www.ifixit.com/Device/iRobot_Roomba_j7')
ON CONFLICT (id) DO NOTHING;
