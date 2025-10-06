const settingsForm = document.querySelector('#settings-form');
const statusBox = document.querySelector('#settings-status');
const secretsStatus = document.querySelector('#secrets-status');
const sendgridNote = document.querySelector('#sendgridRecommendationsNote');

const DEFAULT_PROMPTS = {
  supplierSearchSystem:
    'You are an expert B2B procurement specialist with 15+ years experience in international sourcing. Your task is to find verified, professional suppliers with direct manufacturing capabilities. Focus on quality over quantity - only include suppliers with strong business credentials and professional email addresses.',
  supplierSearchUser:
    'Find {{minSuppliers}}-{{maxSuppliers}} professional suppliers for:\n\n**Product:** {{product_description}}\n**Target Quantity:** {{quantity}}\n**Target Price:** {{target_price}}\n**Additional Requirements:** {{additional_requirements}}\n\n**Supplier Criteria:**\n- VERIFIED manufacturing companies (not trading companies)\n- Professional business email addresses (no Gmail/Yahoo/QQ/163 free emails)\n- Documented certifications and production capacity\n- Experience exporting internationally\n- Responsive English-speaking sales team\n\nReturn ONLY a JSON array of suppliers. Each supplier object must include: company_name, email, phone, country, city, website, manufacturing_capabilities, production_capacity, certifications, years_in_business, estimated_price_range, minimum_order_quantity.\n\nEnsure all emails are business domains. Reject any suppliers using free email services.',
  emailWriterSystem:
    'You are a senior procurement manager with 15+ years of experience in international sourcing. Write professional B2B inquiry emails that establish credibility, build relationships, and generate high-quality responses.',
  emailWriterUser:
    'Write a professional B2B supplier inquiry email with the following details:\n\n{{supplier_block}}\n\n{{product_block}}\n\nReturn ONLY a JSON object with fields: subject, body.',
  responseSystem:
    'You are a senior procurement agent continuing an email negotiation with a supplier. Keep tone professional, collaborative, and focused on moving the deal forward.',
  responseUser:
    'Compose a reply to the supplier using the conversation history and company context. Provide clear next steps and request any missing information. Return JSON with subject and body.'
};

const DEFAULT_EMAIL_TEMPLATES = {
  subjectTemplate: '{Вітаю|Партнерство|Співпраця} щодо {{productDescription}}',
  introTemplate: '{Вітаю|Добрий день|Шановні представники} {{supplierCompany}},',
  closingTemplate: '{З повагою|Щиро}\nProcurement Team',
  footerTemplate:
    'Цей лист надіслано з нашої автоматизованої платформи постачання. {Якщо лист потрапив до вас помилково|Якщо пропозиція неактуальна}, відповідайте "UNSUBSCRIBE".'
};

const DEFAULT_SENDGRID_RECOMMENDATIONS =
  'Рекомендуємо не перевищувати 100–150 листів на день і робити паузу 15–30 секунд між відправками, щоб уникнути спаму.';

const PROMPT_FIELDS = {
  supplierSearchSystem: '#supplierSearchSystem',
  supplierSearchUser: '#supplierSearchUser',
  emailWriterSystem: '#emailWriterSystem',
  emailWriterUser: '#emailWriterUser',
  responseSystem: '#responseSystem',
  responseUser: '#responseUser'
};

const EMAIL_TEMPLATE_FIELDS = {
  subjectTemplate: '#subjectTemplate',
  introTemplate: '#emailIntroTemplate',
  closingTemplate: '#emailClosingTemplate',
  footerTemplate: '#emailFooterTemplate'
};

function setStatus(message, type = 'info') {
  if (!message) {
    statusBox.innerHTML = '';
    return;
  }
  const classes = {
    info: 'notice',
    error: 'alert',
    success: 'success'
  };
  statusBox.innerHTML = <div class=""></div>;
}

function setSecretsStatus(settings) {
  if (!secretsStatus) return;
  const openai = settings.secrets?.openai ? 'Налаштовано' : 'Відсутній';
  const sendgrid = settings.secrets?.sendgrid ? 'Налаштовано' : 'Відсутній';
  secretsStatus.innerHTML = 
    <p><strong>OpenAI API Key:</strong> </p>
    <p><strong>SendGrid API Key:</strong> </p>
  ;
}

function updateSendgridNote(settings) {
  if (!sendgridNote) return;
  const policy = settings.sendgridPolicy || {};
  const daily = policy.dailyLimit ?? '—';
  const interval = policy.sendIntervalSeconds ?? '—';
  const hint = policy.recommendations || DEFAULT_SENDGRID_RECOMMENDATIONS;
  sendgridNote.innerHTML = 
    <strong>Рекомендації SendGrid:</strong> не більше  листів на день, інтервал  сек між відправками. 
  ;
}

function populateSettingsForm(settings) {
  settingsForm.querySelector('#openaiModel').value = settings.searchConfig?.openaiModel ?? '';
  settingsForm.querySelector('#temperature').value = settings.searchConfig?.temperature ?? '';
  settingsForm.querySelector('#autoReply').value = String(Boolean(settings.automation?.autoReply));
  settingsForm.querySelector('#autoReplyDelay').value = settings.automation?.autoReplyDelayMinutes ?? '';
  settingsForm.querySelector('#openaiKey').value = settings.apiKeys?.openai ?? '';

  settingsForm.querySelector('#fromEmail').value = settings.emailConfig?.fromEmail ?? '';
  settingsForm.querySelector('#fromName').value = settings.emailConfig?.fromName ?? '';
  settingsForm.querySelector('#replyTo').value = settings.emailConfig?.replyTo ?? '';

  settingsForm.querySelector('#notificationsEnabled').value = String(Boolean(settings.notifications?.enabled));
  settingsForm.querySelector('#notificationRecipients').value = (settings.notifications?.recipients || []).join(', ');

  const templates = { ...DEFAULT_EMAIL_TEMPLATES, ...(settings.emailTemplates || {}) };
  settingsForm.querySelector('#subjectTemplate').value = templates.subjectTemplate ?? '';
  settingsForm.querySelector('#emailIntroTemplate').value = templates.introTemplate ?? '';
  settingsForm.querySelector('#emailClosingTemplate').value = templates.closingTemplate ?? '';
  settingsForm.querySelector('#emailFooterTemplate').value = templates.footerTemplate ?? '';

  const policy = settings.sendgridPolicy || {};
  settingsForm.querySelector('#dailyLimit').value = policy.dailyLimit ?? '';
  settingsForm.querySelector('#sendInterval').value = policy.sendIntervalSeconds ?? '';
  settingsForm.querySelector('#sendgridKey').value = settings.apiKeys?.sendgrid ?? '';

  updateSendgridNote(settings);
}

function populatePromptFields(prompts) {
  const merged = { ...DEFAULT_PROMPTS, ...(prompts || {}) };
  Object.entries(PROMPT_FIELDS).forEach(([key, selector]) => {
    const field = document.querySelector(selector);
    if (field) {
      field.value = merged[key] ?? '';
    }
  });
}

function formDataToNestedObject(form) {
  const data = {};
  const formData = new FormData(form);
  formData.forEach((value, key) => {
    const keys = key.split('.');
    let cursor = data;
    keys.forEach((part, index) => {
      if (index === keys.length - 1) {
        let parsed = value;
        if (parsed === 'true' || parsed === 'false') {
          parsed = parsed === 'true';
        } else if (!Number.isNaN(Number(parsed)) && parsed.trim() !== '' && !key.includes('apiKeys')) {
          parsed = Number(parsed);
        } else if (key.endsWith('recipients')) {
          parsed = parsed
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        }
        cursor[part] = parsed;
      } else {
        cursor[part] = cursor[part] || {};
        cursor = cursor[part];
      }
    });
  });
  return data;
}

async function saveSettings(partial) {
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial)
  });
  const result = await response.json();
  if (!response.ok) {
    const message = result?.message || 'Не вдалося оновити налаштування';
    throw new Error(message);
  }
  return result;
}

async function loadSettings() {
  try {
    const response = await fetch('/api/settings');
    if (!response.ok) throw new Error('Не вдалося отримати налаштування');
    const settings = await response.json();
    populateSettingsForm(settings);
    populatePromptFields(settings.prompts || {});
    setSecretsStatus(settings);
  } catch (error) {
    console.error(error);
    setStatus(Помилка завантаження: , 'error');
  }
}

function applyTemplate(key) {
  if (PROMPT_FIELDS[key]) {
    const field = document.querySelector(PROMPT_FIELDS[key]);
    if (field) {
      field.value = DEFAULT_PROMPTS[key];
      setStatus('Промпт відновлено зі стандартного шаблону.', 'info');
    }
    return;
  }

  if (key === 'sendgridRecommendations') {
    updateSendgridNote({ sendgridPolicy: { recommendations: DEFAULT_SENDGRID_RECOMMENDATIONS } });
    setStatus('Рекомендації SendGrid відновлено.', 'info');
    return;
  }

  if (EMAIL_TEMPLATE_FIELDS[key]) {
    const field = settingsForm.querySelector(EMAIL_TEMPLATE_FIELDS[key]);
    if (field) {
      field.value = DEFAULT_EMAIL_TEMPLATES[key];
      setStatus('Шаблон листа повернуто до стандартного тексту.', 'info');
    }
  }
}

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Збереження налаштувань…', 'info');
  try {
    const payload = formDataToNestedObject(settingsForm);
    const updated = await saveSettings(payload);
    setStatus('Налаштування успішно збережені.', 'success');
    setSecretsStatus(updated);
    populateSettingsForm(updated);
    populatePromptFields(updated.prompts || {});
  } catch (error) {
    setStatus(Помилка: , 'error');
  }
});

document.querySelectorAll('.template-btn').forEach((button) => {
  button.addEventListener('click', (event) => {
    const key = event.currentTarget.dataset.template;
    applyTemplate(key);
  });
});

await loadSettings();
