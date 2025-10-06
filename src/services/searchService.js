import { nanoid } from 'nanoid';
import { buildSupplierSearchMessages, buildEmailWriterMessages } from './promptService.js';
import { chatCompletionJson } from './openaiService.js';
import { prepareSendGridEmail, sendTransactionalEmail, sendSummaryEmail } from './sendgridService.js';
import { validateSearchRequest, isBusinessEmail, normalizeWebsite, sanitizeString } from '../utils/validation.js';
import { renderTemplate } from '../utils/template.js';
import { renderSpintax } from '../utils/spintax.js';
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

function createSearchId() {
  return `SEARCH_${Date.now()}_${nanoid(6).toUpperCase()}`;
}

function createSupplierId(index) {
  return `SUP_${Date.now()}_${String(index + 1).padStart(3, '0')}`;
}

function mapSupplierCandidate(candidate, index, searchContext) {
  const timestamp = new Date().toISOString();
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
    certifications: sanitizeString(candidate.certifications || ''),
    years_in_business: sanitizeString(candidate.years_in_business || ''),
    estimated_price_range: sanitizeString(candidate.estimated_price_range || ''),
    minimum_order_quantity: sanitizeString(candidate.minimum_order_quantity || ''),
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

function validateSuppliers(candidates, searchContext) {
  if (!Array.isArray(candidates)) {
    throw new Error('OpenAI supplier output is not an array');
  }

  const filtered = candidates.filter((candidate) => {
    const emailValid = isBusinessEmail(candidate.email);
    const nameValid = Boolean(candidate.company_name) && /\b(ltd|inc|corp|co|company|manufacturing|factory|group|industries)\b/i.test(candidate.company_name);
    const hasCountry = Boolean(candidate.country);
    const website = candidate.website || '';
    const websiteValid = !website || /^https?:\/\//i.test(website) || /\./.test(website);
    return emailValid && nameValid && hasCountry && websiteValid;
  });

  if (!filtered.length) {
    throw new Error('No valid business suppliers found. All suppliers failed validation.');
  }

  const { maxSuppliers } = searchContext.settings.searchConfig;
  return filtered.slice(0, maxSuppliers).map((candidate, index) => mapSupplierCandidate(candidate, index, searchContext));
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
        message: `Досягнуто щоденного ліміту ${policy.dailyLimit} листів`,
        context: { dailyLimit: policy.dailyLimit, sentToday }
      });
      throw new Error('Щоденний ліміт відправок вичерпано');
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
          message: `Очікування ${waitSeconds} сек перед наступною відправкою`,
          context: { waitSeconds }
        });
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
}

async function generateEmailForSupplier({ supplier, settings, searchContext, abortSignal }) {
  const messages = buildEmailWriterMessages(settings, supplier, searchContext);
  const emailJson = await chatCompletionJson({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.3,
    maxTokens: 600,
    signal: abortSignal,
    apiKey: settings.apiKeys?.openai || process.env.OPENAI_API_KEY
  });
  if (!emailJson.subject || !emailJson.body) {
    throw new Error('Email writer prompt did not return subject/body');
  }
  return composeEmailContent({ emailJson, settings, supplier, searchContext });
}

async function sendEmailToSupplier({ supplier, emailContent, settings, searchContext }) {
  const batchInfo = {
    current: searchContext.batchIndex + 1,
    total: searchContext.totalSuppliers
  };
  const prepared = prepareSendGridEmail({ supplier, emailContent, settings, searchContext, batchInfo });
  const result = await sendTransactionalEmail(
    prepared,
    settings.apiKeys?.sendgrid || process.env.SENDGRID_API_KEY
  );
  return result;
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

  await appendLog(searchId, { message: 'Search initialized', context: { searchId, minSuppliers: settings.searchConfig?.minSuppliers, maxSuppliers: settings.searchConfig?.maxSuppliers } });

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
    additionalRequirements: input.additionalRequirements
  });

  const supplierResponse = await chatCompletionJson({
    model: settings.searchConfig.openaiModel,
    messages: searchMessages,
    temperature: settings.searchConfig.temperature,
    maxTokens: 4000,
    signal,
    apiKey: settings.apiKeys?.openai || process.env.OPENAI_API_KEY
  });

  const suppliers = validateSuppliers(supplierResponse, { settings, searchId });
  await addSuppliersToSearch(searchId, suppliers);
  await appendLog(searchId, {
    message: `Validated ${suppliers.length} suppliers`,
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

      const sendResult = await sendEmailToSupplier({
        supplier,
        emailContent,
        settings,
        searchContext: supplierContext
      });

      const messageId =
        sendResult.headers?.['x-message-id'] ||
        sendResult.headers?.['X-Message-Id'] ||
        `sg_${nanoid(8)}`;

      await recordEmailSend({
        searchId,
        supplierId: supplier.id,
        status: 'sent'
      });

      await updateSupplier(searchId, supplier.id, (current) => ({
        ...current,
        status: 'Email Sent via SendGrid',
        last_contact: new Date().toISOString(),
        emails_sent: (current.emails_sent || 0) + 1,
        conversation_history: [
          ...(current.conversation_history || []),
          {
            direction: 'outbound',
            subject: emailContent.subject,
            body: emailContent.body,
            provider: 'sendgrid',
            sent_at: new Date().toISOString(),
            message_id: messageId
          }
        ]
      }));

      emailResults.push({
        supplierId: supplier.id,
        status: 'sent',
        sendgridMessageId: messageId,
        subject: emailContent.subject
      });

      await appendLog(searchId, {
        message: `Email sent to ${supplier.company_name}`,
        context: {
          supplierId: supplier.id,
          messageId,
          subject: emailContent.subject
        }
      });
    } catch (error) {
      await recordEmailSend({
        searchId,
        supplierId: supplier.id,
        status: 'failed',
        error: error.message
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
        message: `Failed to email ${supplier.company_name}`,
        context: {
          supplierId: supplier.id,
          error: error.message
        }
      });

      if (error.message.includes('Щоденний ліміт')) {
        break;
      }
    }

    index += 1;
  }

  const sentCount = emailResults.filter((result) => result.status === 'sent').length;
  const completedRecord = await finalizeSearch(searchId, 'completed', {
    metrics: {
      emailsSent: sentCount,
      suppliersValidated: suppliers.length
    }
  });

  await appendLog(searchId, { message: 'Search completed', context: { searchId } });

  await sendSummaryEmail(
    {
      settings,
      summary: {
        searchId,
        suppliersContacted: suppliers.length,
        emailsSent: sentCount
      }
    },
    settings.apiKeys?.sendgrid || process.env.SENDGRID_API_KEY
  ).catch((error) => {
    appendLog(searchId, {
      level: 'warn',
      message: 'Failed to send summary email',
      context: { error: error.message }
    });
  });

  return {
    ...completedRecord,
    emailResults
  };
}


