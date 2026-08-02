"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AuthScreen } from '@/components/AuthScreen';
import { VoiceInterface } from '@/components/VoiceInterface';
import { Language } from '@/lib/i18n';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const { session, user, isLoading } = useAuth();
  const [lang, setLang] = useState<Language>('te');

  useEffect(() => {
    // If user is logged in, fetch their preferred language
    if (user) {
      supabase
        .from('user_preferences')
        .select('preferred_language')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data && data.preferred_language) {
            setLang(data.preferred_language as Language);
          }
        });
    }
  }, [user]);

  const handleLanguageChange = async (newLang: Language) => {
    setLang(newLang);
    if (user) {
      await api.preferences.saveLanguage(user.id, newLang);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="flex flex-col flex-1 h-full w-full relative">
      {/* Header with Language Selector & Logout */}
      <header className="flex justify-between items-center p-4 border-b bg-white z-10 shadow-sm">
        <div className="font-bold text-xl text-blue-700 tracking-tight">
          Bhasha<span className="text-orange-500">Help</span>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={lang}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="p-2 min-h-[44px] min-w-[44px] bg-slate-100 rounded-lg border-transparent focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-medium cursor-pointer"
          >
            <option value="te">తెలుగు</option>
            <option value="hi">हिंदी</option>
            <option value="en">English</option>
          </select>
          {user && (
            <button 
              onClick={() => supabase.auth.signOut()}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              title="Logout"
            >
              🚪
            </button>
          )}
        </div>
      </header>

      {/* Main Content routing based on auth state */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {session ? (
          <VoiceInterface lang={lang} />
        ) : (
          <AuthScreen lang={lang} />
        )}
      </div>
    </main>
  );
}
