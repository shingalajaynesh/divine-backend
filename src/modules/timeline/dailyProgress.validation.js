import { z } from 'zod';

export const dayNumberSchema = z.number().int().min(1).max(280);
export const quotientSchema = z.enum(['PQ', 'IQ', 'EQ', 'SQ']);

export const saveDailyActivityDetailsSchema = z.object({
  dayNumber: dayNumberSchema,
  quotient: quotientSchema,
  durationMins: z.number().int().min(0).optional().nullable(),
  evidence: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(10000).optional().nullable(),
});
