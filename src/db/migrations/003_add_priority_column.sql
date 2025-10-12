-- Migration: 003_add_priority_column
-- Created: 2025-10-12
-- Description: Add priority column to suppliers table

-- Add priority column as VARCHAR since code uses 'High' and 'Normal' strings
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS priority VARCHAR(50);

-- Set default values for existing rows
UPDATE suppliers
SET priority = 'Normal'
WHERE priority IS NULL;

COMMENT ON COLUMN suppliers.priority IS 'Supplier priority level: High, Normal, Low';
