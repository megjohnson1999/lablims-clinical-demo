-- Migration: Make inventory_id nullable for commercial barcode items
-- This aligns inventory architecture with the rest of the LIMS (UUID-based)

-- Remove the NOT NULL constraint from inventory_id
ALTER TABLE inventory ALTER COLUMN inventory_id DROP NOT NULL;

-- Update the UNIQUE constraint to handle NULLs properly 
-- (PostgreSQL treats each NULL as distinct, so multiple NULLs are allowed)
-- The existing UNIQUE constraint will work correctly with NULLs

-- Add a comment explaining the new architecture
COMMENT ON COLUMN inventory.inventory_id IS 'Sequential ID for LAB-xxx items without commercial barcodes. NULL for items with commercial barcodes.';
COMMENT ON COLUMN inventory.barcode IS 'Display identifier: either commercial barcode (UPC/EAN) or LAB-xxx format. Primary user-facing identifier.';