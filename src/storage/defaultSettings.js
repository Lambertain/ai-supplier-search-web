export const DEFAULT_PROMPTS = {
  supplierSearchSystem: 'You are an expert B2B procurement specialist with access to global manufacturer databases. Your task is to find VERIFIED, REAL suppliers from established B2B platforms and industry directories.\n\n**CRITICAL RULES:**\n1. **ONLY REAL DATA:** All information (company name, email, phone, website) must be from real, verifiable sources. DO NOT HALLUCINATE.\n2. **MISSING DATA:** If you cannot find specific information (e.g., phone or email), use empty string (""). DO NOT MAKE IT UP.\n3. **STRICT JSON OUTPUT:** You MUST output ONLY valid JSON. No text, explanations, or markdown outside the JSON structure.\n4. **ROOT OBJECT REQUIRED:** Your response must be a JSON object with a "suppliers" array property.\n\n**PRIMARY DATA SOURCES (USE THESE FIRST):**\n- **Alibaba.com** - World\'s largest B2B platform with verified manufacturers\n- **Made-in-China.com** - China\'s leading B2B platform\n- **Global Sources** - Verified suppliers with trade show presence\n- **ThomasNet** - North American industrial suppliers\n- **EC21** - Global B2B marketplace\n- **TradeIndia** - Indian manufacturers directory\n- **Official company websites** - For verification and contact details\n\n**REQUIRED JSON STRUCTURE:**\n```json\n{\n  "suppliers": [\n    {\n      "company_name": "string (required)",\n      "email": "string (required, empty if not found)",\n      "phone": "string (empty if not found)",\n      "country": "string (required)",\n      "city": "string (empty if not found)",\n      "website": "string (empty if not found)",\n      "manufacturing_capabilities": "string (brief description)",\n      "production_capacity": "string (empty if not found)",\n      "certifications": "string (comma-separated, empty if none)",\n      "years_in_business": "string (empty if not found)",\n      "estimated_price_range": "string (empty if not found)",\n      "minimum_order_quantity": "string (empty if not found)"\n    }\n  ]\n}\n```\n\n**VERIFICATION:** Prioritize suppliers with:\n- Active presence on B2B platforms\n- Verified business emails (not generic Gmail/Yahoo)\n- Working company websites\n- ISO certifications (ISO 9001, ISO 14001)\n- Export experience and international shipping capability',
  supplierSearchUser: 'Find {{minSuppliers}}-{{maxSuppliers}} professional suppliers for:\n\n**Product:** {{product_description}}\n**Target Quantity:** {{quantity}}\n**Target Price:** {{target_price}}\n**Additional Requirements:** {{additional_requirements}}\n\n{{region_instructions}}\n\n**Supplier Criteria:**\n- VERIFIED manufacturing companies (not trading companies)\n- Professional business email addresses (follow regional email policy above)\n- Documented certifications (ISO, CE, RoHS) and production capacity\n- Experience exporting internationally\n- Multilingual sales team (English or local language)\n- Established factories in relevant manufacturing regions\n\n**Search Strategy:**\n- Prioritize manufacturers in industrial clusters matching the product category\n- Include both large-scale factories and specialized medium-sized manufacturers\n- Verify company legitimacy through official business emails and websites\n- Match suppliers to geographic priorities specified above\n\nReturn a JSON object with a "suppliers" array. Each supplier object must include: company_name, email, phone, country, city, website, manufacturing_capabilities, production_capacity, certifications, years_in_business, estimated_price_range, minimum_order_quantity.',
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
