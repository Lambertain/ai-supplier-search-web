# Google Custom Search API Setup Guide

This guide explains how to set up Google Custom Search API for the Supplier Search application.

## Why Google Search API?

**Problem:** The previous implementation used GPT-4o which **hallucinated** supplier information - inventing company names, emails, and contact details that didn't exist.

**Solution:** Google Custom Search API + GPT structuring
- Google Search provides **REAL** search results from the internet
- GPT is used **ONLY** for structuring/processing Google results
- **Zero hallucinations** - all suppliers are real companies from Google

## Architecture

```
Old (❌ Hallucinations):
GPT-4o → Invents suppliers → Fake companies

New (✅ Real Results):
Google Search → Real suppliers → GPT structures → Validated companies
```

## Setup Instructions

### Step 1: Get Google API Key

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Click **"Create Credentials"** → **"API Key"**
4. Copy the API key
5. (Optional) Restrict the API key to "Custom Search API" only

### Step 2: Create Programmable Search Engine

1. Go to [Programmable Search Engine Control Panel](https://programmablesearchengine.google.com/controlpanel/all)
2. Click **"Add"** to create a new search engine
3. Configure:
   - **Sites to search:** Leave empty or add "*" to search the entire web
   - **Name:** "Supplier Search Engine" (or any name)
   - **Search features:** Enable "Search the entire web"
4. Click **"Create"**
5. Copy the **Search Engine ID** (looks like: `a1b2c3d4e5f6g7h8i`)

### Step 3: Enable Custom Search API

1. Go to [Google Cloud Console - APIs & Services](https://console.cloud.google.com/apis/library)
2. Search for **"Custom Search API"**
3. Click **"Enable"**

### Step 4: Configure Environment Variables

Add to your `.env` file:

```env
GOOGLE_API_KEY=your-api-key-here
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id-here
```

Example:
```env
GOOGLE_API_KEY=AIzaSyAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq
GOOGLE_SEARCH_ENGINE_ID=a1b2c3d4e5f6g7h8i
```

## Pricing & Limits

### Free Tier
- **100 queries/day** at no cost
- Perfect for testing and small-scale usage

### Paid Tier
- **$5 per 1,000 queries**
- Up to **10,000 queries/day** maximum
- Billing starts after free 100 queries/day

### Cost Examples
- 500 queries/day = $2/day (~$60/month)
- 1,000 queries/day = $4.50/day (~$135/month)
- 5,000 queries/day = $24.50/day (~$735/month)

## Testing the Setup

Run this test command to verify your credentials:

```bash
curl "https://www.googleapis.com/customsearch/v1?key=YOUR_API_KEY&cx=YOUR_SEARCH_ENGINE_ID&q=test"
```

Expected response: JSON with search results

## Troubleshooting

### Error: "API key not valid"
- Check that the API key is copied correctly
- Ensure Custom Search API is enabled in Google Cloud Console
- Verify API key restrictions allow Custom Search API

### Error: "Invalid Value" for cx parameter
- Check that Search Engine ID is copied correctly
- Verify the search engine is created in Programmable Search Engine Control Panel

### No results returned
- Ensure "Search the entire web" is enabled in search engine settings
- Check that the query is not too restrictive

## Monitoring Usage

Track your Google Search API usage:

1. Go to [Google Cloud Console - API Dashboard](https://console.cloud.google.com/apis/dashboard)
2. Filter by service: `customsearch.googleapis.com`
3. View:
   - Daily request count
   - Error rates
   - Quota usage

Set up alerts to notify you when approaching quota limits.

## Security Best Practices

1. **Never commit API keys to git** - always use environment variables
2. **Restrict API key** - limit to Custom Search API only
3. **Set IP restrictions** - allow only your server's IP addresses
4. **Rotate keys regularly** - change API keys every 90 days
5. **Monitor usage** - set up alerts for unusual activity

## Support

If you encounter issues:
1. Check [Google Custom Search API Documentation](https://developers.google.com/custom-search/v1/overview)
2. Review [API Status Dashboard](https://status.cloud.google.com/)
3. Open an issue in this repository

---

**Version:** 1.0
**Last Updated:** 2025-10-21
**Author:** Archon Implementation Engineer
