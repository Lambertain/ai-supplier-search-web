import { renderTemplate } from '../utils/template.js';
import { sanitizeString } from '../utils/validation.js';

function buildSupplierBlock(supplier) {
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
  const variables = {
    minSuppliers: searchConfig.minSuppliers,
    maxSuppliers: searchConfig.maxSuppliers,
    product_description: input.productDescription,
    quantity: input.quantity || 'Not specified',
    target_price: input.targetPrice || 'Not specified',
    additional_requirements: input.additionalRequirements || 'None'
  };

  const system = prompts.supplierSearchSystem;
  const user = renderTemplate(prompts.supplierSearchUser, variables);
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

export function buildEmailWriterMessages(settings, supplier, context) {
  const supplierBlock = buildSupplierBlock(supplier);
  const productBlock = buildProductBlock(context);
  const variables = {
    supplier_block: supplierBlock,
    product_block: productBlock
  };

  const system = settings.prompts.emailWriterSystem;
  const user = renderTemplate(settings.prompts.emailWriterUser, variables);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
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
