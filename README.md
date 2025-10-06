# AI Supplier Search Web App

This project replicates the n8n workflow **supplier_search_sendgrid_production** as a web application that can be deployed to Railway. It offers two simple pages:

- **Search**: launch supplier search jobs and inspect recent executions.
- **Settings**: manage search parameters, prompt templates, notification preferences, and email sender data.

The backend mirrors the original workflow steps:

1. Validate input, build prompts, and call OpenAI for supplier discovery.
2. Filter suppliers against strict business criteria and persist results in JSON storage.
3. Generate personalised outreach emails with OpenAI and deliver them via SendGrid.
4. Log send status, store conversation history, and optionally auto-reply to inbound supplier emails.
5. Send completion notifications and expose history through the API for monitoring.

## Tech stack

- Node.js 18+ with native ES modules
- Express for the HTTP API and static frontend
- SendGrid SDK (@sendgrid/mail) for transactional email
- Fetch-based OpenAI integration targeting the Chat Completions API
- Simple JSON file persistence (can be swapped for a database later)
- Vanilla HTML/JS frontend delivered from /public

## Project layout

`
Development/projects/suppler-serch/
├─ src/
│  ├─ server.js                # Express app entry point
│  ├─ routes/                  # REST and webhook endpoints
│  ├─ services/                # OpenAI, SendGrid, workflow orchestration
│  ├─ storage/                 # JSON-backed stores for settings and searches
│  └─ utils/                   # Validation helpers and templating
├─ public/                     # Two-page frontend (search + settings)
├─ data/                       # settings.json / searches.json persistence
├─ .env.example                # Required environment variables
├─ package.json
└─ README.md (this file)
`

## Getting started locally

1. Install dependencies:

   `ash
   cd Development/projects/suppler-serch
   npm install
   `

2. Copy .env.example to .env and add:

   - OPENAI_API_KEY
   - SENDGRID_API_KEY
   - Optional overrides for FROM_EMAIL, FROM_NAME, REPLY_TO, etc.

3. Run the app:

   `ash
   npm run dev
   `

   The UI is available at [http://localhost:3000](http://localhost:3000). Launch searches from the **Search** page and adjust configs in **Settings**.

## Deploying to Railway

1. Push this project to Git.
2. Create a new Railway project and point it at the repository.
3. Railway autodetects 
pm install / 
pm start. If you prefer, add a Procfile containing web: npm start.
4. Set required environment variables in Railway:

   - OPENAI_API_KEY
   - SENDGRID_API_KEY
   - (optional) FROM_EMAIL, FROM_NAME, REPLY_TO, SENDGRID_COMPLETION_EMAIL

5. Deploy. The service exposes /api/* endpoints and static pages.

### Webhooks

- Configure Gmail / SendGrid inbound webhooks to https://<railway-domain>/api/webhooks/inbound for supplier replies.
- SendGrid event webhooks can be pointed at https://<railway-domain>/api/webhooks/sendgrid-events for delivery analytics.

## Notes & next steps

- JSON storage suits small pilots; for production connect searchStore to PostgreSQL or Redis.
- Add background job processing if OpenAI + SendGrid calls need decoupling or retries.
- Extend the frontend with pagination and richer supplier detail inspectors.
- Consider attaching authentication if the UI is exposed beyond internal stakeholders.
