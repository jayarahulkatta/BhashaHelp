"use client";

import React, { useState } from 'react';
import { api, UserProfile } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface ProfileWizardProps {
  onComplete: () => void;
  /** If true, the final button says "Save Changes" and the wizard feels like editing */
  isEditing?: boolean;
}

export function ProfileWizard({ onComplete, isEditing = false }: ProfileWizardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [prefilling, setPrefilling] = useState(isEditing);
  const [error, setError] = useState('');
  
  const [profile, setProfile] = useState<Omit<UserProfile, 'id'>>({
    gender: null,
    age: null,
    state: 'Telangana',
    category: null,
    area: null,
    has_disability: false,
    disability_percentage: null,
    is_minority: false,
    is_student: false,
  });

  const totalSteps = 4;

  // Pre-load existing profile when editing so fields are pre-filled
  React.useEffect(() => {
    if (!isEditing || !user) return;
    api.user.getProfile(user.id).then(existing => {
      if (existing) {
        setProfile({
          gender: existing.gender ?? null,
          age: existing.age ?? null,
          state: existing.state ?? 'Telangana',
          category: existing.category ?? null,
          area: existing.area ?? null,
          has_disability: existing.has_disability ?? false,
          disability_percentage: existing.disability_percentage ?? null,
          is_minority: existing.is_minority ?? false,
          is_student: existing.is_student ?? false,
        });
      }
      setPrefilling(false);
    }).catch(() => setPrefilling(false));
  }, [isEditing, user]);

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      await api.user.updateProfile(user.id, profile);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
      setSaving(false);
    }
  };

  const skipWizard = () => {
    // If user skips, we still consider it complete for the session, 
    // or we can save an empty profile to prevent showing it again.
    // For now, let's just trigger onComplete.
    onComplete();
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 w-full max-w-sm mx-auto bg-amber-50 rounded-2xl shadow-sm border border-amber-100 my-8 relative overflow-hidden">
      
      {/* Pre-fill loading spinner for edit mode */}
      {prefilling && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
        </div>
      )}

      {!prefilling && <>
      {/* Progress Stepper */}
      <div className="w-full mb-8 flex items-center justify-between px-2">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div key={idx} className="flex-1 flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-300 ${
              step > idx + 1 ? 'bg-amber-600 text-white' : 
              step === idx + 1 ? 'bg-amber-500 text-white ring-4 ring-amber-100' : 
              'bg-amber-200 text-amber-800'
            }`}>
              {step > idx + 1 ? '✓' : idx + 1}
            </div>
            {idx < totalSteps - 1 && (
              <div className={`flex-1 h-1 mx-2 rounded transition-colors duration-300 ${
                step > idx + 1 ? 'bg-amber-500' : 'bg-amber-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full flex-1 flex flex-col justify-center">
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
            <h2 className="text-2xl font-bold text-amber-950">{t('wizard.step1Title')}</h2>
            <p className="text-amber-800">{t('wizard.step1Desc')}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">{t('wizard.gender')}</label>
                <select 
                  className="w-full p-4 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  value={profile.gender || ''}
                  onChange={e => setProfile({...profile, gender: e.target.value})}
                >
                  <option value="">{t('wizard.selectGender')}</option>
                  <option value="Male">{t('wizard.male')}</option>
                  <option value="Female">{t('wizard.female')}</option>
                  <option value="Transgender">{t('wizard.transgender')}</option>
                  <option value="Other">{t('wizard.other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">{t('wizard.area')}</label>
                <select className="w-full p-4 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none" value={profile.area || ''} onChange={e => setProfile({...profile, area: (e.target.value || null) as UserProfile['area']})}>
                  <option value="">{t('wizard.selectArea')}</option><option value="rural">{t('wizard.rural')}</option><option value="urban">{t('wizard.urban')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">{t('wizard.age')}</label>
                <input 
                  type="number" 
                  min="0" max="120"
                  className="w-full p-4 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder={t('wizard.agePlaceholder')}
                  value={profile.age || ''}
                  onChange={e => setProfile({...profile, age: parseInt(e.target.value) || null})}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
            <h2 className="text-2xl font-bold text-amber-950">{t('wizard.step2Title')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">{t('wizard.state')}</label>
                <input 
                  type="text" 
                  className="w-full p-4 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder={t('wizard.statePlaceholder')}
                  value={profile.state || ''}
                  onChange={e => setProfile({...profile, state: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">{t('wizard.category')}</label>
                <select 
                  className="w-full p-4 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  value={profile.category || ''}
                  onChange={e => setProfile({...profile, category: e.target.value})}
                >
                  <option value="">{t('wizard.selectCategory')}</option>
                  <option value="General">{t('wizard.general')}</option>
                  <option value="OBC">{t('wizard.obc')}</option>
                  <option value="SC">{t('wizard.sc')}</option>
                  <option value="ST">{t('wizard.st')}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
            <h2 className="text-2xl font-bold text-amber-950">{t('wizard.step3Title')}</h2>
            <p className="text-amber-800 text-sm mb-4">{t('wizard.step3Desc')}</p>
            
            <div className="space-y-4">
              <label className="flex items-center p-4 bg-white border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                  checked={profile.is_student}
                  onChange={e => setProfile({...profile, is_student: e.target.checked})}
                />
                <span className="ml-3 text-amber-900 font-medium">{t('wizard.isStudent')}</span>
              </label>

              <label className="flex items-center p-4 bg-white border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                  checked={profile.has_disability}
                  onChange={e => setProfile({...profile, has_disability: e.target.checked})}
                />
                <span className="ml-3 text-amber-900 font-medium">{t('wizard.isDisability')}</span>
              </label>

              <label className="flex items-center p-4 bg-white border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                  checked={profile.is_minority}
                  onChange={e => setProfile({...profile, is_minority: e.target.checked})}
                />
                <span className="ml-3 text-amber-900 font-medium">{t('wizard.isMinority')}</span>
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-amber-950">{t('wizard.step4Title')}</h2>
            <p className="text-amber-800">{t('wizard.step4Desc')}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 text-red-700 bg-red-50 rounded-xl border border-red-200 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="w-full mt-8 flex flex-col gap-3">
        <div className="flex gap-3">
          {step > 1 && step < totalSteps && (
            <button 
              onClick={handleBack}
              className="flex-1 py-4 text-lg font-medium text-amber-900 bg-amber-200 rounded-xl hover:bg-amber-300 active:scale-95 transition-all min-h-[48px]"
            >
              {t('common.back')}
            </button>
          )}
          
          {step < totalSteps ? (
            <button 
              onClick={handleNext}
              className="flex-[2] py-4 text-lg font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 active:scale-95 transition-all min-h-[48px]"
            >
              {t('common.next')}
            </button>
          ) : (
            <button 
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 text-lg font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 active:scale-95 transition-all min-h-[48px] flex items-center justify-center gap-2"
            >
              {saving ? t('wizard.saving') : isEditing ? t('common.save') : t('wizard.startFinding')}
            </button>
          )}
        </div>
        
        {step < totalSteps && (
          <button 
            onClick={skipWizard}
            className="text-amber-700 text-sm hover:underline py-2"
          >
            {t('common.skip')}
          </button>
        )}
      </div>

      </>}
    </div>
  );
}
