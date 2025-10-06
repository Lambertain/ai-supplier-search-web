import { query } from './client.js';
import { DEFAULT_SETTINGS } from '../storage/defaultSettings.js';

export async function runMigrations() {
  await query(
    `CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
      INSERT INTO app_settings (id, data)
      VALUES (1, $1::jsonb)
      ON CONFLICT (id) DO NOTHING;`,
    [JSON.stringify(DEFAULT_SETTINGS)]
  );

  await query(`
    CREATE TABLE IF NOT EXISTS searches (
      search_id TEXT PRIMARY KEY,
      product_description TEXT NOT NULL,
      target_price TEXT,
      quantity TEXT,
      additional_requirements TEXT,
      operator TEXT,
      status TEXT,
      started_at TIMESTAMP WITHOUT TIME ZONE,
      completed_at TIMESTAMP WITHOUT TIME ZONE,
      suppliers_requested INTEGER,
      suppliers_validated INTEGER,
      emails_sent INTEGER,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      search_id TEXT REFERENCES searches(search_id) ON DELETE CASCADE,
      company_name TEXT,
      email TEXT,
      phone TEXT,
      country TEXT,
      city TEXT,
      website TEXT,
      manufacturing_capabilities TEXT,
      production_capacity TEXT,
      certifications TEXT,
      years_in_business TEXT,
      estimated_price_range TEXT,
      minimum_order_quantity TEXT,
      status TEXT,
      priority TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE,
      last_contact TIMESTAMP WITHOUT TIME ZONE,
      emails_sent INTEGER DEFAULT 0,
      emails_received INTEGER DEFAULT 0,
      last_response_date TIMESTAMP WITHOUT TIME ZONE,
      notes TEXT,
      conversation_history JSONB,
      metadata JSONB,
      thread_id TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS search_logs (
      id BIGSERIAL PRIMARY KEY,
      search_id TEXT REFERENCES searches(search_id) ON DELETE CASCADE,
      level TEXT,
      message TEXT NOT NULL,
      context JSONB,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS email_sends (
      id BIGSERIAL PRIMARY KEY,
      search_id TEXT REFERENCES searches(search_id) ON DELETE CASCADE,
      supplier_id TEXT REFERENCES suppliers(id) ON DELETE CASCADE,
      status TEXT,
      error TEXT,
      sent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);
}
