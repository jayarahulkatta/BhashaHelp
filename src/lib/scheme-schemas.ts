import { z } from 'zod';

export const languageSchema = z.enum(['en', 'hi', 'te']);
const eligibilitySchema = z.object({
  age_min: z.number().int().min(0).max(120).optional(), age_max: z.number().int().min(0).max(120).optional(),
  gender: z.array(z.string()).optional(), category: z.array(z.string()).optional(), area: z.array(z.enum(['urban', 'rural'])).optional(),
  disability_required: z.boolean().optional(), minority_required: z.boolean().optional(), student_required: z.boolean().optional(),
}).strict();
export const schemeSchema = z.object({
  scheme_code: z.string().min(3).max(100), name_en: z.string().min(1), category: z.string().min(1), level: z.enum(['central', 'state']),
  nodal_ministry_or_dept: z.string().optional().nullable(), applicable_states: z.array(z.string()).min(1), description_en: z.string().min(1),
  benefits_en: z.string().min(1), application_process_en: z.string().optional().nullable(), required_documents: z.array(z.string()).default([]),
  official_url: z.url(), source: z.enum(['myscheme', 'data.gov.in', 'india.gov.in', 'official']), eligibility_criteria: eligibilitySchema.default({}),
  is_active: z.boolean().default(true), last_verified_at: z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), verified_by: z.string().min(1),
});
export const translationSchema = z.object({ language_code: languageSchema, name: z.string().min(1), description: z.string().min(1), benefits: z.string().min(1), eligibility_summary: z.string().min(1), needs_review: z.boolean().optional() });
export const schemeWithTranslationsSchema = schemeSchema.extend({ translations: z.array(translationSchema).min(1) });
export type SchemeInput = z.infer<typeof schemeSchema>;
