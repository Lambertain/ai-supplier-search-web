-- Migration: 002_change_supplier_id_to_varchar
-- Created: 2025-10-12
-- Description: Change suppliers.id from SERIAL to VARCHAR to support custom IDs like "SUP_1760248505113_001"

-- Step 1: Drop foreign key constraint from email_sends
ALTER TABLE email_sends DROP CONSTRAINT IF EXISTS email_sends_supplier_id_fkey;

-- Step 2: Drop foreign key constraint from conversation_history
ALTER TABLE conversation_history DROP CONSTRAINT IF EXISTS conversation_history_supplier_id_fkey;

-- Step 3: Change suppliers.id to VARCHAR
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_pkey;
ALTER TABLE suppliers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE suppliers ALTER COLUMN id TYPE VARCHAR(255);
ALTER TABLE suppliers ADD PRIMARY KEY (id);

-- Step 4: Change supplier_id in email_sends to VARCHAR
ALTER TABLE email_sends ALTER COLUMN supplier_id TYPE VARCHAR(255);

-- Step 5: Change supplier_id in conversation_history to VARCHAR
ALTER TABLE conversation_history ALTER COLUMN supplier_id TYPE VARCHAR(255);

-- Step 6: Re-add foreign key constraints
ALTER TABLE email_sends
  ADD CONSTRAINT email_sends_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE conversation_history
  ADD CONSTRAINT conversation_history_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

-- Drop the sequence that was created for SERIAL
DROP SEQUENCE IF EXISTS suppliers_id_seq;

COMMENT ON COLUMN suppliers.id IS 'Custom supplier ID in format SUP_{timestamp}_{index}';
