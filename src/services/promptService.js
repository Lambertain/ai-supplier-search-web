import { renderTemplate } from '../utils/template.js';
import { sanitizeString } from '../utils/validation.js';

/**
 * Generate region-specific search instructions
 * @param {string} region - Region code (china, asia, europe, usa, global)
 * @returns {string} Geographic priority instructions for AI
 */
function getRegionInstructions(region) {
  const regionMap = {
    china: `**Geographic Priority (ВАЖНО):**
1. **PRIMARY: China (mainland)** - Shenzhen, Guangzhou, Dongguan, Shanghai, Ningbo, Yiwu, Wenzhou
2. Secondary: Taiwan, Hong Kong
3. Avoid: Other regions unless absolutely necessary

**Email Policy:** Accept Chinese business emails (QQ, 163, 126, yeah.net) - commonly used by legitimate Chinese manufacturers.`,

    asia: `**Geographic Priority (ВАЖНО):**
1. **PRIMARY: East Asia** - China, Taiwan, South Korea, Japan
2. **SECONDARY: Southeast Asia** - Vietnam, Thailand, Malaysia, Indonesia
3. Alternative: India, Bangladesh

**Email Policy:** Accept Asian business emails including Chinese providers (QQ, 163, 126) and local domains.`,

    europe: `**Geographic Priority (ВАЖНО):**
1. **PRIMARY: Western Europe** - Germany, Poland, Czech Republic, Italy, France
2. **SECONDARY: Eastern Europe** - Romania, Bulgaria, Hungary, Slovakia
3. Alternative: Turkey (as manufacturing hub)

**Email Policy:** Prefer company domain emails. Free email providers not acceptable.`,

    usa: `**Geographic Priority (ВАЖНО):**
1. **PRIMARY: United States** - Focus on manufacturing states (California, Texas, Michigan, Ohio)
2. **SECONDARY: North America** - Canada, Mexico
3. Alternative: Only if USA/Canada suppliers insufficient

**Email Policy:** Professional company domain emails required. No free email providers.`,

    global: `**Geographic Priority (ВАЖНО):**
Global search - no geographic restrictions. Find best suppliers worldwide based on:
- Manufacturing capability match
- Competitive pricing
- Export experience
- Professional credentials

**Email Policy:** Accept business emails from reputable regional providers (including Chinese QQ/163/126 for Asian suppliers).`
  };

  return regionMap[region] || regionMap.china;
}

function getFewShotExample() {\n  return `\n**EXAMPLE:**\n\n*USER REQUEST:*\n\`\`\`\nFind 5-7 suppliers of custom-molded plastic enclosures for IoT devices, ABS plastic, IP67 rating in China.\n\`\`\`\n\n*AI RESPONSE (JSON ONLY):*\n\`\`\`json\n[\n  {\n    \"company_name\": \"Shenzhen ABC Plastics Co., Ltd.\",\n    \"email\": \"sales@abc-plastics.com\",\n    \"country\": \"China\",\n    \"website\": \"https://www.abc-plastics.com\",\n    \"phone\": \"+86-755-12345678\",\n    \"manufacturing_capabilities\": \"Custom injection molding, ABS, PC, IP67 enclosures\"\n  },\n  {\n    \"company_name\": \"Dongguan XYZ Molding Factory\",\n    \"email\": \"info@xyz-molding.cn\",\n    \"country\": \"China\",\n    \"website\": \"https://www.xyz-molding.cn\",\n    \"phone\": \"+86-769-87654321\",\n    \"manufacturing_capabilities\": \"ABS plastic enclosures, ultrasonic welding, IP-rated housings\"\n  }\n]\n\`\`\`\n**END OF EXAMPLE**\n`;\n}\n\nfunction buildSupplierBlock(supplier) {
  return [
    '**SUPPLIER INFORMATION:**',
    `- Company: ${supplier.company_name || supplier.companyName || 'Unknown'}`,
    `- Email: ${supplier.email || 'unknown'}`,
    `- Country: ${supplier.country || 'unknown'}`,
    `- City: ${supplier.city || 'unknown'}`,
    `- Website: ${supplier.website || 'n/a'}`,
    `- Capabilities: ${sanitizeString(supplier.manufacturing_capabilities || supplier.capabilities || '')}`,
    `- Capacity: ${sanitizeString(supplier.production_capacity || '')}`,
    `- Certifications: ${sanitizeString(supplier.certifications || '')}`,
    `- Years in Business: ${sanitizeString(supplier.years_in_business || '')}`,
    `- Price Range: ${sanitizeString(supplier.estimated_price_range || '')}`,
    `- MOQ: ${sanitizeString(supplier.minimum_order_quantity || '')}`
  ].join('\n');
}

function buildProductBlock(context) {
  return [
    '**PRODUCT REQUIREMENTS:**',
    `- Product: ${context.productDescription}`,
    `- Quantity: ${context.quantity || 'To discuss'}`,
    `- Target Price: ${context.targetPrice || 'To discuss'}`,
    `- Additional Requirements: ${context.additionalRequirements || 'None provided'}`
  ].join('\n');
}

export function buildSupplierSearchMessages(settings, input) {
  const { searchConfig, prompts } = settings;

  // Get region-specific instructions
  const regionInstructions = getRegionInstructions(input.preferredRegion || 'china');
  const fewShotExample = getFewShotExample(); // Get the new few-shot example

  const variables = {
    minSuppliers: searchConfig.minSuppliers,
    maxSuppliers: searchConfig.maxSuppliers,
    product_description: input.productDescription,
    quantity: input.quantity || 'Not specified',
    target_price: input.targetPrice || 'Not specified',
    additional_requirements: input.additionalRequirements || 'None',
    region_instructions: regionInstructions
  };

  // Prepend the few-shot example to the system prompt
  const system = fewShotExample + '\n\n' + prompts.supplierSearchSystem;
  const user = renderTemplate(prompts.supplierSearchUser, variables);
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

export function buildEmailWriterMessages(settings, supplier, context, language = 'en') {
  const supplierBlock = buildSupplierBlock(supplier);
  const productBlock = buildProductBlock(context);

  // Language-specific instruction for OpenAI
  const languageInstruction = getLanguageInstruction(language);

  const variables = {
    supplier_block: supplierBlock,
    product_block: productBlock,
    language_instruction: languageInstruction
  };

  const system = settings.prompts.emailWriterSystem;
  const user = renderTemplate(settings.prompts.emailWriterUser, variables);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

/**
 * Get language-specific instruction for email generation
 * @param {string} languageCode - ISO 639-1 language code
 * @returns {string} Instruction for OpenAI
 */
function getLanguageInstruction(languageCode) {
  const languageMap = {
    'zh': 'ВАЖНО: Напиши письмо на КИТАЙСКОМ ЯЗЫКЕ (简体中文). Используй упрощенные китайские иероглифы. Будь вежлив и формален.',
    'zh-TW': 'ВАЖНО: Напиши письмо на ТРАДИЦИОННОМ КИТАЙСКОМ (繁體中文). Используй традиционные китайские иероглифы.',
    'ja': 'ВАЖНО: Напиши письмо на ЯПОНСКОМ ЯЗЫКЕ (日本語). Используй вежливую форму keigo (敬語).',
    'ko': 'ВАЖНО: Напиши письмо на КОРЕЙСКОМ ЯЗЫКЕ (한국어). Используй вежливую форму речи.',
    'de': 'ВАЖНО: Напиши письмо на НЕМЕЦКОМ ЯЗЫКЕ. Используй формальное обращение "Sie".',
    'fr': 'ВАЖНО: Напиши письмо на ФРАНЦУЗСКОМ ЯЗЫКЕ. Используй формальный стиль "vous".',
    'es': 'ВАЖНО: Напиши письмо на ИСПАНСКОМ ЯЗЫКЕ. Используй формальное обращение "usted".',
    'it': 'ВАЖНО: Напиши письмо на ИТАЛЬЯНСКОМ ЯЗЫКЕ. Используй формальное обращение "Lei".',
    'pt': 'ВАЖНО: Напиши письмо на ПОРТУГАЛЬСКОМ ЯЗЫКЕ. Используй формальный стиль.',
    'nl': 'ВАЖНО: Напиши письмо на ГОЛЛАНДСКОМ ЯЗЫКЕ. Используй вежливую форму "u".',
    'pl': 'ВАЖНО: Напиши письмо на ПОЛЬСКОМ ЯЗЫКЕ. Используй вежливую форму Pan/Pani.',
    'cs': 'ВАЖНО: Напиши письмо на ЧЕШСКОМ ЯЗЫКЕ. Используй формальное обращение.',
    'el': 'ВАЖНО: Напиши письмо на ГРЕЧЕСКОМ ЯЗЫКЕ (Ελληνικά). Используй формальный стиль.',
    'tr': 'ВАЖНО: Напиши письмо на ТУРЕЦКОМ ЯЗЫКЕ. Используй формальное обращение "Siz".',
    'ru': 'ВАЖНО: Напиши письмо на РУССКОМ ЯЗЫКЕ. Используй обращение "Вы".',
    'uk': 'ВАЖНО: Напиши письмо на УКРАИНСКОМ ЯЗЫКЕ. Используй обращение "Ви".',
    'ar': 'ВАЖНО: Напиши письмо на АРАБСКОМ ЯЗЫКЕ (العربية). Используй формальный стиль.',
    'he': 'ВАЖНО: Напиши письмо на ИВРИТЕ (עברית). Используй формальный стиль.',
    'vi': 'ВАЖНО: Напиши письмо на ВЬЕТНАМСКОМ ЯЗЫКЕ. Используй вежливый стиль.',
    'th': 'ВАЖНО: Напиши письмо на ТАЙСКОМ ЯЗЫКЕ (ไทย). Используй вежливые частицы ka/krub.',
    'id': 'ВАЖНО: Напиши письмо на ИНДОНЕЗИЙСКОМ ЯЗЫКЕ (Bahasa Indonesia).',
    'ms': 'ВАЖНО: Напиши письмо на МАЛАЙСКОМ ЯЗЫКЕ (Bahasa Melayu).',
    'hi': 'ВАЖНО: Напиши письмо на ХИНДИ (हिंदी). Используй формальное обращение "aap".',
    'en': 'IMPORTANT: Write the email in ENGLISH. Use formal business language.'
  };

  return languageMap[languageCode] || languageMap['en'];
}

export function buildResponseMessages(settings, conversation) {
  const system = settings.prompts.responseSystem;
  const transcriptLines = conversation.history
    .map((item) => `${item.author.toUpperCase()}: ${item.body}`)
    .join('\n\n');

  const context = [
    `Supplier company: ${conversation.supplier.company_name}`,
    `Product focus: ${conversation.search.productDescription}`,
    `Latest supplier message subject: ${conversation.latestMessage.subject}`,
    '',
    '**Conversation History:**',
    transcriptLines || 'No previous messages yet.'
  ].join('\n');

  const user = `${settings.prompts.responseUser}\n\n${context}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}
