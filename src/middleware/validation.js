import { z } from 'zod';

/**
 * Validation middleware factory using Zod schemas
 */
export function validateRequest(schema) {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }));
        return res.status(400).json({
          message: 'Validation failed',
          errors
        });
      }
      next(error);
    }
  };
}

// Search request schema
export const searchSchema = z.object({
  productDescription: z.string().min(3, 'Product description must be at least 3 characters').max(500),
  targetPrice: z.string().max(100).optional(),
  quantity: z.string().max(100).optional(),
  additionalRequirements: z.string().max(1000).optional(),
  minSuppliers: z.number().int().min(1).max(50).optional(),
  maxSuppliers: z.number().int().min(1).max(50).optional()
});

// Settings schema
export const settingsSchema = z.object({
  searchConfig: z.object({
    minSuppliers: z.number().int().min(1).max(50).optional(),
    maxSuppliers: z.number().int().min(1).max(50).optional(),
    openaiModel: z.string().min(1).optional(),
    temperature: z.number().min(0).max(2).optional(),
    timeoutMs: z.number().int().min(1000).max(300000).optional()
  }).optional(),

  emailConfig: z.object({
    fromEmail: z.string().email().optional(),
    fromName: z.string().max(100).optional(),
    replyTo: z.string().email().optional()
  }).optional(),

  emailTemplates: z.object({
    subjectTemplate: z.string().max(200).optional(),
    introTemplate: z.string().max(500).optional(),
    closingTemplate: z.string().max(300).optional(),
    footerTemplate: z.string().max(500).optional(),
    recommendations: z.string().max(500).optional()
  }).optional(),

  compliance: z.object({
    antispamHeaders: z.record(z.string()).optional()
  }).optional(),

  prompts: z.object({
    supplierSearchSystem: z.string().max(2000).optional(),
    supplierSearchUser: z.string().max(2000).optional(),
    emailWriterSystem: z.string().max(2000).optional(),
    emailWriterUser: z.string().max(2000).optional(),
    responseSystem: z.string().max(2000).optional(),
    responseUser: z.string().max(2000).optional()
  }).optional(),

  notifications: z.object({
    enabled: z.boolean().optional(),
    recipients: z.array(z.string().email()).optional(),
    sendgridTemplate: z.string().nullable().optional()
  }).optional(),

  automation: z.object({
    autoReply: z.boolean().optional(),
    autoReplyDelayMinutes: z.number().int().min(1).max(1440).optional()
  }).optional(),

  sendgridPolicy: z.object({
    dailyLimit: z.number().int().min(1).max(10000).optional(),
    sendIntervalSeconds: z.number().int().min(1).max(3600).optional(),
    recommendations: z.string().max(500).optional()
  }).optional(),

  apiKeys: z.object({
    openai: z.string().optional(),
    sendgrid: z.string().optional()
  }).optional()
}).partial();
