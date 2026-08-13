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

    // User is authenticated — load profile
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

  // Called when ProfileWizard completes (save or skip)
  const handleWizardComplete = async () => {
    if (user) {
      // Reload the freshly saved profile so SchemeResults has real data
      const fetchedProfile = await api.user.getProfile(user.id).catch(() => null);
      setProfile(fetchedProfile);
    }
    setView('results');
  };

  // Called when user clicks "Edit details" inside SchemeResults
  const handleEditProfile = () => {
    setView('wizard');
  };

  return (
    <main className="flex flex-col lg:flex-row flex-1 h-full w-full relative">
      {/* ── Header / Sidebar ─────────────────────────────────────────────── */}
      <header className="flex lg:flex-col justify-between lg:justify-start items-center lg:items-stretch px-4 py-3 lg:py-6 lg:px-6 lg:w-72 border-b lg:border-b-0 lg:border-r border-amber-100 bg-white shadow-sm lg:shadow-none shrink-0 z-10">
        <div className="font-bold text-xl lg:text-2xl text-amber-900 tracking-tight select-none lg:mb-8">
          Bhasha<span className="text-amber-600">Help</span>
        </div>
        
        <div className="flex lg:flex-col items-center lg:items-stretch gap-2 lg:gap-4 mt-auto">
          {/* Language selector — only show after auth */}
          {view !== 'auth' && view !== 'loading' && (
            <div className="lg:mt-auto">
              <select
                value={lang}
                onChange={e => handleLanguageChange(e.target.value as 'en' | 'te' | 'hi')}
                aria-label="Select language"
                className="w-full p-2 min-h-[44px] bg-amber-50 text-amber-900 border border-amber-200 rounded-lg font-medium text-sm focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
              >
                <option value="te">తెలుగు</option>
                <option value="hi">हिंदी</option>
                <option value="en">English</option>
              </select>
            </div>
          )}

          {user && (
            <button
              onClick={() => supabase?.auth.signOut()}
              className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center lg:justify-start gap-2 transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
              aria-label="Sign out"
              title="Sign out"
            >
              🚪 <span className="hidden lg:inline text-sm font-medium">Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
        {view === 'loading' && (
          <div className="flex flex-col flex-1 items-center justify-center h-full gap-4">
            <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
            <p className="text-amber-800 text-sm">Loading…</p>
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
