-- Migration: 003_add_performance_indexes
-- Created: 2025-10-11
-- Description: Add performance indexes for production scalability

-- Add composite indexes for frequently joined queries
-- These indexes will significantly improve JOIN performance

-- Composite index for findSupplierByEmail query (searchStore.js:288-295)
-- Speeds up JOIN between suppliers and searches on email lookup
CREATE INDEX IF NOT EXISTS idx_suppliers_email_search_id ON suppliers(email, search_id);

-- Composite index for listSuppliersWithSearch query (searchStore.js:309-321)
-- Optimizes JOIN and ORDER BY for supplier listings with search data
CREATE INDEX IF NOT EXISTS idx_suppliers_created_search ON suppliers(created_at DESC, search_id);

-- Composite index for getSearch suppliers query (searchStore.js:67)
-- Speeds up supplier retrieval for a specific search
CREATE INDEX IF NOT EXISTS idx_suppliers_search_created ON suppliers(search_id, created_at);

-- Composite index for conversation_history queries
-- Optimizes queries that filter by search_id and order by timestamp
CREATE INDEX IF NOT EXISTS idx_conversation_search_timestamp ON conversation_history(search_id, timestamp DESC);

-- Composite index for email_sends status queries
-- Optimizes queries filtering by status and ordering by sent_at
CREATE INDEX IF NOT EXISTS idx_email_sends_status_sent ON email_sends(status, sent_at DESC);

-- Partial index for active email sends (exclude completed/failed)
-- Reduces index size and improves queries for active email tracking
CREATE INDEX IF NOT EXISTS idx_email_sends_active ON email_sends(search_id, status)
WHERE status IN ('queued', 'sending');

-- Partial index for suppliers pending contact
-- Optimizes queries for suppliers that haven't been contacted yet
CREATE INDEX IF NOT EXISTS idx_suppliers_pending ON suppliers(search_id, priority DESC)
WHERE status = 'pending' AND emails_sent = 0;

-- GIN index for supplier metadata searches
-- Enables fast JSONB queries on metadata field
CREATE INDEX IF NOT EXISTS idx_suppliers_metadata ON suppliers USING GIN(metadata);

-- GIN index for supplier conversation_history
-- Enables fast JSONB queries on conversation_history field
CREATE INDEX IF NOT EXISTS idx_suppliers_conversation ON suppliers USING GIN(conversation_history);

-- Add index for search_logs context field
-- Enables fast JSONB queries on log context
CREATE INDEX IF NOT EXISTS idx_search_logs_context ON search_logs USING GIN(context);

-- Analyze tables to update statistics for query planner
-- This helps PostgreSQL choose optimal query execution plans
ANALYZE searches;
ANALYZE suppliers;
ANALYZE email_sends;
ANALYZE search_logs;
ANALYZE conversation_history;

-- Add comments for documentation
COMMENT ON INDEX idx_suppliers_email_search_id IS 'Composite index for email lookup with search JOIN';
COMMENT ON INDEX idx_suppliers_created_search IS 'Composite index for listing suppliers with search data';
COMMENT ON INDEX idx_suppliers_search_created IS 'Composite index for getSearch supplier retrieval';
COMMENT ON INDEX idx_email_sends_active IS 'Partial index for active email tracking (queued/sending only)';
COMMENT ON INDEX idx_suppliers_pending IS 'Partial index for suppliers pending first contact';
