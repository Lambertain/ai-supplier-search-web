import { findSupplierByEmail, updateSupplier, appendLog } from '../storage/searchStore.js';
import { buildResponseMessages } from './promptService.js';
import { chatCompletionJson } from './openaiService.js';
import { prepareSendGridEmail, sendTransactionalEmail } from './sendgridService.js';

function decodeBase64(value) {
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch (error) {
    return null;
  }
}

function extractFromHeaders(headers = []) {
  const lookup = new Map(headers.map((h) => [h.name?.toLowerCase(), h.value]));
  const from = lookup.get('from') || '';
  const subject = lookup.get('subject') || '';
  let senderEmail = from;
  const match = from.match(/<(.+?)>/);
  if (match) {
    senderEmail = match[1];
  }
  return {
    senderEmail: senderEmail.toLowerCase().trim(),
    subject,
    messageId: lookup.get('message-id') || '',
    threadId: lookup.get('thread-id') || ''
  };
}

function parseInboundPayload(payload) {
  if (!payload) return null;

  if (payload.message?.data) {
    const decoded = decodeBase64(payload.message.data);
    if (decoded) {
      try {
        return parseInboundPayload(JSON.parse(decoded));
      } catch (error) {
        return null;
      }
    }
  }

  if (payload.email) {
    return {
      senderEmail: String(payload.from || payload.envelope?.from || '').toLowerCase(),
      subject: payload.subject || 'No Subject',
      body: payload.text || payload.html || '',
      messageId: payload.headers?.['Message-ID'] || '',
      threadId: payload.headers?.['Thread-Id'] || ''
    };
  }

  if (payload.payload?.headers) {
    const basic = extractFromHeaders(payload.payload.headers);
    let body = payload.snippet || '';
    if (payload.payload.body?.data) {
      body = decodeBase64(payload.payload.body.data) || body;
    }
    return {
      senderEmail: basic.senderEmail,
      subject: basic.subject || 'No Subject',
      body,
      messageId: basic.messageId,
      threadId: payload.threadId || basic.threadId || ''
    };
  }

  if (payload.sender_email || payload.from) {
    return {
      senderEmail: String(payload.sender_email || payload.from).toLowerCase(),
      subject: payload.subject || 'No Subject',
      body: payload.body || payload.text || '',
      messageId: payload.message_id || payload.id || '',
      threadId: payload.thread_id || ''
    };
  }

  return null;
}

async function maybeSendAutoReply({ search, supplier, inbound, settings }) {
  if (!settings.automation?.autoReply) {
    return { sent: false };
  }

  const conversation = {
    supplier,
    search,
    latestMessage: {
      subject: inbound.subject,
      body: inbound.body
    },
    history: [
      ...(supplier.conversation_history || []),
      {
        author: supplier.company_name,
        body: inbound.body
      }
    ]
  };

  const messages = buildResponseMessages(settings, conversation);
  const aiReply = await chatCompletionJson({
    model: settings.searchConfig.openaiModel,
    messages,
    temperature: 0.3,
    maxTokens: 700,
    apiKey: settings.apiKeys?.openai || process.env.OPENAI_API_KEY
  });

  if (!aiReply.subject || !aiReply.body) {
    throw new Error('Auto-reply prompt failed to return subject/body');
  }

  const prepared = prepareSendGridEmail({
    supplier,
    emailContent: aiReply,
    settings,
    searchContext: { searchId: search.searchId, productDescription: search.productDescription },
    batchInfo: { current: 1, total: 1 }
  });
  const response = await sendTransactionalEmail(prepared, settings.apiKeys?.sendgrid || process.env.SENDGRID_API_KEY);
  return {
    sent: true,
    messageId: response.headers?.['x-message-id'] || response.headers?.['X-Message-Id'] || ''
  };
}

export async function handleInboundEmail(payload, settings) {
  const parsed = parseInboundPayload(payload);
  if (!parsed || !parsed.senderEmail) {
    return { matched: false, reason: 'Unable to parse inbound payload' };
  }

  const match = await findSupplierByEmail(parsed.senderEmail);
  if (!match) {
    return { matched: false, senderEmail: parsed.senderEmail };
  }

  const { search, supplier } = match;

  const conversationEntry = {
    direction: 'inbound',
    subject: parsed.subject,
    body: parsed.body,
    received_at: new Date().toISOString(),
    message_id: parsed.messageId
  };

  const updatedSupplier = await updateSupplier(search.searchId, supplier.id, (current) => ({
    ...current,
    status: 'Supplier Responded',
    emails_received: (current.emails_received || 0) + 1,
    last_response_date: new Date().toISOString(),
    conversation_history: [...(current.conversation_history || []), conversationEntry]
  }));

  await appendLog(search.searchId, {
    message: `Inbound email from ${supplier.company_name}`,
    context: {
      supplierId: supplier.id,
      subject: parsed.subject
    }
  });

  let autoReply = { sent: false };
  try {
    autoReply = await maybeSendAutoReply({ search, supplier: updatedSupplier, inbound: parsed, settings });
  } catch (error) {
    await appendLog(search.searchId, {
      level: 'error',
      message: 'Auto-reply failed',
      context: { error: error.message, supplierId: supplier.id }
    });
  }

  if (autoReply.sent) {
    await updateSupplier(search.searchId, supplier.id, (current) => ({
      ...current,
      status: 'Awaiting Supplier Reply',
      conversation_history: [...(current.conversation_history || []), {
        direction: 'outbound',
        subject: `Re: ${parsed.subject}`,
        body: 'Автовідповідь AI була надіслана.',
        sent_at: new Date().toISOString(),
        message_id: autoReply.messageId
      }]
    }));
  }

  return {
    matched: true,
    searchId: search.searchId,
    supplierId: supplier.id,
    autoReply: autoReply.sent
  };
}
