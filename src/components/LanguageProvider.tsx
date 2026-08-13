"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, getTranslation, t as interpolate } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dict: ReturnType<typeof getTranslation>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to Telugu for low-literacy users as requested
  const [lang, setLangState] = useState<Language>('te');
  const dict = getTranslation(lang);

  useEffect(() => {
    // Attempt to load from user_preferences if signed in
    async function fetchUserPref() {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('user_preferences')
          .select('preferred_language')
          .eq('id', session.user.id)
          .single();
        if (data?.preferred_language) {
          setLangState(data.preferred_language as Language);
        }
      }
    }
    fetchUserPref();
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    // Note: We don't save to backend here to avoid circular dependency.
    // The UI selector component will handle saving to backend.
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    // Basic dot notation getter
    const keys = key.split('.');
    let result: any = dict;
    for (const k of keys) {
      if (result && typeof result === 'object') {
        result = result[k as keyof typeof result];
      } else {
        return key; // fallback to key
      }
    }
    if (typeof result !== 'string') return key;
    return interpolate(result, vars);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dict }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
