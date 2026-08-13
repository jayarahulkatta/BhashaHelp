"use client";

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageProvider';

interface AuthScreenProps {}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AuthScreen({}: AuthScreenProps) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Basic client-side validation
      if (phone.length < 10) throw new Error('Enter a valid phone number');
      
      const res = await api.auth.sendOtp(phone);
      setSessionId(res.sessionId);
      setStep('otp');
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (otp.length < 4) throw new Error('Enter the OTP');

      const res = await api.auth.verifyOtp(phone, otp, sessionId);
      
      // We received the one-time password to sign into Supabase
      if (!supabase) {
        throw new Error('Authentication is unavailable right now');
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: res.email,
        password: res.password
      });

      if (signInError) throw signInError;
      
      // Assuming AuthProvider picks up the session automatically and re-renders
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sign you in. Please request a new code and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 w-full max-w-sm mx-auto">
      <div className="w-full space-y-6">
        <h2 className="text-2xl font-semibold text-center mb-8">
          {t('common.welcome')}
        </h2>
        
        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <input 
              type="tel" 
              placeholder={t('auth.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-lg p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
              disabled={loading}
            />
            <button 
              type="submit"
              disabled={loading}
              aria-label="Send OTP code"
              className="w-full py-4 text-lg font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 active:scale-95 transition-transform disabled:opacity-70 flex items-center justify-center gap-2 min-h-[48px] focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <span>📞</span> {loading ? t('auth.sending') : t('auth.sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-sm text-slate-600 text-center mb-4">{t('auth.codeSent')}</div>
            <input 
              type="text" 
              inputMode="numeric"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full text-lg p-4 text-center tracking-widest rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
              disabled={loading}
            />
            <button 
              type="submit"
              disabled={loading}
              aria-label="Verify OTP code"
              className="w-full py-4 text-lg font-medium text-white bg-orange-600 rounded-xl hover:bg-orange-700 active:scale-95 transition-transform disabled:opacity-70 flex items-center justify-center gap-2 min-h-[48px] focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              <span>✅</span> {loading ? t('auth.checking') : t('auth.verifyCode')}
            </button>
            <button 
              type="button"
              onClick={() => setStep('phone')}
              disabled={loading}
              aria-label="Cancel and change phone number"
              className="w-full py-3 text-amber-700 text-sm hover:underline flex items-center justify-center gap-2 min-h-[48px] focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              {t('common.cancel')}
            </button>
          </form>
        )}
        
        {error && (
          <div className="p-4 mt-4 text-red-700 bg-red-50 rounded-xl border border-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
