-- Migration: Add inventory system for molecular biology lab operations
-- This migration creates the inventory table and extends the auto-ID system for inventory items

-- Create inventory sequence for auto-generated IDs
CREATE SEQUENCE IF NOT EXISTS inventory_id_seq;

-- Set starting value for sequence
SELECT setval('inventory_id_seq', 1, false);

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, 
  description TEXT,
  supplier VARCHAR(255),
  catalog_number VARCHAR(100),
  current_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_of_measure VARCHAR(50),
  lot_number VARCHAR(100),
  expiration_date DATE,
  storage_location VARCHAR(255),
  storage_conditions VARCHAR(255),
  minimum_stock_level DECIMAL(10,2) DEFAULT 0,
  cost_per_unit DECIMAL(10,2),
  barcode VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory_transactions table for quantity tracking
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'in', 'out', 'adjustment', 'expired'
  quantity_change DECIMAL(10,2) NOT NULL, -- Positive for additions, negative for usage
  quantity_after DECIMAL(10,2) NOT NULL,
  reason TEXT,
  performed_by UUID REFERENCES users(id),
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_expiration_date ON inventory(expiration_date);
CREATE INDEX IF NOT EXISTS idx_inventory_storage_location ON inventory(storage_location);
CREATE INDEX IF NOT EXISTS idx_inventory_minimum_stock ON inventory(minimum_stock_level);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_id ON inventory_transactions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(transaction_date);

-- Add trigger for updated_at timestamp
CREATE TRIGGER update_inventory_timestamp BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Extend the get_next_id function to include inventory
CREATE OR REPLACE FUNCTION get_next_id(entity_type VARCHAR, username VARCHAR DEFAULT NULL)
RETURNS TABLE(id INTEGER, next_id INTEGER) AS $$
DECLARE
  current_val INTEGER;
  next_val INTEGER;
BEGIN
  CASE entity_type
    WHEN 'collaborator' THEN
      next_val := nextval('collaborator_id_seq');
      current_val := currval('collaborator_id_seq');
    WHEN 'project' THEN
      next_val := nextval('project_id_seq');
      current_val := currval('project_id_seq');
    WHEN 'specimen' THEN
      next_val := nextval('specimen_id_seq');
      current_val := currval('specimen_id_seq');
    WHEN 'inventory' THEN
      next_val := nextval('inventory_id_seq');
      current_val := currval('inventory_id_seq');
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %', entity_type;
  END CASE;
  
  -- Log the ID generation with optional username
  INSERT INTO id_generation_log (entity_type, generated_id, generated_by)
  VALUES (entity_type, next_val, COALESCE(username, 'system'));
  
  RETURN QUERY SELECT next_val as id, next_val + 1 as next_id;
END;
$$ LANGUAGE plpgsql;

-- Create peek_next_id function if it doesn't exist
CREATE OR REPLACE FUNCTION peek_next_id(entity_type VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
BEGIN
  CASE entity_type
    WHEN 'collaborator' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM collaborator_id_seq;
    WHEN 'project' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM project_id_seq;
    WHEN 'specimen' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM specimen_id_seq;
    WHEN 'inventory' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM inventory_id_seq;
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- Create function to get low stock items
CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS TABLE(
  inventory_id INTEGER,
  name VARCHAR(255),
  category VARCHAR(100),
  current_quantity DECIMAL(10,2),
  minimum_stock_level DECIMAL(10,2),
  unit_of_measure VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.inventory_id,
    i.name,
    i.category,
    i.current_quantity,
    i.minimum_stock_level,
    i.unit_of_measure
  FROM inventory i
  WHERE i.current_quantity <= i.minimum_stock_level
    AND i.minimum_stock_level > 0
  ORDER BY (i.current_quantity / NULLIF(i.minimum_stock_level, 0)) ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get expiring items
CREATE OR REPLACE FUNCTION get_expiring_items(days_ahead INTEGER DEFAULT 30)
RETURNS TABLE(
  inventory_id INTEGER,
  name VARCHAR(255),
  category VARCHAR(100),
  expiration_date DATE,
  current_quantity DECIMAL(10,2),
  unit_of_measure VARCHAR(50),
  days_until_expiry INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.inventory_id,
    i.name,
    i.category,
    i.expiration_date,
    i.current_quantity,
    i.unit_of_measure,
    (i.expiration_date - CURRENT_DATE)::INTEGER as days_until_expiry
  FROM inventory i
  WHERE i.expiration_date IS NOT NULL
    AND i.expiration_date <= (CURRENT_DATE + INTERVAL '1 day' * days_ahead)
    AND i.current_quantity > 0
  ORDER BY i.expiration_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SEQUENCE inventory_id_seq TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_transactions TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_low_stock_items() TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_expiring_items(INTEGER) TO PUBLIC;

-- Insert initial inventory categories as reference data
CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  default_unit VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO inventory_categories (category_name, description, default_unit) VALUES
  ('reagents', 'Buffers, salts, chemicals, solvents', 'mL'),
  ('enzymes', 'Restriction enzymes, polymerases, ligases, etc.', 'μL'),
  ('kits', 'PCR kits, extraction kits, cloning kits', 'pieces'),
  ('consumables', 'Tips, tubes, plates, petri dishes', 'pieces'),
  ('antibodies', 'Primary/secondary antibodies for Western blot, etc.', 'μL'),
  ('primers', 'PCR primers, sequencing primers', 'μL'),
  ('media', 'LB, agar, specialized growth media', 'mL'),
  ('other', 'Miscellaneous lab supplies', 'pieces')
ON CONFLICT (category_name) DO NOTHING;

-- Create view for inventory with category info
CREATE OR REPLACE VIEW inventory_with_category AS
SELECT 
  i.*,
  ic.description as category_description,
  ic.default_unit as default_unit
FROM inventory i
LEFT JOIN inventory_categories ic ON i.category = ic.category_name;