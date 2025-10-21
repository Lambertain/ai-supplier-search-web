-- Migration: 003_fix_years_in_business_type
-- Created: 2025-10-14
-- Description: Change years_in_business from INTEGER to VARCHAR to support text values like "Since 2015"

-- Change years_in_business column type from INTEGER to VARCHAR
-- This allows storing both numeric values and text descriptions
ALTER TABLE suppliers ALTER COLUMN years_in_business TYPE VARCHAR(255) USING years_in_business::TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN suppliers.years_in_business IS 'Years in business - can be numeric (e.g., "5") or descriptive (e.g., "Since 2015", "Over 20 years")';
