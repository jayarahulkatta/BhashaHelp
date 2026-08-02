import en from '../locales/en.json';
import te from '../locales/te.json';
import hi from '../locales/hi.json';

export type Language = 'en' | 'te' | 'hi';

const translations = {
  en,
  te,
  hi,
};

export function getTranslation(lang: Language) {
  return translations[lang];
}

// Helper to replace variables in translation strings like {{attempts}}
export function t(template: string, vars: Record<string, string | number> = {}): string {
  return Object.keys(vars).reduce(
    (acc, key) => acc.replace(new RegExp(`{{${key}}}`, 'g'), String(vars[key])),
    template
  );
}
