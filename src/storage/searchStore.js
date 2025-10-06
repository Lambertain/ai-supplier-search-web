import { query, withTransaction } from '../db/client.js';

function mapSearchRow(row) {
  if (!row) return null;
  return {
    searchId: row.search_id,
    productDescription: row.product_description,
    targetPrice: row.target_price,
    quantity: row.quantity,
    additionalRequirements: row.additional_requirements,
    operator: row.operator,
    status: row.status,
    startedAt: row.started_at?.toISOString?.() || row.started_at,
    completedAt: row.completed_at?.toISOString?.() || row.completed_at,
    metrics: {
      suppliersRequested: row.suppliers_requested,
      suppliersValidated: row.suppliers_validated,
      emailsSent: row.emails_sent
    },
    createdAt: row.created_at?.toISOString?.() || row.created_at
  };
}

function mapSupplierRow(row) {
  return {
    id: row.id,
    search_id: row.search_id,
    company_name: row.company_name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    city: row.city,
    website: row.website,
    manufacturing_capabilities: row.manufacturing_capabilities,
    production_capacity: row.production_capacity,
    certifications: row.certifications,
    years_in_business: row.years_in_business,
    estimated_price_range: row.estimated_price_range,
    minimum_order_quantity: row.minimum_order_quantity,
    status: row.status,
    priority: row.priority,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    last_contact: row.last_contact?.toISOString?.() || row.last_contact,
    emails_sent: row.emails_sent,
    emails_received: row.emails_received,
    last_response_date: row.last_response_date?.toISOString?.() || row.last_response_date,
    notes: row.notes,
    conversation_history: row.conversation_history || [],
    metadata: row.metadata || {},
    thread_id: row.thread_id
  };
}

export async function listSearches() {
  const { rows } = await query(
    'SELECT * FROM searches ORDER BY started_at DESC NULLS LAST, created_at DESC LIMIT 100'
  );
  return rows.map(mapSearchRow);
}

export async function getSearch(searchId) {
  const searchResult = await query('SELECT * FROM searches WHERE search_id = $1', [searchId]);
  if (searchResult.rows.length === 0) {
    return null;
  }
  const search = mapSearchRow(searchResult.rows[0]);
  const suppliersResult = await query('SELECT * FROM suppliers WHERE search_id = $1 ORDER BY created_at', [searchId]);
  const logsResult = await query(
    'SELECT id, level, message, context, created_at FROM search_logs WHERE search_id = $1 ORDER BY created_at',
    [searchId]
  );
  return {
    ...search,
    suppliers: suppliersResult.rows.map(mapSupplierRow),
    logs: logsResult.rows.map((row) => ({
      id: String(row.id),
      timestamp: row.created_at?.toISOString?.() || row.created_at,
      level: row.level,
      message: row.message,
      context: row.context
    }))
  };
}

export async function createSearchRecord(payload) {
  const { rows } = await query(
    `INSERT INTO searches (
      search_id,
      product_description,
      target_price,
      quantity,
      additional_requirements,
      operator,
      status,
      started_at,
      suppliers_requested,
      suppliers_validated,
      emails_sent
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *`.
      replace(/\s+\n/g, ' \n'),
    [
      payload.searchId,
      payload.productDescription,
      payload.targetPrice,
      payload.quantity,
      payload.additionalRequirements,
      payload.operator || 'AI_Agent',
      'processing',
      payload.startedAt,
      payload.suppliersRequested || 0,
      0,
      0
    ]
  );
  return mapSearchRow(rows[0]);
}

export async function addSuppliersToSearch(searchId, suppliers) {
  if (!suppliers.length) return;
  await withTransaction(async (client) => {
    for (const supplier of suppliers) {
      await client.query(
        `INSERT INTO suppliers (
          id, search_id, company_name, email, phone, country, city, website,
          manufacturing_capabilities, production_capacity, certifications,
          years_in_business, estimated_price_range, minimum_order_quantity,
          status, priority, created_at, last_contact, emails_sent, emails_received,
          last_response_date, notes, conversation_history, metadata, thread_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
        ) ON CONFLICT (id) DO NOTHING`,
        [
          supplier.id,
          searchId,
          supplier.company_name,
          supplier.email,
          supplier.phone,
          supplier.country,
          supplier.city,
          supplier.website,
          supplier.manufacturing_capabilities,
          supplier.production_capacity,
          supplier.certifications,
          supplier.years_in_business,
          supplier.estimated_price_range,
          supplier.minimum_order_quantity,
          supplier.status,
          supplier.priority,
          supplier.created_at,
          supplier.last_contact || null,
          supplier.emails_sent || 0,
          supplier.emails_received || 0,
          supplier.last_response_date || null,
          supplier.notes || '',
          JSON.stringify(supplier.conversation_history || []),
          JSON.stringify(supplier.metadata || {}),
          supplier.thread_id
        ]
      );
    }
    await client.query(
      `UPDATE searches
       SET suppliers_validated = (SELECT COUNT(*) FROM suppliers WHERE search_id = $1)
       WHERE search_id = $1`,
      [searchId]
    );
  });
}

export async function updateSupplier(searchId, supplierId, updater) {
  const { rows } = await query('SELECT * FROM suppliers WHERE id = $1 AND search_id = $2', [
    supplierId,
    searchId
  ]);
  if (rows.length === 0) {
    throw new Error(`Supplier ${supplierId} not found in search ${searchId}`);
  }
  const current = mapSupplierRow(rows[0]);
  const next = updater({ ...current });
  const updated = { ...current, ...next };
  await query(
    `UPDATE suppliers SET
      company_name = $1,
      email = $2,
      phone = $3,
      country = $4,
      city = $5,
      website = $6,
      manufacturing_capabilities = $7,
      production_capacity = $8,
      certifications = $9,
      years_in_business = $10,
      estimated_price_range = $11,
      minimum_order_quantity = $12,
      status = $13,
      priority = $14,
      last_contact = $15,
      emails_sent = $16,
      emails_received = $17,
      last_response_date = $18,
      notes = $19,
      conversation_history = $20::jsonb,
      metadata = $21::jsonb,
      thread_id = $22
    WHERE id = $23`,
    [
      updated.company_name,
      updated.email,
      updated.phone,
      updated.country,
      updated.city,
      updated.website,
      updated.manufacturing_capabilities,
      updated.production_capacity,
      updated.certifications,
      updated.years_in_business,
      updated.estimated_price_range,
      updated.minimum_order_quantity,
      updated.status,
      updated.priority,
      updated.last_contact,
      updated.emails_sent || 0,
      updated.emails_received || 0,
      updated.last_response_date,
      updated.notes,
      JSON.stringify(updated.conversation_history || []),
      JSON.stringify(updated.metadata || {}),
      updated.thread_id,
      supplierId
    ]
  );

  await query(
    `UPDATE searches
     SET suppliers_validated = (SELECT COUNT(*) FROM suppliers WHERE search_id = $1),
         emails_sent = (SELECT COALESCE(SUM(emails_sent),0) FROM suppliers WHERE search_id = $1)
     WHERE search_id = $1`,
    [searchId]
  );

  return updated;
}

export async function appendLog(searchId, entry) {
  const { rows } = await query(
    `INSERT INTO search_logs (search_id, level, message, context)
     VALUES ($1,$2,$3,$4::jsonb)
     RETURNING id, created_at`,
    [searchId, entry.level || 'info', entry.message, JSON.stringify(entry.context || null)]
  );
  return {
    id: String(rows[0].id),
    timestamp: rows[0].created_at?.toISOString?.() || rows[0].created_at,
    level: entry.level || 'info',
    message: entry.message,
    context: entry.context || null
  };
}

export async function finalizeSearch(searchId, status, extra = {}) {
  const { rows } = await query(
    `UPDATE searches
     SET status = $1,
         completed_at = NOW(),
         suppliers_validated = COALESCE($2, suppliers_validated),
         emails_sent = COALESCE($3, emails_sent)
     WHERE search_id = $4
     RETURNING *`,
    [
      status,
      extra.metrics?.suppliersValidated,
      extra.metrics?.emailsSent,
      searchId
    ]
  );
  if (rows.length === 0) {
    throw new Error(`Search ${searchId} not found`);
  }
  return mapSearchRow(rows[0]);
}

export async function findSupplierByEmail(email) {
  const value = String(email || '').toLowerCase().trim();
  if (!value) return null;
  const { rows } = await query(
    `SELECT s.*, c.*
     FROM suppliers s
     JOIN searches c ON c.search_id = s.search_id
     WHERE LOWER(s.email) = $1
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [value]
  );
  if (!rows.length) return null;
  const supplier = mapSupplierRow(rows[0]);
  const search = mapSearchRow(rows[0]);
  return { search, supplier };
}

export async function listSuppliersForSearch(searchId) {
  const { rows } = await query('SELECT * FROM suppliers WHERE search_id = $1 ORDER BY created_at DESC', [searchId]);
  return rows.map(mapSupplierRow);
}

export async function listSuppliersWithSearch(limit = 200) {
  const { rows } = await query(
    `SELECT s.*, c.product_description, c.started_at
     FROM suppliers s
     JOIN searches c ON c.search_id = s.search_id
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({
    ...mapSupplierRow(row),
    product_description: row.product_description,
    search_started_at: row.started_at?.toISOString?.() || row.started_at
  }));
}

export async function deleteSupplier(searchId, supplierId) {
  await query('DELETE FROM suppliers WHERE id = $1 AND search_id = $2', [supplierId, searchId]);
  await query(
    `UPDATE searches
     SET suppliers_validated = (SELECT COUNT(*) FROM suppliers WHERE search_id = $1),
         emails_sent = (SELECT COALESCE(SUM(emails_sent),0) FROM suppliers WHERE search_id = $1)
     WHERE search_id = $1`,
    [searchId]
  );
}

export async function deleteSupplierById(supplierId) {
  const { rows } = await query('DELETE FROM suppliers WHERE id = $1 RETURNING search_id', [supplierId]);
  if (!rows.length) {
    return;
  }
  const searchId = rows[0].search_id;
  await query(
    `UPDATE searches
     SET suppliers_validated = (SELECT COUNT(*) FROM suppliers WHERE search_id = $1),
         emails_sent = (SELECT COALESCE(SUM(emails_sent),0) FROM suppliers WHERE search_id = $1)
     WHERE search_id = $1`,
    [searchId]
  );
}

export async function recordEmailSend({ searchId, supplierId, status, error }) {
  await query(
    `INSERT INTO email_sends (search_id, supplier_id, status, error)
     VALUES ($1,$2,$3,$4)` ,
    [searchId, supplierId, status, error || null]
  );
}

export async function countEmailsSentSince(date) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM email_sends WHERE sent_at >= $1 AND status = $2',
    [date, 'sent']
  );
  return rows[0]?.count || 0;
}

export async function getLastEmailSend() {
  const { rows } = await query(
    'SELECT sent_at FROM email_sends WHERE status = $1 ORDER BY sent_at DESC LIMIT 1',
    ['sent']
  );
  if (!rows.length) return null;
  return rows[0].sent_at;
}






