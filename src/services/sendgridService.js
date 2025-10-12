import sgMail from '@sendgrid/mail';
import { withSendGridRetry } from '../utils/retryHelper.js';
import { ERROR_MESSAGES } from '../utils/messages.js';

let configured = false;
let cachedKey = '';

function ensureClient(keyFromSettings) {
  const key = keyFromSettings || process.env.SENDGRID_API_KEY;
  if (!key) {
    throw new Error(ERROR_MESSAGES.SENDGRID_KEY_MISSING);
  }
  if (!configured || cachedKey !== key) {
    sgMail.setApiKey(key);
    configured = true;
    cachedKey = key;
  }
  return sgMail;
}

function buildHtmlBody(emailContent, settings) {
  const replyTo = settings?.emailConfig?.replyTo || process.env.REPLY_TO || 'noreply@example.com';
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${emailContent.subject}</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 640px; margin: 0 auto; padding: 24px; background: #f5f7fb;">
        <section style="background: #ffffff; border-radius: 12px; padding: 28px; box-shadow: 0 12px 28px rgba(18,38,63,0.05);">
          ${emailContent.body.replace(/\n/g, '<br><br>')}
        </section>
        <section style="margin-top: 24px; font-size: 12px; color: #6c757d;">
          <p><strong>Contact:</strong> ${replyTo}</p>
          <p>To unsubscribe reply with "UNSUBSCRIBE" in the subject line.</p>
        </section>
      </body>
    </html>
  `;
}

export function prepareSendGridEmail({ supplier, emailContent, settings, searchContext, batchInfo }) {
  const htmlBody = buildHtmlBody(emailContent, settings);
  const payload = {
    personalizations: [
      {
        to: [
          {
            email: supplier.email,
            name: supplier.company_name
          }
        ],
        subject: emailContent.subject,
        customArgs: {
          supplier_id: supplier.id,
          search_id: searchContext.searchId,
          thread_id: supplier.thread_id,
          campaign: 'supplier_inquiry',
          priority: supplier.priority
        }
      }
    ],
    from: {
      email: process.env.FROM_EMAIL || settings?.emailConfig?.fromEmail || 'noreply@example.com',
      name: process.env.FROM_NAME || settings?.emailConfig?.fromName || 'Procurement Team'
    },
    replyTo: {
      email: process.env.REPLY_TO || settings?.emailConfig?.replyTo || 'noreply@example.com',
      name: settings?.emailConfig?.fromName || 'Procurement Team'
    },
    content: [
      { type: 'text/plain', value: emailContent.body },
      { type: 'text/html', value: htmlBody }
    ],
    categories: ['supplier_inquiry', supplier.country?.toLowerCase().replace(/\s+/g, '_') || 'unknown_country'],
    trackingSettings: {
      clickTracking: { enable: true, enableText: false },
      openTracking: { enable: true }
    },
    headers: settings?.compliance?.antispamHeaders || {}
  };

  return {
    payload,
    metadata: {
      supplierInfo: {
        id: supplier.id,
        company_name: supplier.company_name,
        email: supplier.email,
        thread_id: supplier.thread_id,
        priority: supplier.priority
      },
      batchInfo: batchInfo || { current: 1, total: 1 },
      emailSubject: emailContent.subject,
      emailBody: emailContent.body,
      emailBodyHtml: htmlBody
    }
  };
}

export const sendTransactionalEmail = withSendGridRetry(async function sendTransactionalEmailInternal(prepared, apiKey) {
  const client = ensureClient(apiKey);
  const [response] = await client.send(prepared.payload);
  return {
    status: response.statusCode,
    headers: response.headers,
    body: response.body,
    metadata: prepared.metadata
  };
});

export const sendSummaryEmail = withSendGridRetry(async function sendSummaryEmailInternal({ settings, summary }, apiKey) {
  if (!settings.notifications?.enabled || !settings.notifications?.recipients?.length) {
    return null;
  }
  const client = ensureClient(apiKey);
  const recipients = settings.notifications.recipients.map((email) => ({ email }));
  const payload = {
    personalizations: [
      {
        to: recipients,
        subject: `Supplier search complete — ${summary.suppliersContacted} suppliers reached`
      }
    ],
    from: {
      email: process.env.FROM_EMAIL || settings?.emailConfig?.fromEmail || 'noreply@example.com',
      name: 'Procurement AI Agent'
    },
    content: [
      {
        type: 'text/plain',
        value: `Search ${summary.searchId} completed. ${summary.suppliersContacted} suppliers contacted, ${summary.emailsQueued} emails queued for sending.`
      }
    ]
  };
  const [response] = await client.send(payload);
  return {
    status: response.statusCode,
    headers: response.headers
  };
});
