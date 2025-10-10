# Database Migrations

## Overview

This directory contains database schema migrations for the Supplier Search application. Migrations are automatically applied on application startup and can also be run manually.

## Structure

- `migrations/` - SQL migration files (numbered sequentially)
- `client.js` - PostgreSQL connection pool with pg-mem fallback
- `migrate.js` - Migration runner that tracks and applies migrations
- `migrations.js` - Wrapper called by server.js on startup

## Migration Files

Migration files are named with a numeric prefix and descriptive name:
- `001_initial_schema.sql` - Initial database schema
- `002_add_feature.sql` - Add new feature (example)

## Running Migrations

### Automatic (on app startup)

Migrations run automatically when the application starts:

```bash
npm start
```

### Manual

Run migrations manually using the migration runner:

```bash
node src/db/migrate.js
```

## Database Tables

### searches
Search jobs initiated by users with AI-driven supplier discovery.

### suppliers
Supplier companies discovered during searches with contact information.
- Includes `language` field for multilingual email generation

### email_sends
Email outreach attempts with tracking of sends, failures, and replies.
- Tracks `language` used for each email
- Stores reply information and detected `reply_language`

### app_settings
Application-wide configuration and user preferences (singleton table).

### conversation_history
Complete email conversation threads with suppliers.

## Environment Variables

Required for PostgreSQL connection:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
```

Optional:
- `DB_POOL_MAX` - Maximum pool size (default: 20)
- `DB_POOL_IDLE_TIMEOUT` - Idle timeout in ms (default: 30000)
- `DB_POOL_CONNECTION_TIMEOUT` - Connection timeout in ms (default: 2000)
- `NODE_ENV` - Set to 'production' for Railway deployment

## Local Development

For local development without PostgreSQL:
- Leave `DATABASE_URL` unset
- The app will use in-memory pg-mem database
- Data will be lost on restart

## Railway Deployment

1. Add PostgreSQL database in Railway dashboard
2. Railway automatically sets `DATABASE_URL` environment variable
3. Migrations run automatically on first deployment
4. Data persists between container restarts

## Creating New Migrations

1. Create a new SQL file in `migrations/` directory:
   ```
   002_add_feature.sql
   ```

2. Write SQL commands:
   ```sql
   ALTER TABLE suppliers ADD COLUMN new_field VARCHAR(255);
   CREATE INDEX idx_suppliers_new_field ON suppliers(new_field);
   ```

3. Migrations are applied in alphabetical order
4. Already-applied migrations are tracked in `schema_migrations` table

## Troubleshooting

### Migration fails on startup

Check logs for specific error message:
```bash
[migrate] Migration process failed: ...
```

### Reset database (development only)

If using pg-mem (no DATABASE_URL), simply restart the app.

For PostgreSQL, manually drop tables and restart:
```sql
DROP TABLE IF EXISTS schema_migrations CASCADE;
DROP TABLE IF EXISTS conversation_history CASCADE;
DROP TABLE IF EXISTS email_sends CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS searches CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
```

Then restart the application to re-run migrations.

## Migration Tracking

The `schema_migrations` table tracks applied migrations:

```sql
SELECT * FROM schema_migrations ORDER BY applied_at;
```

This prevents duplicate application of migrations.
