"use client";

import React, { useState } from 'react';
import { api, UserProfile } from '@/lib/api';
import { useAuth } from './AuthProvider';

interface ProfileWizardProps {
  onComplete: () => void;
}

export function ProfileWizard({ onComplete }: ProfileWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [profile, setProfile] = useState<Omit<UserProfile, 'id'>>({
    gender: null,
    age: null,
    state: null,
    category: null,
    is_disabled: false,
    is_minority: false,
    is_student: false,
  });

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await api.user.updateProfile(user.id, profile);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
      setLoading(false);
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
            <h2 className="text-2xl font-bold text-amber-950">Basic Details</h2>
            <p className="text-amber-800">Help us find schemes perfect for you.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">Gender</label>
                <select 
                  className="w-full p-4 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  value={profile.gender || ''}
                  onChange={e => setProfile({...profile, gender: e.target.value})}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Transgender">Transgender</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">Age</label>
                <input 
                  type="number" 
                  min="0" max="120"
                  className="w-full p-4 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="Enter your age"
                  value={profile.age || ''}
                  onChange={e => setProfile({...profile, age: parseInt(e.target.value) || null})}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
            <h2 className="text-2xl font-bold text-amber-950">Location & Category</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">State / Area</label>
                <input 
                  type="text" 
                  className="w-full p-4 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="e.g. Telangana, Maharashtra"
                  value={profile.state || ''}
                  onChange={e => setProfile({...profile, state: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">Social Category</label>
                <select 
                  className="w-full p-4 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  value={profile.category || ''}
                  onChange={e => setProfile({...profile, category: e.target.value})}
                >
                  <option value="">Select Category</option>
                  <option value="General">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
            <h2 className="text-2xl font-bold text-amber-950">Additional Info</h2>
            <p className="text-amber-800 text-sm mb-4">Many schemes target specific groups.</p>
            
            <div className="space-y-4">
              <label className="flex items-center p-4 bg-white border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                  checked={profile.is_student}
                  onChange={e => setProfile({...profile, is_student: e.target.checked})}
                />
                <span className="ml-3 text-amber-900 font-medium">I am a Student</span>
              </label>

              <label className="flex items-center p-4 bg-white border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                  checked={profile.is_disabled}
                  onChange={e => setProfile({...profile, is_disabled: e.target.checked})}
                />
                <span className="ml-3 text-amber-900 font-medium">I have a Disability (Divyang)</span>
              </label>

              <label className="flex items-center p-4 bg-white border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                  checked={profile.is_minority}
                  onChange={e => setProfile({...profile, is_minority: e.target.checked})}
                />
                <span className="ml-3 text-amber-900 font-medium">I belong to a Minority group</span>
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-amber-950">All Set!</h2>
            <p className="text-amber-800">Your profile is ready. We will use this to find the best schemes for you.</p>
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
              Back
            </button>
          )}
          
          {step < totalSteps ? (
            <button 
              onClick={handleNext}
              className="flex-[2] py-4 text-lg font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 active:scale-95 transition-all min-h-[48px]"
            >
              Next
            </button>
          ) : (
            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full py-4 text-lg font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 active:scale-95 transition-all min-h-[48px] flex items-center justify-center gap-2"
            >
              {loading ? 'Saving...' : 'Start Finding Schemes'}
            </button>
          )}
        </div>
        
        {step < totalSteps && (
          <button 
            onClick={skipWizard}
            className="text-amber-700 text-sm hover:underline py-2"
          >
            Skip for now
          </button>
        )}
      </div>

    </div>
  );
}
