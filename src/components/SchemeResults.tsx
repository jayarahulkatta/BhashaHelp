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

function guessEligibility(scheme: any, profile: UserProfile): 'likely' | 'maybe' | null {
  const criteria = (scheme.eligibility_summary || JSON.stringify(scheme.eligibility_criteria || {})).toLowerCase();
  const name = (scheme.name || '').toLowerCase();

  if (!profile.gender && !profile.state && !profile.category) return null;

  if (profile.is_student && (criteria.includes('student') || name.includes('scholarship') || criteria.includes('class') || criteria.includes('school'))) {
    return 'likely';
  }

  if (profile.category) {
    const cat = profile.category.toLowerCase();
    if (criteria.includes(cat) || (cat === 'sc' && criteria.includes('scheduled caste')) || (cat === 'st' && criteria.includes('scheduled tribe'))) return 'likely';
  }

  if (profile.has_disability && (criteria.includes('disab') || criteria.includes('divyang'))) {
    return 'likely';
  }

  if (profile.is_minority && (criteria.includes('minority') || criteria.includes('muslim') || criteria.includes('christian'))) {
    return 'likely';
  }

  if (criteria.includes('farmer') || criteria.includes('kisan')) {
    return 'maybe';
  }

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
      <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        {t('results.likelyEligible')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#FFF5E5] text-[#FF9933] px-3 py-1 rounded-full border border-orange-200">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      {t('results.maybeEligible')}
    </span>
  );
}

function getCategoryIcon(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes('health') || cat.includes('aarogya')) return '🏥';
  if (cat.includes('education') || cat.includes('scholarship')) return '🎓';
  if (cat.includes('agri') || cat.includes('rythu') || cat.includes('kisan')) return '🌾';
  if (cat.includes('women') || cat.includes('child')) return '👩‍👧';
  if (cat.includes('housing') || cat.includes('awas')) return '🏠';
  if (cat.includes('finance') || cat.includes('insurance') || cat.includes('loan')) return '₹';
  if (cat.includes('employ') || cat.includes('skill')) return '💼';
  return '🏛️';
}

function SchemeCard({ scheme, profile }: { scheme: any; profile: UserProfile }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const eligibility = guessEligibility(scheme, profile);

  return (
    <article className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 flex flex-col h-full overflow-hidden ${expanded ? 'border-amber-300 ring-2 ring-amber-100 shadow-md' : 'border-slate-200 hover:border-amber-200 hover:shadow-md'}`}>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 shrink-0 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-2xl shadow-inner">
              {getCategoryIcon(scheme.category)}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{scheme.category}</p>
              <h3 className="font-bold text-lg text-slate-800 leading-tight">{scheme.name}</h3>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
           <EligibilityBadge level={eligibility} />
        </div>

        <p className={`text-sm text-slate-600 leading-relaxed font-medium ${expanded ? '' : 'line-clamp-2'}`}>
          {scheme.description}
        </p>

        {expanded && (
          <div className="mt-5 space-y-4 text-sm bg-slate-50 rounded-xl p-4 border border-slate-100 animate-in fade-in duration-300">
            <div className="flex gap-3">
              <span className="text-amber-500 text-lg">🎯</span>
              <div>
                <p className="font-bold text-slate-800 mb-1">{t('results.whoCanApply')}</p>
                <p className="text-slate-600 font-medium">{scheme.eligibility_summary || JSON.stringify(scheme.eligibility_criteria || {})}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-green-500 text-lg">💰</span>
              <div>
                <p className="font-bold text-slate-800 mb-1">{t('results.benefits')}</p>
                <p className="text-slate-600 font-medium">{scheme.benefits}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-blue-500 text-lg">📝</span>
              <div>
                <p className="font-bold text-slate-800 mb-1">{t('results.howToApply')}</p>
                <p className="text-slate-600 font-medium">{scheme.application_process || scheme.application_process_en}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto pt-5 flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-bold text-amber-600 hover:text-amber-700 focus:outline-none flex items-center gap-1"
          >
            {expanded ? t('results.showLess') : t('results.showDetails')}
            <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          {scheme.source_url || scheme.official_url ? (
            <a
              href={scheme.source_url || scheme.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              aria-label={`Apply for ${scheme.name} on official portal`}
            >
              {t('results.officialPortal')}
            </a>
          ) : null}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  React.useEffect(() => {
    let mounted = true;
    
    setLoading(true);
    setError('');
    
    api.schemes.match(lang)
      .then(res => {
        if (!mounted) return;
        setSchemes(res.schemes || []);
        setLoading(false);
      })
      .catch(err => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load schemes');
        setLoading(false);
      });
      
    return () => {
      mounted = false;
    };
  }, [lang, user?.id]);

  const profileSummaryParts: string[] = [];
  if (profile.gender) profileSummaryParts.push(profile.gender);
  if (profile.age) profileSummaryParts.push(`${profile.age} yrs`);
  if (profile.state) profileSummaryParts.push(profile.state);
  if (profile.category) profileSummaryParts.push(profile.category);
  if (profile.is_student) profileSummaryParts.push('Student');
  if (profile.has_disability) profileSummaryParts.push('Divyang');
  if (profile.is_minority) profileSummaryParts.push('Minority');

  return (
    <div className="flex flex-col flex-1 h-full w-full overflow-hidden bg-slate-50">
      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <div className="flex bg-white px-4 pt-2 shadow-sm z-10 shrink-0" role="tablist">
        <button
          role="tab"
          aria-selected={view === 'schemes'}
          onClick={() => setView('schemes')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-[3px] ${
            view === 'schemes'
              ? 'text-[#FF9933] border-[#FF9933]'
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`}
        >
          <span className="text-lg">📋</span> My Schemes
        </button>
        <button
          role="tab"
          aria-selected={view === 'voice'}
          onClick={() => setView('voice')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-[3px] ${
            view === 'voice'
              ? 'text-[#138808] border-[#138808]'
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`}
        >
          <span className="text-lg">🎤</span> Ask a Question
        </button>
      </div>

      {/* ── Schemes Tab ───────────────────────────────────────── */}
      {view === 'schemes' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Profile Summary Card */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-lg text-white">
             <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Your Profile</p>
                {profileSummaryParts.length > 0 ? (
                  <p className="text-sm font-medium flex flex-wrap gap-2">
                     {profileSummaryParts.map((p, i) => (
                       <span key={i} className="bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-sm">{p}</span>
                     ))}
                  </p>
                ) : (
                  <p className="text-sm text-slate-300">No profile details set</p>
                )}
             </div>
             <button
               onClick={onEditProfile}
               className="shrink-0 bg-white/10 hover:bg-white/20 p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
             >
               <span className="hidden sm:inline">Edit</span> ✏️
             </button>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4" role="status">
              <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-amber-700 font-medium animate-pulse">{t('results.findingSchemes')}</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-5 bg-red-50 border border-red-100 rounded-2xl text-red-700 flex items-start gap-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold mb-1">Could not load schemes</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && schemes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-4xl shadow-inner mb-2">
                🔍
              </div>
              <h3 className="text-xl font-bold text-slate-800">{t('results.noSchemesFound')}</h3>
              <p className="text-slate-500 text-sm max-w-xs font-medium">
                {t('results.noSchemesHint')}
              </p>
              <button onClick={() => setView('voice')} className="mt-4 px-6 py-3 bg-white border-2 border-slate-200 hover:border-amber-300 rounded-xl font-bold text-slate-700 transition-colors shadow-sm">
                 Ask a Question Instead
              </button>
            </div>
          )}

          {!loading && schemes.length > 0 && (
            <div className="space-y-4 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">
                  Top Matches For You
                </h2>
                <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  {schemes.length}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {schemes.map(scheme => (
                  <SchemeCard key={scheme.id} scheme={scheme} profile={profile} />
                ))}
              </div>
            </div>
          )}

          <div className="h-6" />
        </div>
      )}

      {/* ── Voice Tab ───────────────────────────────────────── */}
      {view === 'voice' && (
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          <VoiceInterface />
        </div>
      )}
    </div>
  );
}
