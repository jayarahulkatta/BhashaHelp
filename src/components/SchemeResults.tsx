"use client";

import React, { useState, useRef } from 'react';
import { api, Scheme, UserProfile } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { VoiceInterface } from './VoiceInterface';
import { useLanguage } from './LanguageProvider';

interface SchemeResultsProps {
  profile: UserProfile;
  onEditProfile: () => void;
}

type View = 'schemes' | 'voice';

// Eligibility badge: rough heuristic from profile + scheme eligibility text
function guessEligibility(scheme: Scheme, profile: UserProfile): 'likely' | 'maybe' | null {
  const criteria = (scheme.eligibility_criteria || '').toLowerCase();
  const name = (scheme.name || '').toLowerCase();

  // If profile has no data, can't guess
  if (!profile.gender && !profile.state && !profile.category) return null;

  // Student checks
  if (profile.is_student && (criteria.includes('student') || name.includes('scholarship'))) {
    return 'likely';
  }

  // Category checks
  if (profile.category) {
    const cat = profile.category.toLowerCase();
    if (criteria.includes(cat)) return 'likely';
  }

  // Disability
  if (profile.has_disability && (criteria.includes('disab') || criteria.includes('divyang'))) {
    return 'likely';
  }

  // Farmer / Rythu
  if (criteria.includes('farmer') || criteria.includes('kisan')) {
    // General welfare — show as maybe unless we know they're a farmer
    return 'maybe';
  }

  // Girl/women specific
  if ((criteria.includes('girl') || criteria.includes('women') || criteria.includes('matru')) &&
      profile.gender === 'Female') {
    return 'likely';
  }

  return 'maybe';
}

function EligibilityBadge({ level }: { level: 'likely' | 'maybe' | null }) {
  const { t } = useLanguage();
  if (!level) return null;
  if (level === 'likely') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
        {t('results.likelyEligible')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
      {t('results.maybeEligible')}
    </span>
  );
}

function SchemeCard({ scheme, profile }: { scheme: Scheme; profile: UserProfile }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const eligibility = guessEligibility(scheme, profile);

  return (
    <article className="bg-white border border-amber-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-base text-amber-950 leading-snug flex-1">{scheme.name}</h3>
          <EligibilityBadge level={eligibility} />
        </div>
        <p className={`text-sm text-slate-600 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
          {scheme.description}
        </p>

        {expanded && (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="font-medium text-amber-900 mb-1">{t('results.whoCanApply')}</p>
              <p className="text-slate-600 leading-relaxed">{scheme.eligibility_criteria}</p>
            </div>
            <div>
              <p className="font-medium text-amber-900 mb-1">{t('results.benefits')}</p>
              <p className="text-slate-600 leading-relaxed">{scheme.benefits}</p>
            </div>
            <div>
              <p className="font-medium text-amber-900 mb-1">{t('results.howToApply')}</p>
              <p className="text-slate-600 leading-relaxed">{scheme.application_process}</p>
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
          >
            {expanded ? t('results.showLess') : t('results.showDetails')}
          </button>
          {scheme.source_url && (
            <a
              href={scheme.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-500 hover:text-amber-700 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded px-1"
              aria-label={`Apply for ${scheme.name} on official portal`}
            >
              {t('results.officialPortal')}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function SchemeResults({ profile, onEditProfile }: SchemeResultsProps) {
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const [view, setView] = useState<View>('schemes');
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasFetchedRef = useRef(false);

  // Fetch personalized schemes on mount (once)
  React.useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const buildQuery = () => {
      const parts: string[] = ['schemes I may be eligible for'];
      if (profile.is_student) parts.push('student scholarships');
      if (profile.has_disability) parts.push('disability welfare');
      if (profile.is_minority) parts.push('minority welfare');
      if (profile.category && profile.category !== 'General') {
        parts.push(`${profile.category} community welfare`);
      }
      if (profile.state) parts.push(`${profile.state} state schemes`);
      return parts.join(', ');
    };

    api.query.search(buildQuery(), lang, user?.id)
      .then(res => {
        setSchemes(res.schemes || []);
        setAnswer(res.answer || '');
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load schemes');
        setLoading(false);
      });
  }, [lang, profile, user?.id]);

  const profileSummaryParts: string[] = [];
  if (profile.gender) profileSummaryParts.push(profile.gender);
  if (profile.age) profileSummaryParts.push(`age ${profile.age}`);
  if (profile.state) profileSummaryParts.push(profile.state);
  if (profile.category) profileSummaryParts.push(profile.category);
  if (profile.is_student) profileSummaryParts.push('Student');
  if (profile.has_disability) profileSummaryParts.push('Divyang');
  if (profile.is_minority) profileSummaryParts.push('Minority');

  return (
    <div className="flex flex-col flex-1 h-full w-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-amber-100 bg-amber-50 shrink-0" role="tablist">
        <button
          role="tab"
          aria-selected={view === 'schemes'}
          onClick={() => setView('schemes')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 ${
            view === 'schemes'
              ? 'text-amber-900 border-b-2 border-amber-600 bg-white'
              : 'text-amber-700 hover:text-amber-900'
          }`}
        >
          📋 My Schemes
        </button>
        <button
          role="tab"
          aria-selected={view === 'voice'}
          onClick={() => setView('voice')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 ${
            view === 'voice'
              ? 'text-amber-900 border-b-2 border-amber-600 bg-white'
              : 'text-amber-700 hover:text-amber-900'
          }`}
        >
          🎤 Ask a Question
        </button>
      </div>

      {/* Schemes tab */}
      {view === 'schemes' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Profile summary chip */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {profileSummaryParts.length > 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                📌 {profileSummaryParts.join(' · ')}
              </p>
            ) : (
              <p className="text-xs text-slate-400">No profile details set</p>
            )}
            <button
              onClick={onEditProfile}
              className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded whitespace-nowrap"
            >
              ✏️ Edit details
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4" role="status" aria-label="Loading schemes">
              <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
              <p className="text-amber-800 text-sm">{t('results.findingSchemes')}</p>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <p className="font-medium mb-1">Could not load schemes</p>
              <p>{error}</p>
            </div>
          )}

          {/* Answer summary card */}
          {!loading && !error && answer && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Summary</p>
              <p className="text-sm text-amber-950 leading-relaxed">{answer}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && schemes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <span className="text-4xl">🔍</span>
              <p className="text-slate-600 font-medium">{t('results.noSchemesFound')}</p>
              <p className="text-slate-400 text-sm max-w-xs">
                {t('results.noSchemesHint')}
              </p>
            </div>
          )}

          {/* Scheme cards */}
          {!loading && schemes.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {t('results.schemesFound', { count: schemes.length })}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {schemes.map(scheme => (
                  <SchemeCard key={scheme.id} scheme={scheme} profile={profile} />
                ))}
              </div>
            </div>
          )}

          {/* Bottom padding for scroll */}
          <div className="h-4" />
        </div>
      )}

      {/* Voice tab */}
      {view === 'voice' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <VoiceInterface />
        </div>
      )}
    </div>
  );
}
