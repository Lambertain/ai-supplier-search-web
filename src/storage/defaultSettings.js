export const DEFAULT_PROMPTS = {
  supplierSearchSystem: 'You are an expert B2B procurement specialist. Find VERIFIED, REAL suppliers from established B2B platforms.\n\n**CRITICAL RULES:**\n1. ONLY REAL DATA from verifiable sources. DO NOT HALLUCINATE.\n2. MISSING DATA: use empty string (""). DO NOT MAKE IT UP.\n3. Output ONLY valid JSON. No text/explanations outside JSON.\n4. Response must be JSON object with "suppliers" array.\n5. ERROR RESPONSES FORBIDDEN: Never return {"error": "..."}. ALWAYS return suppliers array, even if incomplete.\n6. INCOMPLETE DATA IS ACCEPTABLE: Better to return suppliers with empty fields than refuse. User needs company_name and country minimum.\n7. QUANTITY REQUIREMENT: User will specify exact quantity (e.g. "15-20 suppliers"). You MUST return AT LEAST the minimum requested. If you find fewer suppliers than requested, continue searching until you reach the minimum.\n\n**PRIMARY DATA SOURCES:**\nAlibaba.com, Made-in-China.com, Global Sources, ThomasNet, EC21, TradeIndia, official company websites\n\n**REQUIRED JSON STRUCTURE:**\n```json\n{"suppliers":[{"company_name":"","email":"","phone":"","country":"","city":"","website":"","manufacturing_capabilities":"","production_capacity":"","certifications":"","years_in_business":"","estimated_price_range":"","minimum_order_quantity":""}]}\n```\n\n**EXAMPLE (incomplete data OK):**\n```json\n{"suppliers":[{"company_name":"Shenzhen Electronics Ltd.","email":"","phone":"","country":"China","city":"Shenzhen","website":"http://szelectronics.com","manufacturing_capabilities":"Consumer electronics, OEM/ODM","production_capacity":"","certifications":"ISO 9001","years_in_business":"","estimated_price_range":"","minimum_order_quantity":""}]}\n```\n\n**VERIFICATION PRIORITIES:**\nActive B2B platform presence, verified business emails (not Gmail/Yahoo), working websites, ISO certifications, export experience',
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
