import { describe, expect, it } from 'vitest';
import { schemeWithTranslationsSchema } from '@/lib/scheme-schemas';

const validScheme = {
  scheme_code: 'TG-TEST-001', name_en: 'Test Scheme', category: 'Health & Wellness', level: 'state', applicable_states: ['Telangana'],
  description_en: 'A verified test description.', benefits_en: 'A verified test benefit.', official_url: 'https://www.myscheme.gov.in',
  source: 'myscheme', eligibility_criteria: {}, last_verified_at: '2026-08-12', verified_by: 'test-curator',
  translations: [{ language_code: 'en', name: 'Test Scheme', description: 'A verified test description.', benefits: 'A verified test benefit.', eligibility_summary: 'Open to eligible residents.' }],
};

describe('curated scheme payload validation', () => {
  it('accepts a complete curator-verified scheme', () => {
    expect(schemeWithTranslationsSchema.safeParse(validScheme).success).toBe(true);
  });

  it('rejects a seed row without an official URL before import', () => {
    const invalidScheme = { ...validScheme, official_url: undefined };
    expect(schemeWithTranslationsSchema.safeParse(invalidScheme).success).toBe(false);
  });
});
