-- Migration: 002_add_search_fields
-- Created: 2025-10-10
-- Description: Add missing fields to searches table and create search_logs table

-- Drop existing searches table constraints
-- Note: In production, use ALTER TABLE ADD COLUMN instead of DROP/CREATE

-- Add missing columns to searches table
ALTER TABLE searches ADD COLUMN IF NOT EXISTS search_id VARCHAR(255);
ALTER TABLE searches ADD COLUMN IF NOT EXISTS product_description TEXT;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS target_price VARCHAR(100);
ALTER TABLE searches ADD COLUMN IF NOT EXISTS quantity VARCHAR(100);
ALTER TABLE searches ADD COLUMN IF NOT EXISTS additional_requirements TEXT;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS operator VARCHAR(100) DEFAULT 'AI_Agent';
ALTER TABLE searches ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS suppliers_requested INTEGER DEFAULT 0;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS suppliers_validated INTEGER DEFAULT 0;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0;

-- Update search_id to be unique if it exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_searches_search_id ON searches(search_id) WHERE search_id IS NOT NULL;

-- Add missing columns to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS manufacturing_capabilities TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS production_capacity VARCHAR(255);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS years_in_business INTEGER;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS estimated_price_range VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS minimum_order_quantity VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_contact TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS emails_received INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_response_date TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS conversation_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255);

-- Create search_logs table if not exists
CREATE TABLE IF NOT EXISTS search_logs (
    id SERIAL PRIMARY KEY,
    search_id VARCHAR(255) NOT NULL,
    level VARCHAR(20) DEFAULT 'info',
    message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_search_id ON search_logs(search_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_level ON search_logs(level);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at DESC);

-- Add missing columns to email_sends table
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS error TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_searches_started_at ON searches(started_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_searches_completed_at ON searches(completed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_priority ON suppliers(priority DESC);
CREATE INDEX IF NOT EXISTS idx_suppliers_last_contact ON suppliers(last_contact DESC);

-- Add comments
COMMENT ON COLUMN searches.search_id IS 'Unique search identifier for tracking and API responses';
COMMENT ON COLUMN searches.product_description IS 'Detailed description of the product being searched';
COMMENT ON COLUMN searches.started_at IS 'Timestamp when search was initiated';
COMMENT ON COLUMN searches.completed_at IS 'Timestamp when search completed (success or failure)';
COMMENT ON TABLE search_logs IS 'Detailed logs for each search execution';
