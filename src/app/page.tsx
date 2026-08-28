"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AuthScreen } from '@/components/AuthScreen';
import { ProfileWizard } from '@/components/ProfileWizard';
import { SchemeResults } from '@/components/SchemeResults';
import { useLanguage } from '@/components/LanguageProvider';
import { api, UserProfile } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type AppView = 'loading' | 'auth' | 'wizard' | 'results';

export default function Home() {
  const { session, user, isLoading } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [view, setView] = useState<AppView>('loading');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!session || !user) {
      setView('auth');
      return;
    }

    if (!supabase) {
      setView('wizard');
      return;
    }

    api.user.getProfile(user.id)
      .then((fetchedProfile) => {
        const hasBasicProfile =
          fetchedProfile &&
          (fetchedProfile.gender || fetchedProfile.age || fetchedProfile.state);

        if (hasBasicProfile) {
          setProfile(fetchedProfile);
          setView('results');
        } else {
          setView('wizard');
        }
      })
      .catch(err => {
        console.error('Failed to load user data:', err);
        setView('wizard');
      });
  }, [isLoading, session, user]);

  const handleLanguageChange = async (newLang: 'en' | 'te' | 'hi') => {
    setLang(newLang);
    if (user) {
      await api.preferences.saveLanguage(user.id, newLang).catch(console.error);
    }
  };

  const handleWizardComplete = async () => {
    if (user) {
      const fetchedProfile = await api.user.getProfile(user.id).catch(() => null);
      setProfile(fetchedProfile);
    }
    setView('results');
  };

  const handleEditProfile = () => {
    setView('wizard');
  };

  const formatPhoneNumber = (phone: string | undefined) => {
    if (!phone) return '';
    return phone.replace('+91', '').replace(/(\d{5})(\d{5})/, '$1 $2');
  };

  return (
    <main className="flex flex-col flex-1 h-screen w-full relative bg-slate-50 overflow-hidden font-sans">
      
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      {view !== 'loading' && view !== 'auth' && (
        <header className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 bg-white shadow-sm border-b border-slate-200 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-tr from-[#FF9933] to-[#138808] rounded-xl flex items-center justify-center shadow-md">
              <span className="text-xl sm:text-2xl text-white">🇮🇳</span>
            </div>
            <div>
              <div className="font-bold text-lg sm:text-xl text-slate-800 tracking-tight leading-none">
                Bhasha<span className="text-[#FF9933]">Help</span>
              </div>
              <div className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 tracking-wide">
                GOVERNMENT SCHEMES
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-6">
            {user && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">Logged in as</span>
                <span className="text-sm font-bold text-slate-700">+91 {formatPhoneNumber(user.user_metadata?.phone)}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 sm:gap-3 bg-slate-100 p-1 rounded-lg">
              {(['en', 'hi', 'te'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLanguageChange(l)}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                    lang === l 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  {l === 'en' ? 'ENG' : l === 'hi' ? 'हिंदी' : 'తెలుగు'}
                </button>
              ))}
            </div>

            {user && (
              <button
                onClick={() => supabase?.auth.signOut()}
                className="p-2 sm:px-4 sm:py-2 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors border border-red-100"
                aria-label="Sign out"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </header>
      )}

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full max-w-7xl mx-auto">
        {view === 'loading' && (
          <div className="flex flex-col flex-1 items-center justify-center h-full gap-5 bg-gradient-to-br from-[#FFF5E5] via-white to-[#E8F5E9]">
             <div className="relative">
                <div className="w-16 h-16 border-4 border-[#FF9933]/20 border-t-[#FF9933] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-[#138808]/20 border-b-[#138808] rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
                </div>
             </div>
            <p className="text-slate-600 font-medium animate-pulse">Loading BhashaHelp...</p>
          </div>
        )}

        {view === 'auth' && <AuthScreen />}

        {view === 'wizard' && (
          <ProfileWizard onComplete={handleWizardComplete} isEditing={profile !== null} />
        )}

        {view === 'results' && (
          <SchemeResults
            profile={profile ?? {}}
            onEditProfile={handleEditProfile}
          />
        )}
      </div>
    </main>
  );
}
