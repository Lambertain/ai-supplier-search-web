-- Migration: 003_add_priority_column
-- Created: 2025-10-12
-- Description: Change priority column from INTEGER to VARCHAR in suppliers table

-- Step 1: Check if priority column exists and what type it is
DO $$
BEGIN
    -- If priority column exists, drop it first
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'suppliers' AND column_name = 'priority'
    ) THEN
        ALTER TABLE suppliers DROP COLUMN priority;
    END IF;
END $$;

-- Step 2: Add priority column as VARCHAR
ALTER TABLE suppliers
ADD COLUMN priority VARCHAR(50);

-- Step 3: Set default values for existing rows
UPDATE suppliers
SET priority = 'Normal'
WHERE priority IS NULL;

COMMENT ON COLUMN suppliers.priority IS 'Supplier priority level: High, Normal, Low';
