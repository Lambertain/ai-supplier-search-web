import { query } from '../db/client.js';
import { DEFAULT_SETTINGS, DEFAULT_PROMPTS } from './defaultSettings.js';

const SETTINGS_ID = 1;

function cloneSettings(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyDerivedSettings(settings) {
  const copy = cloneSettings(settings || DEFAULT_SETTINGS);
  copy.prompts = { ...DEFAULT_PROMPTS, ...(copy.prompts || {}) };
  const replyTo = copy.emailConfig?.replyTo || 'replies@sourcing-hub.com';
  copy.compliance = copy.compliance || {};
  copy.compliance.antispamHeaders = {
    ...DEFAULT_SETTINGS.compliance.antispamHeaders,
    ...(copy.compliance.antispamHeaders || {})
  };
  copy.compliance.antispamHeaders['List-Unsubscribe'] = `mailto:${replyTo}?subject=UNSUBSCRIBE`;
  copy.sendgridPolicy = {
    ...DEFAULT_SETTINGS.sendgridPolicy,
    ...(copy.sendgridPolicy || {})
  };
  copy.emailTemplates = {
    ...DEFAULT_SETTINGS.emailTemplates,
    ...(copy.emailTemplates || {})
  };
  copy.notifications = {
    ...DEFAULT_SETTINGS.notifications,
    ...(copy.notifications || {}),
    recipients: (copy.notifications?.recipients || DEFAULT_SETTINGS.notifications.recipients || []).filter(Boolean)
  };
  copy.automation = {
    ...DEFAULT_SETTINGS.automation,
    ...(copy.automation || {})
  };
  copy.apiKeys = {
    openai: copy.apiKeys?.openai || '',
    sendgrid: copy.apiKeys?.sendgrid || ''
  };
  return copy;
}

async function fetchSettingsRow() {
  const result = await query('SELECT data FROM app_settings WHERE id = $1', [SETTINGS_ID]);
  if (result.rows.length === 0) {
    return cloneSettings(DEFAULT_SETTINGS);
  }
  return applyDerivedSettings(result.rows[0].data);
}

export async function getSettings() {
  return fetchSettingsRow();
}

export async function updateSettings(partial) {
  const current = await fetchSettingsRow();
  const merged = applyDerivedSettings({
    ...current,
    ...partial,
    searchConfig: {
      ...current.searchConfig,
      ...partial.searchConfig
    },
    emailConfig: {
      ...current.emailConfig,
      ...partial.emailConfig
    },
    emailTemplates: {
      ...current.emailTemplates,
      ...partial.emailTemplates
    },
    compliance: {
      ...current.compliance,
      ...partial.compliance,
      antispamHeaders: {
        ...current.compliance?.antispamHeaders,
        ...partial.compliance?.antispamHeaders
      }
    },
    prompts: {
      ...current.prompts,
      ...partial.prompts
    },
    notifications: {
      ...current.notifications,
      ...partial.notifications,
      recipients: Array.isArray(partial.notifications?.recipients)
        ? partial.notifications.recipients
        : current.notifications.recipients
    },
    automation: {
      ...current.automation,
      ...partial.automation
    },
    sendgridPolicy: {
      ...current.sendgridPolicy,
      ...partial.sendgridPolicy
    },
    apiKeys: {
      ...current.apiKeys,
      ...partial.apiKeys
    }
  });

  await query('UPDATE app_settings SET data = $1::jsonb, updated_at = NOW() WHERE id = $2', [
    JSON.stringify(merged),
    SETTINGS_ID
  ]);

  return merged;
}
