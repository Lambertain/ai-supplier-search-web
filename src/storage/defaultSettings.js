export const DEFAULT_PROMPTS = {
  supplierSearchSystem: 'You are an expert B2B procurement specialist with 15+ years experience in international sourcing, specializing in Chinese manufacturing. Your task is to find verified, professional suppliers with direct manufacturing capabilities in China and other Asian manufacturing hubs. Focus on quality over quantity - only include suppliers with strong business credentials and professional email addresses.',
  supplierSearchUser: 'Find {{minSuppliers}}-{{maxSuppliers}} professional suppliers for:\n\n**Product:** {{product_description}}\n**Target Quantity:** {{quantity}}\n**Target Price:** {{target_price}}\n**Additional Requirements:** {{additional_requirements}}\n\n**Geographic Priority (ВАЖНО):**\n1. **PRIMARY: China (mainland)** - Shenzhen, Guangzhou, Dongguan, Shanghai, Ningbo, Yiwu, Wenzhou\n2. Secondary: Taiwan, Hong Kong, South Korea\n3. Alternative: Vietnam, Thailand, India (only if Chinese suppliers unavailable)\n\n**Supplier Criteria:**\n- VERIFIED manufacturing companies (not trading companies)\n- Professional business email addresses (company domain preferred; QQ/163/126/yeah.net acceptable for Chinese suppliers)\n- Documented certifications (ISO, CE, RoHS) and production capacity\n- Experience exporting internationally (especially to Europe/USA)\n- English-speaking sales team OR Chinese-speaking contact\n- Focus on established factories in major manufacturing regions\n\n**Search Strategy:**\n- Prioritize manufacturers in Chinese industrial clusters relevant to the product\n- Include both large-scale factories and specialized medium-sized manufacturers\n- Verify company legitimacy through official business emails and websites\n\nReturn ONLY a JSON array of suppliers. Each supplier object must include: company_name, email, phone, country, city, website, manufacturing_capabilities, production_capacity, certifications, years_in_business, estimated_price_range, minimum_order_quantity.\n\nFor Chinese suppliers: Accept business emails from major Chinese email providers (QQ, 163, 126, yeah.net) as these are commonly used by legitimate Chinese manufacturers.',
  emailWriterSystem: 'You are a senior procurement manager with 15+ years of experience in international sourcing. Write professional B2B inquiry emails that establish credibility, build relationships, and generate high-quality responses.',
  emailWriterUser: 'Write a professional B2B supplier inquiry email with the following details:\n\n{{supplier_block}}\n\n{{product_block}}\n\nReturn ONLY a JSON object with fields: subject, body.',
  responseSystem: 'You are a senior procurement agent continuing an email negotiation with a supplier. Keep tone professional, collaborative, and focused on moving the deal forward.',
  responseUser: 'Compose a reply to the supplier using the conversation history and company context. Provide clear next steps and request any missing information. Return JSON with subject and body.'
};

export const DEFAULT_SETTINGS = {
  searchConfig: {
    minSuppliers: 15,
    maxSuppliers: 20,
    openaiModel: 'gpt-4o',
    temperature: 0.1,
    timeoutMs: 60000
  },
  emailConfig: {
    fromEmail: 'procurement@sourcing-hub.com',
    fromName: 'Procurement Team',
    replyTo: 'replies@sourcing-hub.com'
  },
  emailTemplates: {
    subjectTemplate: '{Вітаю|Партнерство|Співпраця} щодо {{productDescription}}',
    introTemplate: '{Вітаю|Добрий день|Шановні представники} {{supplierCompany}},',
    closingTemplate: '{З повагою|Щиро}\\nProcurement Team',
    footerTemplate: 'Цей лист надіслано з нашої автоматизованої платформи постачання. {Якщо лист потрапив до вас помилково|Якщо пропозиція неактуальна}, будь ласка, відповідайте "UNSUBSCRIBE".',
    recommendations: 'Use a professional domain, alternate email subjects, and do not exceed the daily limit.'
  },
  compliance: {
    antispamHeaders: {
      'X-Priority': '3',
      'X-Mailer': 'Professional Procurement System v1.0',
      'List-Unsubscribe': 'mailto:replies@sourcing-hub.com?subject=UNSUBSCRIBE',
      'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
      Precedence: 'bulk'
    }
  },
  prompts: DEFAULT_PROMPTS,
  notifications: {
    enabled: true,
    recipients: ['productmanager@company.com'],
    sendgridTemplate: null
  },
  automation: {
    autoReply: false,
    autoReplyDelayMinutes: 30
  },
  sendgridPolicy: {
    dailyLimit: 120,
    sendIntervalSeconds: 30,
    recommendations: 'Keep daily limit low, take breaks between sends (15-30 seconds), regularly check delivery metrics.'
  },
  apiKeys: {
    openai: '',
    sendgrid: ''
  }
};
