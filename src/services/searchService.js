import { nanoid } from 'nanoid';
import { z } from 'zod';
import { buildSupplierSearchMessages, buildEmailWriterMessages } from './promptService.js';
import { chatCompletionJson, chatCompletionWithWebSearch } from './openaiService.js';
import { prepareSendGridEmail, sendSummaryEmail } from './sendgridService.js';
import { validateSearchRequest, isBusinessEmail, normalizeWebsite, sanitizeString } from '../utils/validation.js';
import { filterSuppliersByWebsite } from '../utils/websiteValidator.js';
import { verifySupplierContacts } from '../utils/contactVerifier.js';
import { renderTemplate } from '../utils/template.js';
import { renderSpintax } from '../utils/spintax.js';
import { queueEmail, getDailyEmailStats } from '../queues/emailQueue.js';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../utils/messages.js';
import { OPENAI_MODELS, MAX_TOKENS, TEMPERATURE } from '../config/constants.js';
import { getLanguageForCountry } from '../utils/languageMap.js';
import { recordSearch, recordEmail } from '../utils/metrics.js';
import {
  createSearchRecord,
  addSuppliersToSearch,
  updateSupplier,
  appendLog,
  finalizeSearch,
  recordEmailSend,
  countEmailsSentSince,
  getLastEmailSend
} from '../storage/searchStore.js';

// Zod схема для валидации поставщика
// Note: OpenAI returns typed data, but we store as strings in the database
const SupplierSchema = z.object({
  company_name: z.string()
    .min(1, 'Company name is required')
    .refine(
      (name) => /\b(ltd|inc|corp|co|company|manufacturing|factory|group|industries)\b/i.test(name),
      'Company name must contain business entity identifier (Ltd, Inc, Corp, etc.)'
    ),
  email: z.string()
    .email('Invalid email format')
    .refine(
      (email) => isBusinessEmail(email),
      'Email must be a business email (no Gmail, Outlook, Yahoo, etc.)'
    ),
  country: z.string().min(1, 'Country is required'),
  website: z.string()
    .optional()
    .refine(
      (website) => !website || /^https?:\/\//i.test(website) || /\./.test(website),
      'Website must be a valid URL or domain'
    ),
  city: z.string().optional(),
  phone: z.string().optional(),
  manufacturing_capabilities: z.string().optional(),
  capabilities: z.string().optional(),
  production_capacity: z.string().optional(),
  // OpenAI returns certifications as array of strings
  certifications: z.union([
    z.array(z.string()),
    z.string()
  ]).optional(),
  // OpenAI returns years_in_business as number
  years_in_business: z.union([
    z.number().nonnegative(),
    z.string()
  ]).optional(),
  estimated_price_range: z.string().optional(),
  // OpenAI returns minimum_order_quantity as number
  // Using nonnegative to allow 0 (some suppliers have no MOQ)
  minimum_order_quantity: z.union([
    z.number().int().nonnegative(),
    z.string()
  ]).optional()
});

function createSearchId() {
  return `SEARCH_${Date.now()}_${nanoid(6).toUpperCase()}`;
}

function createSupplierId(index) {
  return `SUP_${Date.now()}_${String(index + 1).padStart(3, '0')}`;
}

function mapSupplierCandidate(candidate, index, searchContext) {
  const timestamp = new Date().toISOString();

  // Helper function to convert OpenAI typed data to string for database storage
  const convertToString = (value) => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(', '); // Convert array to comma-separated string
    if (typeof value === 'number') return String(value); // Convert number to string
    return String(value);
  };

  return {
    id: createSupplierId(index),
    search_id: searchContext.searchId,
    company_name: sanitizeString(candidate.company_name || candidate.companyName || ''),
    email: sanitizeString(candidate.email || ''),
    phone: sanitizeString(candidate.phone || ''),
    country: sanitizeString(candidate.country || ''),
    city: sanitizeString(candidate.city || ''),
    website: normalizeWebsite(candidate.website || ''),
    manufacturing_capabilities: sanitizeString(candidate.manufacturing_capabilities || candidate.capabilities || ''),
    production_capacity: sanitizeString(candidate.production_capacity || ''),
    // Convert certifications array to comma-separated string
    certifications: sanitizeString(convertToString(candidate.certifications)),
    // Convert years_in_business number to string
    years_in_business: sanitizeString(convertToString(candidate.years_in_business)),
    estimated_price_range: sanitizeString(candidate.estimated_price_range || ''),
    // Convert minimum_order_quantity number to string
    minimum_order_quantity: sanitizeString(convertToString(candidate.minimum_order_quantity)),
    status: 'Pending Outreach',
    priority: index < 5 ? 'High' : 'Normal',
    created_at: timestamp,
    last_contact: '',
    emails_sent: 0,
    emails_received: 0,
    last_response_date: '',
    conversation_history: [],
    notes: '',
    metadata: {
      raw: candidate
    },
    thread_id: `thread_${searchContext.searchId}_${String(index + 1).padStart(3, '0')}`
  };
}

async function validateSuppliers(candidates, searchContext) {
  // Handle both array and object responses from OpenAI
  let supplierArray = candidates;

  if (!Array.isArray(candidates)) {
    // Try to extract array from common object keys
    if (candidates && typeof candidates === 'object') {
      supplierArray = candidates.suppliers || candidates.data || candidates.results || [];
    } else {
      throw new Error('OpenAI supplier output is not an array or valid object');
    }
  }

  if (!Array.isArray(supplierArray) || supplierArray.length === 0) {
    throw new Error('OpenAI supplier output does not contain valid suppliers array');
  }

  // Run Zod validation and capture detailed errors
  const validationResults = supplierArray.map((candidate, index) => {
    const result = SupplierSchema.safeParse(candidate);
    return {
      candidate,
      index,
      valid: result.success,
      errors: result.success ? null : result.error.flatten()
    };
  });

  // Log invalid suppliers for easier debugging
  const invalid = validationResults.filter(r => !r.valid);
  if (invalid.length > 0) {
    console.warn(`[Validation] ${invalid.length} suppliers failed schema validation:`);
    invalid.forEach((result) => {
      console.warn(`  Supplier ${result.index + 1}:`, {
        company_name: result.candidate.company_name || 'MISSING',
        email: result.candidate.email || 'MISSING',
        errors: result.errors.fieldErrors
      });
    });
  }

  // Keep only candidates that passed validation
  const schemaValid = validationResults
    .filter(r => r.valid)
    .map(r => r.candidate);

  if (!schemaValid.length) {
    const errorDetails = invalid.slice(0, 3).map(r => ({
      company: r.candidate.company_name || 'Unknown',
      errors: Object.entries(r.errors.fieldErrors).map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
    }));

    throw new Error(
      `No valid business suppliers found. All ${supplierArray.length} suppliers failed Zod validation.\n` +
      `First 3 failures:\n${JSON.stringify(errorDetails, null, 2)}`
    );
  }

  // Next safeguard: ensure supplier websites respond over HTTP(S)
  // If the entire batch fails here, continue with schema-valid results
  console.log('[Validation] Starting website accessibility validation...');
  const { valid: websiteValid, invalid: websiteInvalid } = await filterSuppliersByWebsite(schemaValid, true);

  if (websiteValid.length === 0) {
    console.warn('[Validation] WARNING: All suppliers have inaccessible websites, using schema-valid suppliers anyway');
    // When nothing passes the web check, return the schema-valid fallback
    // This keeps the workflow going while logging a warning
    const { maxSuppliers } = searchContext.settings.searchConfig;
    return schemaValid.slice(0, maxSuppliers).map((candidate, index) =>
      mapSupplierCandidate(candidate, index, searchContext)
    );
  }

  console.log(`[Validation] Website check results: ${websiteValid.length} accessible, ${websiteInvalid.length} inaccessible`);

  // Record suppliers rejected for web accessibility issues
  if (websiteInvalid.length > 0) {
    await appendLog(searchContext.searchId, {
      level: 'warn',
      message: `Rejected ${websiteInvalid.length} suppliers due to inaccessible websites`,
      context: {
        rejected: websiteInvalid.map(s => ({
          company: s.company_name,
          website: s.website,
          error: s.validation?.error
        }))
      }
    });
  }

  const verificationOptions = {
    concurrency: searchContext.settings.searchConfig?.contactVerificationConcurrency || 3,
    timeout: searchContext.settings.searchConfig?.contactVerificationTimeoutMs || 12000
  };

  console.log('[Validation] Starting on-site contact verification...');
  const { verified: contactVerified, rejected: contactRejected } = await verifySupplierContacts(
    websiteValid,
    verificationOptions
  );

  if (contactRejected.length > 0) {
    await appendLog(searchContext.searchId, {
      level: 'warn',
      message: `Rejected ${contactRejected.length} suppliers without verifiable on-site contact details`,
      context: {
        rejected: contactRejected.slice(0, 10).map((item) => ({
          company: item.supplier?.company_name || 'Unknown',
          website: item.supplier?.website || null,
          candidateEmail: item.evidence?.candidateEmail || null,
          reason: item.reason || 'Unknown'
        }))
      }
    });
  }

  if (!contactVerified.length) {
    throw new Error('No suppliers passed contact verification. All candidates lacked verifiable on-site emails.');
  }

  const { maxSuppliers, minSuppliers } = searchContext.settings.searchConfig;
  const finalSuppliers = contactVerified.slice(0, maxSuppliers).map((result, index) => {
    const mapped = mapSupplierCandidate(result.supplier, index, searchContext);
    mapped.metadata = {
      ...mapped.metadata,
      contactVerification: {
        status: result.status,
        evidence: result.evidence
      }
    };
    return mapped;
  });

  if (minSuppliers && finalSuppliers.length < minSuppliers) {
    await appendLog(searchContext.searchId, {
      level: 'warn',
      message: `Only ${finalSuppliers.length} suppliers passed strict verification (min requested ${minSuppliers})`,
      context: {
        requestedMin: minSuppliers,
        obtained: finalSuppliers.length
      }
    });
  }

  return finalSuppliers;
}

function composeEmailContent({ emailJson, settings, supplier, searchContext }) {
  const templates = settings.emailTemplates || {};
  const variables = {
    productDescription: searchContext.productDescription,
    product: searchContext.productDescription,
    supplierCompany: supplier.company_name || '',
    country: supplier.country || '',
    quantity: searchContext.quantity || '',
    targetPrice: searchContext.targetPrice || ''
  };

  let subject = emailJson.subject || 'Supplier Inquiry';
  if (templates.subjectTemplate) {
    subject = renderTemplate(templates.subjectTemplate, variables);
  }
  subject = renderSpintax(subject);

  const intro = templates.introTemplate
    ? renderSpintax(renderTemplate(templates.introTemplate, variables))
    : '';
  const aiBody = renderSpintax(emailJson.body || '');
  const closing = templates.closingTemplate
    ? renderSpintax(renderTemplate(templates.closingTemplate, variables))
    : '';
  const footer = templates.footerTemplate
    ? renderSpintax(renderTemplate(templates.footerTemplate, variables))
    : '';

  const bodyParts = [intro, aiBody, closing, footer].filter(Boolean);
  const finalBody = bodyParts.join('\n\n');

  return {
    subject,
    body: finalBody || aiBody,
    aiSubject: emailJson.subject,
    aiBody: emailJson.body
  };
}

async function enforceSendgridPolicy({ settings, searchId }) {
  const policy = settings.sendgridPolicy || {};

  if (policy.dailyLimit) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const sentToday = await countEmailsSentSince(since.toISOString());
    if (sentToday >= policy.dailyLimit) {
      await appendLog(searchId, {
        level: 'warn',
        message: LOG_MESSAGES.DAILY_LIMIT_WARNING(policy.dailyLimit, sentToday),
        context: { dailyLimit: policy.dailyLimit, sentToday }
      });
      throw new Error(ERROR_MESSAGES.DAILY_LIMIT_REACHED);
    }
  }

  if (policy.sendIntervalSeconds) {
    const lastSent = await getLastEmailSend();
    if (lastSent) {
      const elapsed = Date.now() - new Date(lastSent).getTime();
      const waitMs = policy.sendIntervalSeconds * 1000 - elapsed;
      if (waitMs > 0) {
        const waitSeconds = Math.ceil(waitMs / 1000);
        await appendLog(searchId, {
          message: LOG_MESSAGES.RATE_LIMIT_WAIT(waitSeconds),
          context: { waitSeconds }
        });
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
}

async function generateEmailForSupplier({ supplier, settings, searchContext, abortSignal }) {
  // Determine language based on supplier's country
  const language = getLanguageForCountry(supplier.country);

  const messages = buildEmailWriterMessages(settings, supplier, searchContext, language);
  const emailJson = await chatCompletionJson({
    model: OPENAI_MODELS.EMAIL,
    messages,
    temperature: TEMPERATURE.EMAIL,
    maxTokens: MAX_TOKENS.EMAIL,
    signal: abortSignal,
    apiKey: settings.apiKeys?.openai || process.env.OPENAI_API_KEY
  });
  if (!emailJson.subject || !emailJson.body) {
    throw new Error('Email writer prompt did not return subject/body');
  }

  const emailContent = composeEmailContent({ emailJson, settings, supplier, searchContext });

  // Attach language to email content for tracking
  return {
    ...emailContent,
    language
  };
}

async function queueEmailForSupplier({ supplier, emailContent, settings, searchContext }) {
  const batchInfo = {
    current: searchContext.batchIndex + 1,
    total: searchContext.totalSuppliers
  };
  const prepared = prepareSendGridEmail({ supplier, emailContent, settings, searchContext, batchInfo });

  const job = await queueEmail({
    prepared,
    searchId: searchContext.searchId,
    supplierId: supplier.id,
    priority: supplier.priority === 'High' ? 1 : 3
  });

  return job;
}

export async function runSupplierSearch(payload, settings, { signal } = {}) {
  const input = validateSearchRequest(payload);
  const runtimeSettings = JSON.parse(JSON.stringify(settings || {}));
  runtimeSettings.searchConfig = runtimeSettings.searchConfig || {};
  if (input.minSuppliers !== null) {
    runtimeSettings.searchConfig.minSuppliers = input.minSuppliers;
  }
  if (input.maxSuppliers !== null) {
    runtimeSettings.searchConfig.maxSuppliers = input.maxSuppliers;
  }
  settings = runtimeSettings;
  const searchId = createSearchId();
  const startedAt = new Date().toISOString();

  await createSearchRecord({
    searchId,
    startedAt,
    productDescription: input.productDescription,
    targetPrice: input.targetPrice,
    quantity: input.quantity,
    additionalRequirements: input.additionalRequirements,
    suppliersRequested: settings.searchConfig.maxSuppliers
  });

  await appendLog(searchId, { message: LOG_MESSAGES.SEARCH_INITIALIZED, context: { searchId, minSuppliers: settings.searchConfig?.minSuppliers, maxSuppliers: settings.searchConfig?.maxSuppliers } });

  const searchContext = {
    searchId,
    productDescription: input.productDescription,
    targetPrice: input.targetPrice,
    quantity: input.quantity,
    additionalRequirements: input.additionalRequirements,
    settings
  };

  const searchMessages = buildSupplierSearchMessages(settings, {
    productDescription: input.productDescription,
    targetPrice: input.targetPrice,
    quantity: input.quantity,
    additionalRequirements: input.additionalRequirements,
    preferredRegion: input.preferredRegion
  });

  // Use gpt-4o-search-preview with web_search_options to find REAL suppliers from the internet
  // Note: gpt-4o-search-preview does not support temperature parameter
  const supplierResponse = await chatCompletionWithWebSearch({
    messages: searchMessages,
    searchContextSize: 'high', // Use maximum search context for finding suppliers
    maxTokens: MAX_TOKENS.SEARCH,
    signal,
    apiKey: settings.apiKeys?.openai || process.env.OPENAI_API_KEY
  });

  const suppliers = await validateSuppliers(supplierResponse, { settings, searchId });
  await addSuppliersToSearch(searchId, suppliers);
  await appendLog(searchId, {
    message: LOG_MESSAGES.SUPPLIERS_VALIDATED(suppliers.length),
    context: { count: suppliers.length }
  });

  const emailResults = [];
  let index = 0;
  for (const supplier of suppliers) {
    const supplierContext = {
      ...searchContext,
      batchIndex: index,
      totalSuppliers: suppliers.length
    };

    try {
      await enforceSendgridPolicy({ settings, searchId });
      const emailContent = await generateEmailForSupplier({
        supplier,
        settings,
        searchContext: supplierContext,
        abortSignal: signal
      });

      const job = await queueEmailForSupplier({
        supplier,
        emailContent,
        settings,
        searchContext: supplierContext
      });

      await recordEmailSend({
        searchId,
        supplierId: supplier.id,
        recipientEmail: supplier.email,
        status: 'queued',
        language: emailContent.language
      });

      // Record email queued in metrics
      recordEmail('queued');

      await updateSupplier(searchId, supplier.id, (current) => ({
        ...current,
        status: 'Email Queued',
        last_contact: new Date().toISOString(),
        conversation_history: [
          ...(current.conversation_history || []),
          {
            direction: 'system',
            subject: 'Email queued for sending',
            body: `Job ID: ${job.id}`,
            provider: 'bull-queue',
            queued_at: new Date().toISOString(),
            job_id: job.id
          }
        ]
      }));

      emailResults.push({
        supplierId: supplier.id,
        status: 'queued',
        jobId: job.id,
        subject: emailContent.subject
      });

      await appendLog(searchId, {
        message: LOG_MESSAGES.EMAIL_QUEUED(supplier.company_name),
        context: {
          supplierId: supplier.id,
          jobId: job.id,
          subject: emailContent.subject
        }
      });
    } catch (error) {
      await recordEmailSend({
        searchId,
        supplierId: supplier.id,
        recipientEmail: supplier.email,
        status: 'failed',
        error: error.message,
        language: 'en' // Default to English for failed emails
      });

      await updateSupplier(searchId, supplier.id, (current) => ({
        ...current,
        status: 'Email Failed',
        notes: [current.notes, `Send failed: ${error.message}`].filter(Boolean).join('\n'),
        conversation_history: [
          ...(current.conversation_history || []),
          {
            direction: 'system',
            subject: 'Send failure',
            body: error.message,
            logged_at: new Date().toISOString()
          }
        ]
      }));

      emailResults.push({
        supplierId: supplier.id,
        status: 'failed',
        error: error.message
      });

      await appendLog(searchId, {
        level: 'error',
        message: LOG_MESSAGES.EMAIL_FAILED(supplier.company_name),
        context: {
          supplierId: supplier.id,
          error: error.message
        }
      });

      if (error.message.includes('Daily email limit')) {
        break;
      }
    }

    index += 1;
  }

  const queuedCount = emailResults.filter((result) => result.status === 'queued').length;
  const completedRecord = await finalizeSearch(searchId, 'completed', {
    metrics: {
      emailsQueued: queuedCount,
      suppliersValidated: suppliers.length
    }
  });

  // Record search completion in metrics
  recordSearch('completed');

  await appendLog(searchId, { message: LOG_MESSAGES.SEARCH_COMPLETED, context: { searchId } });

  await sendSummaryEmail(
    {
      settings,
      summary: {
        searchId,
        suppliersContacted: suppliers.length,
        emailsQueued: queuedCount
      }
    },
    settings.apiKeys?.sendgrid || process.env.SENDGRID_API_KEY
  ).catch((error) => {
    appendLog(searchId, {
      level: 'warn',
      message: LOG_MESSAGES.SUMMARY_EMAIL_FAILED,
      context: { error: error.message }
    });
  });

  return {
    ...completedRecord,
    emailResults
  };
}



