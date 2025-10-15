# AI Supplier Search Web App

This project replicates the n8n workflow **supplier_search_sendgrid_production** as a web application that can be deployed to Railway. It offers two simple pages:

- **Search**: launch supplier search jobs and inspect recent executions.
- **Settings**: manage search parameters, prompt templates, notification preferences, and email sender data.

The backend mirrors the original workflow steps:

1. **Validate input, build prompts, and call OpenAI for supplier discovery.**
2. Filter suppliers against strict business criteria and persist results in **PostgreSQL database**.
3. Generate personalised outreach emails with OpenAI and deliver them via SendGrid.
4. **Queue emails for background processing** using Bull Queue with Redis.
5. Log send status, store conversation history, and optionally auto-reply to inbound supplier emails.
6. Send completion notifications and expose history through the API for monitoring.

## 🔍 Real Supplier Discovery with OpenAI Web Search

This application uses OpenAI's **gpt-4o-search-preview** model with web search capabilities to find **REAL suppliers from the internet**, not hallucinated data.

### How Web Search Works

**Technical Implementation:**
- Model: `gpt-4o-search-preview` (latest: gpt-4o-search-preview-2025-03-11)
- API Endpoint: `/v1/chat/completions` with `web_search_options`
- Configuration: `search_context_size: 'high'` for maximum accuracy
- Location: `src/services/openaiService.js` (`chatCompletionWithWebSearch` function)

**What It Does:**
1. Receives your product description and requirements
2. Searches the internet for actual manufacturers and suppliers
3. Extracts verified business information (company names, emails, websites)
4. Returns structured JSON data for validation and outreach

### Regional Search Support

The app supports geotargeted supplier searches through intelligent prompt engineering:

**Supported Regions:**
- **China** (`preferredRegion: 'china'`) - Focuses on Shenzhen, Guangzhou, Dongguan, Shanghai manufacturing hubs
- **Asia** (`preferredRegion: 'asia'`) - East Asia (China, Taiwan, South Korea, Japan) + Southeast Asia
- **Europe** (`preferredRegion: 'europe'`) - Western and Eastern European manufacturers
- **USA** (`preferredRegion: 'usa'`) - US and North American suppliers
- **Global** (`preferredRegion: 'global'`) - Worldwide search without geographic restrictions

**How It Works:**
- Geographic priorities are embedded in the system prompts (`promptService.js`)
- Each region has specific city/country targeting instructions for OpenAI
- Accepts region-appropriate business email providers (e.g., Chinese QQ/163/126 emails for Asia)

### Example Search Request

```json
{
  "productDescription": "Ceramic coffee mugs with custom logo printing",
  "quantity": "5000 pieces per month",
  "targetPrice": "$2.50",
  "additionalRequirements": "Food-safe certification, dishwasher safe",
  "preferredRegion": "china",
  "minSuppliers": 3,
  "maxSuppliers": 5
}
```

### Testing Web Search

**Unit Tests:**
```bash
node test-web-search-unit.js
```

**Integration Test (Railway Production):**
```bash
node test-real-search.js
```

**Requirements:**
- `OPENAI_API_KEY` must be set in `.env` for local testing
- Web search API calls may take 15-30 seconds due to internet search + AI processing
- Rate limits: Respects OpenAI API rate limits with automatic retry logic

## Tech stack

- **Node.js 20+** with native ES modules
- **Express** for the HTTP API and static frontend
- **PostgreSQL** for data persistence with migrations
- **Bull Queue** for background email processing with Redis
- **Winston** for structured logging and error tracking
- **Zod** for input validation and type-safe data schemas
- **SendGrid SDK** (@sendgrid/mail) for transactional email
- **OpenAI API** integration with web search capabilities (gpt-4o-search-preview)
- **Rate limiting** with express-rate-limit for API protection
- Vanilla HTML/JS frontend delivered from /public

## Project layout

```
Development/projects/suppler-serch/
├─ src/
│  ├─ server.js                # Express app entry point
│  ├─ config/                  # Application configuration constants
│  ├─ db/
│  │  ├─ migrations/           # PostgreSQL schema migrations
│  │  └─ index.js              # Database connection and query helper
│  ├─ routes/                  # REST API and webhook endpoints
│  ├─ services/                # OpenAI, SendGrid, workflow orchestration
│  ├─ storage/                 # PostgreSQL-backed stores for settings and searches
│  ├─ queues/                  # Bull Queue for background email processing
│  ├─ middleware/              # Validation, rate limiting, request ID middleware
│  └─ utils/                   # Validation helpers, templating, metrics
├─ public/                     # Two-page frontend (search + settings)
├─ .env.example                # Required environment variables
├─ package.json
└─ README.md (this file)
```

## Getting started locally

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local installation or Docker)
- Redis 6+ (required for Bull Queue - local installation or Docker)

### Setup Steps

1. **Install dependencies:**

   ```bash
   cd Development/projects/suppler-serch
   npm install
   ```

2. **Setup PostgreSQL database:**

   ```bash
   # Option 1: Using Docker (recommended)
   docker run --name supplier-search-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:14

   # Option 2: Use existing PostgreSQL installation
   createdb supplier_search
   ```

3. **Setup Redis (for Bull Queue):**

   ```bash
   # Option 1: Using Docker (recommended)
   docker run --name supplier-search-redis -p 6379:6379 -d redis:6-alpine

   # Option 2: Use existing Redis installation
   redis-server
   ```

4. **Configure environment variables:**

   Copy `.env.example` to `.env` and add:

   ```env
   # Required
   OPENAI_API_KEY=your_openai_key_here
   SENDGRID_API_KEY=your_sendgrid_key_here

   # Database
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supplier_search

   # Redis (for Bull Queue)
   REDIS_URL=redis://localhost:6379

   # Optional overrides
   FROM_EMAIL=your@email.com
   FROM_NAME=Your Name
   REPLY_TO=reply@yourdomain.com
   SENDGRID_COMPLETION_EMAIL=notifications@yourdomain.com
   ```

5. **Run database migrations:**

   ```bash
   # Migrations run automatically on server start
   # Or manually with: node src/db/index.js
   ```

6. **Start the development server:**

   ```bash
   npm run dev
   ```

   The UI is available at [http://localhost:3000](http://localhost:3000). Launch searches from the **Search** page and adjust configs in **Settings**.

## Deploying to Railway

1. Push this project to Git.
2. Create a new Railway project and point it at the repository.
3. Railway autodetects `npm install` / `npm start`. If you prefer, add a Procfile containing `web: npm start`.
4. **Add PostgreSQL and Redis services** in Railway dashboard:
   - PostgreSQL plugin with automatic DATABASE_URL provisioning
   - Redis plugin with automatic REDIS_URL provisioning
5. Set required environment variables in Railway:
   - OPENAI_API_KEY
   - SENDGRID_API_KEY
   - (optional) FROM_EMAIL, FROM_NAME, REPLY_TO, SENDGRID_COMPLETION_EMAIL
6. Deploy. Database migrations run automatically on startup.

### Webhooks

- Configure Gmail / SendGrid inbound webhooks to `https://<railway-domain>/api/webhooks/inbound` for supplier replies.
- SendGrid event webhooks can be pointed at `https://<railway-domain>/api/webhooks/sendgrid-events` for delivery analytics.

## Architecture Highlights

### Database Schema
- **app_settings** - Configuration storage with JSONB data field
- **searches** - Search execution records with metadata
- **suppliers** - Discovered supplier details with contact info
- **email_history** - Email send tracking with status and timestamps
- **background_job_log** - Bull Queue job execution logs

### Background Processing
- **Bull Queue** with Redis for reliable email delivery
- Automatic retry logic for failed sends
- Job priority levels (high/normal/low)
- Concurrent worker processing with configurable concurrency

### API Endpoints
- `POST /api/search` - Execute supplier search
- `GET /api/searches` - Retrieve search history
- `GET /api/searches/:id` - Get specific search details
- `PUT /api/settings` - Update configuration
- `GET /api/settings` - Get current settings
- `POST /api/webhooks/inbound` - Inbound email webhook
- `POST /api/webhooks/sendgrid-events` - SendGrid event tracking
- `GET /api/health` - Health check with database status

## Production Recommendations

### ✅ Already Implemented
- PostgreSQL database with migrations
- Bull Queue for background processing
- Winston structured logging
- Zod input validation
- Rate limiting protection
- Health check endpoints

### 📋 Next Steps

1. **API Documentation**
   - Add OpenAPI/Swagger specification for all endpoints
   - Interactive API documentation UI

2. **CI/CD Pipeline**
   - GitHub Actions workflow with automated testing
   - Deployment automation with test gates
   - Pre-commit hooks for code quality

3. **Monitoring & Alerting**
   - Sentry integration for error tracking
   - Centralized logging (Logtail/Papertrail)
   - Bull Board dashboard for queue monitoring
   - Production alerts for critical metrics

4. **Database Backups**
   - Automated daily PostgreSQL backups
   - Retention policy and recovery procedures
   - Backup validation testing

5. **Security Audit**
   - Production deployment security review
   - Penetration testing
   - Secrets management validation

6. **Advanced Features**
   - Frontend pagination and filtering
   - Real-time search progress updates
   - Multi-language supplier email support
   - Advanced analytics dashboard
