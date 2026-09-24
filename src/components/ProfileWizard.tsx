"use client";

import React, { useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { api, UserProfile } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

interface ProfileWizardProps {
  onComplete: () => void;
  isEditing?: boolean;
  profile?: UserProfile | null;
}

export function ProfileWizard({ onComplete, isEditing = false, profile }: ProfileWizardProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [gender, setGender] = useState<string>(profile?.gender ?? '');
  const [area, setArea] = useState<string>(profile?.area ?? '');
  const [age, setAge] = useState<string>(profile?.age?.toString() ?? '');
  const [stateName, setStateName] = useState<string>(profile?.state ?? 'Telangana');
  const [category, setCategory] = useState<string>(profile?.category ?? '');
  const [isStudent, setIsStudent] = useState<boolean>(profile?.is_student ?? false);
  const [hasDisability, setHasDisability] = useState<boolean>(profile?.has_disability ?? false);
  const [isMinority, setIsMinority] = useState<boolean>(profile?.is_minority ?? false);
  const [occupation, setOccupation] = useState(profile?.occupation ?? '');
  const [annualIncome, setAnnualIncome] = useState(profile?.annual_income ?? '');
  const [isFarmer, setIsFarmer] = useState(profile?.is_farmer ?? false);
  const [maritalStatus, setMaritalStatus] = useState(profile?.marital_status ?? '');
  const [ownsHome, setOwnsHome] = useState(profile?.owns_home ?? false);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const updates: Partial<UserProfile> = {
        gender,
        area: area as 'rural' | 'urban',
        age: age ? parseInt(age, 10) : undefined,
        state: stateName,
        category,
        is_student: isStudent,
        has_disability: hasDisability,
        is_minority: isMinority,
        occupation: occupation || null,
        annual_income: annualIncome || null,
        is_farmer: isFarmer,
        marital_status: maritalStatus || null,
        owns_home: ownsHome,
      };
      
      await api.user.updateProfile(user.id, updates);
      onComplete();
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, title: t('wizard.step1Title') },
    { num: 2, title: t('wizard.step2Title') },
    { num: 3, title: t('wizard.step3Title') },
    { num: 4, title: t('wizard.step4Title') }
  ];

  return (
    <div className="flex flex-col h-full bg-white relative animate-in fade-in duration-300">
      {/* ── Header Progress ───────────────────────────────────────── */}
      <div className="px-6 py-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-b-3xl shadow-lg relative overflow-hidden">
         {/* Decorative Element */}
         <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
         <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-amber-500/20 rounded-full blur-xl"></div>
         
         <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">{steps[step - 1].title}</h2>
            <p className="text-slate-300 text-sm mb-6 opacity-90">{step === 1 ? t('wizard.step1Desc') : step === 3 ? t('wizard.step3Desc') : ''}</p>
            
            {/* Progress Bar */}
            <div className="flex gap-2 w-full">
              {steps.map(s => (
                <div key={s.num} className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out ${s.num <= step ? 'bg-amber-400' : 'w-0'}`} 
                    style={{ width: s.num <= step ? '100%' : '0%' }}
                  />
                </div>
              ))}
            </div>
         </div>
      </div>

      {/* ── Form Content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        
        {step === 1 && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-800">{t('wizard.gender')}</label>
              <div className="grid grid-cols-2 gap-3">
                {['Male', 'Female', 'Transgender', 'Other'].map(g => (
                  <button 
                    key={g}
                    onClick={() => setGender(g)}
                    className={`p-4 rounded-2xl border-2 font-medium transition-all ${
                      gender === g 
                        ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm' 
                        : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-amber-200 hover:bg-slate-100'
                    }`}
                  >
                    {t(`wizard.${g.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-800">{t('wizard.area')}</label>
              <div className="grid grid-cols-2 gap-3">
                {['Rural', 'Urban'].map(a => (
                  <button 
                    key={a}
                    onClick={() => setArea(a.toLowerCase())}
                    className={`p-4 rounded-2xl border-2 font-medium transition-all ${
                      area === a.toLowerCase() 
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-sm' 
                        : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-green-200 hover:bg-slate-100'
                    }`}
                  >
                    {t(`wizard.${a.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-800">{t('wizard.age')}</label>
              <input 
                type="number"
                min="0"
                max="120"
                placeholder={t('wizard.agePlaceholder')}
                value={age}
                onChange={e => setAge(e.target.value)}
                className="w-full p-4 text-lg rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-medium text-slate-800"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-800">{t('wizard.state')}</label>
              <select 
                value={stateName}
                onChange={e => setStateName(e.target.value)}
                className="w-full p-4 text-lg rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-medium text-slate-800"
              >
                {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'].sort().map(state => <option key={state} value={state}>{state}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-800">{t('wizard.category')}</label>
              <div className="grid grid-cols-2 gap-3">
                {['General', 'OBC', 'SC', 'ST', 'EWS', 'DNT', 'Safai Mitra'].map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`p-4 rounded-2xl border-2 font-medium transition-all ${
                      category === cat 
                        ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm' 
                        : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-amber-200 hover:bg-slate-100'
                    }`}
                  >
                    {['EWS', 'DNT', 'Safai Mitra'].includes(cat) ? cat : t(`wizard.${cat.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-800">Work and household details</label>
              <label className="block text-sm font-medium text-slate-600">Occupation
                <select value={occupation} onChange={e => setOccupation(e.target.value)} className="mt-2 w-full p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <option value="">Choose if you like</option>{['Worker', 'Artisan', 'Self-employed', 'Government employee', 'Unemployed', 'Other'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-600">Approximate annual family income
                <select value={annualIncome} onChange={e => setAnnualIncome(e.target.value)} className="mt-2 w-full p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <option value="">Prefer not to say</option>{['Below ₹1 lakh', '₹1–3 lakh', '₹3–6 lakh', '₹6–12 lakh', 'Above ₹12 lakh'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-600">Marital status
                <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} className="mt-2 w-full p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <option value="">Prefer not to say</option>{['Single', 'Married', 'Widowed', 'Other'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
              {[{label:'I work in farming', value:isFarmer, set:setIsFarmer}, {label:'My household owns a pucca house', value:ownsHome, set:setOwnsHome}].map(item => (
                <button type="button" key={item.label} onClick={() => item.set(!item.value)} aria-pressed={item.value} className={`w-full p-4 rounded-xl border text-left ${item.value ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>{item.value ? '✓ ' : '○ '}{item.label}</button>
              ))}
            </div>
            <button
              onClick={() => setIsStudent(!isStudent)}
              className={`w-full flex items-center p-5 rounded-2xl border-2 transition-all text-left ${
                isStudent ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center mr-4 transition-colors ${
                isStudent ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'
              }`}>
                {isStudent && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div>
                 <div className={`font-semibold text-lg ${isStudent ? 'text-amber-900' : 'text-slate-700'}`}>{t('wizard.isStudent')}</div>
                 <div className="text-sm text-slate-500 font-medium">Scholarships and education schemes</div>
              </div>
            </button>
            
            <button
              onClick={() => setHasDisability(!hasDisability)}
              className={`w-full flex items-center p-5 rounded-2xl border-2 transition-all text-left ${
                hasDisability ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center mr-4 transition-colors ${
                hasDisability ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'
              }`}>
                {hasDisability && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div>
                 <div className={`font-semibold text-lg ${hasDisability ? 'text-amber-900' : 'text-slate-700'}`}>{t('wizard.isDisability')}</div>
                 <div className="text-sm text-slate-500 font-medium">Disability pensions and special support</div>
              </div>
            </button>
            
            <button
              onClick={() => setIsMinority(!isMinority)}
              className={`w-full flex items-center p-5 rounded-2xl border-2 transition-all text-left ${
                isMinority ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center mr-4 transition-colors ${
                isMinority ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'
              }`}>
                {isMinority && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div>
                 <div className={`font-semibold text-lg ${isMinority ? 'text-amber-900' : 'text-slate-700'}`}>{t('wizard.isMinority')}</div>
                 <div className="text-sm text-slate-500 font-medium">Minority welfare and finance schemes</div>
              </div>
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center justify-center text-center py-12 space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{t('wizard.step4Desc')}</h3>
            <p className="text-slate-500 max-w-xs font-medium">
              We&apos;ll match you with the best government schemes based on your profile.
            </p>
          </div>
        )}

      </div>

      {/* ── Footer Actions ───────────────────────────────────────── */}
      <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-2 gap-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        {step > 1 ? (
          <button 
            onClick={handleBack}
            className="py-4 text-lg font-bold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 active:scale-95 transition-all"
          >
            {t('common.back')}
          </button>
        ) : (
          <button 
            onClick={isEditing ? onComplete : () => {}} 
            disabled={!isEditing}
            className={`py-4 text-lg font-bold rounded-2xl transition-all ${
              isEditing 
                ? 'text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95' 
                : 'text-slate-400 bg-slate-50 opacity-50 cursor-not-allowed'
            }`}
          >
            {isEditing ? t('common.cancel') : ''}
          </button>
        )}
        
        {step < 4 ? (
          <button 
            onClick={handleNext}
            className="py-4 text-lg font-bold text-white bg-slate-900 rounded-2xl hover:bg-slate-800 active:scale-95 transition-all shadow-lg shadow-slate-900/20"
          >
            {t('common.next')}
          </button>
        ) : (
          <button 
            onClick={handleSave}
            disabled={loading}
            className="py-4 text-lg font-bold text-white bg-gradient-to-r from-[#FF9933] to-[#138808] rounded-2xl hover:shadow-xl hover:shadow-green-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : isEditing ? t('common.save') : t('wizard.startFinding')}
          </button>
        )}
      </div>
    </div>
  );
}
