import { z } from 'zod';

const emptyToUndefined = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export const submitInquirySchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.preprocess(emptyToUndefined, z.string().email().max(254).optional()),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{10,20}$/),
  city: z.string().trim().min(2).max(120),
  language: z.enum(['en', 'hi', 'gu']).default('en'),
  preferredCallTime: z.preprocess(emptyToUndefined, z.string().max(80).optional()),
  message: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  source: z.enum(['marketing_website', 'member_web', 'mobile']).default('marketing_website'),
});

export const inquiryStatusSchema = z.enum(['pending', 'in_progress', 'resolved', 'closed']);

export const inquiryReplySchema = z.string().trim().min(2).max(4000);
