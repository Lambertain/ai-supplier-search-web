-- Migration: 004_fix_searches_query_nullable
-- Created: 2025-10-11
-- Description: Make 'query' field nullable as new code uses 'product_description' instead

-- The old schema had 'query' as NOT NULL, but new code doesn't use it
-- Instead, code uses 'product_description', 'target_price', 'quantity', etc.
-- This migration makes 'query' optional for backward compatibility

ALTER TABLE searches ALTER COLUMN query DROP NOT NULL;

-- Add comment explaining the field deprecation
COMMENT ON COLUMN searches.query IS 'DEPRECATED: Use product_description instead. Kept for backward compatibility with old data.';
