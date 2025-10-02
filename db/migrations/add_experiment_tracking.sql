-- Migration: Add experiment tracking system for LIMS
-- This migration creates tables for protocols, experiments, and integrates with existing inventory system

-- Create protocol sequence for auto-generated IDs
CREATE SEQUENCE IF NOT EXISTS protocol_id_seq;
CREATE SEQUENCE IF NOT EXISTS experiment_id_seq;

-- Set starting values for sequences
SELECT setval('protocol_id_seq', 1, false);
SELECT setval('experiment_id_seq', 1, false);

-- Create protocols table
CREATE TABLE IF NOT EXISTS protocols (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) DEFAULT '1.0',
  required_reagents JSONB DEFAULT '[]'::jsonb, -- Array of {name, quantity_per_sample, unit}
  basic_steps TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create experiments table
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id INTEGER UNIQUE NOT NULL,
  protocol_id UUID REFERENCES protocols(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  date_performed DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'completed', -- completed, in_progress, failed
  sample_ids JSONB DEFAULT '[]'::jsonb, -- Array of specimen UUIDs
  actual_reagents_used JSONB DEFAULT '[]'::jsonb, -- Array of {inventory_id, quantity_used, unit}
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update inventory_transactions to link to experiments
ALTER TABLE inventory_transactions 
ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL;

-- Add reservation status to inventory_transactions
ALTER TABLE inventory_transactions 
ADD COLUMN IF NOT EXISTS transaction_status VARCHAR(50) DEFAULT 'completed';
-- Values: 'reserved', 'completed', 'cancelled'

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_protocols_name ON protocols(name);
CREATE INDEX IF NOT EXISTS idx_protocols_active ON protocols(is_active);
CREATE INDEX IF NOT EXISTS idx_protocols_created_by ON protocols(created_by);

CREATE INDEX IF NOT EXISTS idx_experiments_protocol ON experiments(protocol_id);
CREATE INDEX IF NOT EXISTS idx_experiments_user ON experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_date ON experiments(date_performed);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_samples ON experiments USING gin(sample_ids);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_experiment ON inventory_transactions(experiment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_status ON inventory_transactions(transaction_status);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_protocol_timestamp BEFORE UPDATE ON protocols FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_experiment_timestamp BEFORE UPDATE ON experiments FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Extend the get_next_id function to include protocols and experiments
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
    WHEN 'protocol' THEN
      next_val := nextval('protocol_id_seq');
      current_val := currval('protocol_id_seq');
    WHEN 'experiment' THEN
      next_val := nextval('experiment_id_seq');
      current_val := currval('experiment_id_seq');
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %', entity_type;
  END CASE;
  
  -- Log the ID generation with optional username
  INSERT INTO id_generation_log (entity_type, generated_id, generated_by)
  VALUES (entity_type, next_val, COALESCE(username, 'system'));
  
  RETURN QUERY SELECT next_val as id, next_val + 1 as next_id;
END;
$$ LANGUAGE plpgsql;

-- Update peek_next_id function to include protocols and experiments
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
    WHEN 'protocol' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM protocol_id_seq;
    WHEN 'experiment' THEN
      SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END INTO next_val FROM experiment_id_seq;
    ELSE
      RAISE EXCEPTION 'Invalid entity type: %', entity_type;
  END CASE;
  
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- Create function to reserve inventory for experiment
CREATE OR REPLACE FUNCTION reserve_inventory_for_experiment(
  p_experiment_id UUID,
  p_inventory_items JSONB,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  item JSONB;
  inventory_item RECORD;
  available_quantity DECIMAL(10,2);
BEGIN
  -- Loop through each inventory item to reserve
  FOR item IN SELECT * FROM jsonb_array_elements(p_inventory_items)
  LOOP
    -- Get current inventory item
    SELECT * INTO inventory_item 
    FROM inventory 
    WHERE id = (item->>'inventory_id')::UUID;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found: %', item->>'inventory_id';
    END IF;
    
    -- Check if enough quantity is available
    SELECT current_quantity INTO available_quantity
    FROM inventory
    WHERE id = inventory_item.id;
    
    IF available_quantity < (item->>'quantity')::DECIMAL THEN
      RAISE EXCEPTION 'Insufficient inventory for %: Available %, Required %', 
        inventory_item.name, available_quantity, (item->>'quantity')::DECIMAL;
    END IF;
    
    -- Create reservation transaction
    INSERT INTO inventory_transactions (
      inventory_id, 
      transaction_type, 
      quantity_change, 
      quantity_after, 
      reason, 
      performed_by, 
      experiment_id,
      transaction_status
    ) VALUES (
      inventory_item.id,
      'out',
      -((item->>'quantity')::DECIMAL),
      available_quantity - (item->>'quantity')::DECIMAL,
      'Reserved for experiment ' || p_experiment_id,
      p_user_id,
      p_experiment_id,
      'reserved'
    );
    
    -- Update inventory quantity
    UPDATE inventory 
    SET current_quantity = current_quantity - (item->>'quantity')::DECIMAL
    WHERE id = inventory_item.id;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to consume reserved inventory
CREATE OR REPLACE FUNCTION consume_reserved_inventory(
  p_experiment_id UUID,
  p_actual_usage JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  reservation RECORD;
  actual_item JSONB;
  actual_quantity DECIMAL(10,2);
  quantity_diff DECIMAL(10,2);
BEGIN
  -- If actual usage provided, update reservations with actual amounts
  IF p_actual_usage IS NOT NULL THEN
    FOR actual_item IN SELECT * FROM jsonb_array_elements(p_actual_usage)
    LOOP
      actual_quantity := (actual_item->>'quantity')::DECIMAL;
      
      -- Find the reservation transaction
      SELECT * INTO reservation
      FROM inventory_transactions
      WHERE experiment_id = p_experiment_id
        AND inventory_id = (actual_item->>'inventory_id')::UUID
        AND transaction_status = 'reserved';
      
      IF FOUND THEN
        quantity_diff := actual_quantity - ABS(reservation.quantity_change);
        
        -- Update the reservation transaction with actual usage
        UPDATE inventory_transactions
        SET quantity_change = -actual_quantity,
            quantity_after = quantity_after - quantity_diff,
            transaction_status = 'completed',
            reason = 'Consumed for experiment ' || p_experiment_id
        WHERE id = reservation.id;
        
        -- Adjust inventory if there's a difference
        IF quantity_diff != 0 THEN
          UPDATE inventory
          SET current_quantity = current_quantity - quantity_diff
          WHERE id = reservation.inventory_id;
        END IF;
      END IF;
    END LOOP;
  ELSE
    -- Just mark all reservations as consumed
    UPDATE inventory_transactions
    SET transaction_status = 'completed',
        reason = 'Consumed for experiment ' || p_experiment_id
    WHERE experiment_id = p_experiment_id
      AND transaction_status = 'reserved';
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to cancel reserved inventory
CREATE OR REPLACE FUNCTION cancel_reserved_inventory(p_experiment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  reservation RECORD;
BEGIN
  -- Find all reservations for this experiment
  FOR reservation IN 
    SELECT * FROM inventory_transactions
    WHERE experiment_id = p_experiment_id
      AND transaction_status = 'reserved'
  LOOP
    -- Return quantity to inventory
    UPDATE inventory
    SET current_quantity = current_quantity + ABS(reservation.quantity_change)
    WHERE id = reservation.inventory_id;
    
    -- Mark reservation as cancelled
    UPDATE inventory_transactions
    SET transaction_status = 'cancelled',
        reason = 'Cancelled reservation for experiment ' || p_experiment_id
    WHERE id = reservation.id;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create view for experiments with protocol and user details
CREATE OR REPLACE VIEW experiments_with_details AS
SELECT 
  e.*,
  p.name as protocol_name,
  p.description as protocol_description,
  p.version as protocol_version,
  u.username as performed_by_username,
  u.first_name as performed_by_first_name,
  u.last_name as performed_by_last_name,
  jsonb_array_length(e.sample_ids) as sample_count
FROM experiments e
LEFT JOIN protocols p ON e.protocol_id = p.id
LEFT JOIN users u ON e.user_id = u.id;

-- Create view for protocol usage statistics
CREATE OR REPLACE VIEW protocol_usage_stats AS
SELECT 
  p.id as protocol_id,
  p.name as protocol_name,
  p.version,
  COUNT(e.id) as usage_count,
  MAX(e.date_performed) as last_used,
  COUNT(DISTINCT e.user_id) as user_count
FROM protocols p
LEFT JOIN experiments e ON p.id = e.protocol_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.version;

-- Grant necessary permissions
GRANT USAGE ON SEQUENCE protocol_id_seq TO PUBLIC;
GRANT USAGE ON SEQUENCE experiment_id_seq TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON protocols TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON experiments TO PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_inventory_for_experiment(UUID, JSONB, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION consume_reserved_inventory(UUID, JSONB) TO PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_reserved_inventory(UUID) TO PUBLIC;
GRANT SELECT ON experiments_with_details TO PUBLIC;
GRANT SELECT ON protocol_usage_stats TO PUBLIC;