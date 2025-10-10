-- Initial database schema for Supplier Search Application
-- Migration: 001_initial_schema
-- Created: 2025-10-09
-- Description: Create core tables for searches, suppliers, emails, settings, and conversation history

-- Table: searches
-- Stores search job metadata and status
CREATE TABLE IF NOT EXISTS searches (
    id VARCHAR(255) PRIMARY KEY,
    query TEXT NOT NULL,
    supplier_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_searches_status ON searches(status);
CREATE INDEX idx_searches_created_at ON searches(created_at DESC);
CREATE INDEX idx_searches_metadata ON searches USING GIN(metadata);

-- Table: suppliers
-- Stores supplier information discovered during searches
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    search_id VARCHAR(255) NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    company_name VARCHAR(500) NOT NULL,
    email VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    language VARCHAR(10),
    phone VARCHAR(100),
    website VARCHAR(500),
    description TEXT,
    validated BOOLEAN DEFAULT false,
    validation_details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_suppliers_search_id ON suppliers(search_id);
CREATE INDEX idx_suppliers_email ON suppliers(email);
CREATE INDEX idx_suppliers_country ON suppliers(country);
CREATE INDEX idx_suppliers_language ON suppliers(language);
CREATE INDEX idx_suppliers_validated ON suppliers(validated);
CREATE INDEX idx_suppliers_validation_details ON suppliers USING GIN(validation_details);

-- Table: email_sends
-- Tracks email outreach lifecycle including sends and replies
CREATE TABLE IF NOT EXISTS email_sends (
    id SERIAL PRIMARY KEY,
    search_id VARCHAR(255) NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    subject TEXT,
    body TEXT,
    language VARCHAR(10),
    status VARCHAR(50) DEFAULT 'queued',
    sendgrid_message_id VARCHAR(255),
    sent_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    reply_received_at TIMESTAMP,
    reply_text TEXT,
    reply_language VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_sends_search_id ON email_sends(search_id);
CREATE INDEX idx_email_sends_supplier_id ON email_sends(supplier_id);
CREATE INDEX idx_email_sends_recipient ON email_sends(recipient_email);
CREATE INDEX idx_email_sends_status ON email_sends(status);
CREATE INDEX idx_email_sends_sendgrid_message_id ON email_sends(sendgrid_message_id);
CREATE INDEX idx_email_sends_sent_at ON email_sends(sent_at DESC);
CREATE INDEX idx_email_sends_reply_received_at ON email_sends(reply_received_at DESC);

-- Table: app_settings
-- Stores application configuration and user preferences (single row design)
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT app_settings_single_row CHECK (id = 1)
);

-- Table: conversation_history
-- Stores email conversation threads with suppliers
CREATE TABLE IF NOT EXISTS conversation_history (
    id SERIAL PRIMARY KEY,
    search_id VARCHAR(255) REFERENCES searches(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    email_send_id INTEGER REFERENCES email_sends(id) ON DELETE SET NULL,
    message_type VARCHAR(50) NOT NULL,
    sender_email VARCHAR(255),
    recipient_email VARCHAR(255),
    subject TEXT,
    body TEXT,
    language VARCHAR(10),
    timestamp TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_conversation_search_id ON conversation_history(search_id);
CREATE INDEX idx_conversation_supplier_id ON conversation_history(supplier_id);
CREATE INDEX idx_conversation_email_send_id ON conversation_history(email_send_id);
CREATE INDEX idx_conversation_message_type ON conversation_history(message_type);
CREATE INDEX idx_conversation_timestamp ON conversation_history(timestamp DESC);
CREATE INDEX idx_conversation_metadata ON conversation_history USING GIN(metadata);

-- Insert default app_settings row (will be populated by settingsStore on first load)
INSERT INTO app_settings (id, data) VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE searches IS 'Search jobs initiated by users with AI-driven supplier discovery';
COMMENT ON TABLE suppliers IS 'Supplier companies discovered during searches with contact information';
COMMENT ON TABLE email_sends IS 'Email outreach attempts with tracking of sends, failures, and replies';
COMMENT ON TABLE app_settings IS 'Application-wide configuration and user preferences (singleton)';
COMMENT ON TABLE conversation_history IS 'Complete email conversation threads with suppliers';

COMMENT ON COLUMN suppliers.language IS 'ISO 639-1 language code for supplier communication (e.g., zh, en, de, hi)';
COMMENT ON COLUMN email_sends.language IS 'Language used for this email based on supplier country';
COMMENT ON COLUMN email_sends.reply_language IS 'Detected language of supplier reply';
