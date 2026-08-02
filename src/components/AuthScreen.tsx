"use client";

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { Language, getTranslation } from '@/lib/i18n';

interface AuthScreenProps {
  lang: Language;
}

export function AuthScreen({ lang }: AuthScreenProps) {
  const t = getTranslation(lang);
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
    } catch (err: any) {
      setError(err.message || t.errors.generic);
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        phone: res.phone,
        password: res.password
      });

      if (signInError) throw signInError;
      
      // Assuming AuthProvider picks up the session automatically and re-renders
    } catch (err: any) {
      setError(err.message || t.auth.wrongCode.replace('{{attempts}}', 'some'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 w-full max-w-sm mx-auto">
      <div className="w-full space-y-6">
        <h2 className="text-2xl font-semibold text-center mb-8">
          {t.common.welcome}
        </h2>
        
        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <input 
              type="tel" 
              placeholder={t.auth.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-lg p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={loading}
            />
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 text-lg font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:scale-95 transition-transform disabled:opacity-70 flex items-center justify-center gap-2 min-h-[48px]"
            >
              <span>📞</span> {loading ? t.auth.sending : t.auth.sendCode}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-sm text-slate-600 text-center mb-4">{t.auth.codeSent}</div>
            <input 
              type="text" 
              inputMode="numeric"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full text-lg p-4 text-center tracking-widest rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={loading}
            />
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 text-lg font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 active:scale-95 transition-transform disabled:opacity-70 flex items-center justify-center gap-2 min-h-[48px]"
            >
              <span>✅</span> {loading ? t.auth.checking : t.auth.verifyCode}
            </button>
            <button 
              type="button"
              onClick={() => setStep('phone')}
              disabled={loading}
              className="w-full py-3 text-blue-600 text-sm hover:underline flex items-center justify-center gap-2 min-h-[48px]"
            >
              {t.common.cancel}
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
