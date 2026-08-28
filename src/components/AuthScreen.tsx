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
      
      if (!supabase) {
        throw new Error('Authentication is unavailable right now');
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: res.email,
        password: res.password
      });

      if (signInError) throw signInError;
      
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sign you in. Please request a new code and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 w-full h-screen bg-gradient-to-br from-[#FFF5E5] via-white to-[#E8F5E9] relative overflow-hidden">
      
      {/* Decorative Ashoka Chakra background element */}
      <div className="absolute -top-32 -right-32 w-96 h-96 opacity-[0.03] pointer-events-none">
        <svg viewBox="0 0 100 100" className="animate-[spin_60s_linear_infinite]">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#000080" strokeWidth="2" />
          <circle cx="50" cy="50" r="10" fill="none" stroke="#000080" strokeWidth="1" />
          {Array.from({ length: 24 }).map((_, i) => (
            <line key={i} x1="50" y1="50" x2="50" y2="5" stroke="#000080" strokeWidth="1" transform={`rotate(${i * 15} 50 50)`} />
          ))}
        </svg>
      </div>

      <div className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-md shadow-2xl rounded-3xl p-8 border border-white/50 z-10">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#FF9933] to-[#138808] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 mb-6 relative overflow-hidden">
             <div className="absolute inset-0 bg-white/20"></div>
             <span className="text-3xl text-white drop-shadow-md relative z-10">🇮🇳</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight text-center">BhashaHelp</h1>
          <p className="text-slate-500 mt-2 text-center text-sm font-medium">{t('common.welcome')}</p>
        </div>
        
        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Mobile Number</label>
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center justify-center text-slate-500 font-medium">
                  +91
                </div>
                <div className="absolute left-12 w-[1px] h-6 bg-slate-200"></div>
                <input 
                  type="tel" 
                  placeholder={t('auth.phonePlaceholder')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-lg pl-16 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#FF9933]/50 focus:border-[#FF9933] outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                  disabled={loading}
                />
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 text-lg font-semibold text-white bg-gradient-to-r from-[#FF9933] to-[#E68A2E] rounded-xl hover:shadow-lg hover:shadow-orange-500/25 active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {t('auth.sendCode')}
                  <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-600 mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-sm text-slate-600 font-medium">{t('auth.codeSent')} <br/><span className="font-bold text-slate-800 mt-1 block">+91 {phone}</span></p>
            </div>
            
            <div className="space-y-1.5">
              <input 
                type="text" 
                inputMode="numeric"
                placeholder="• • • • • •"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full text-2xl p-4 text-center tracking-[0.5em] rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#138808]/50 focus:border-[#138808] outline-none transition-all font-bold text-slate-800"
                disabled={loading}
                autoFocus
              />
            </div>
            
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 text-lg font-semibold text-white bg-gradient-to-r from-[#138808] to-[#117A07] rounded-xl hover:shadow-lg hover:shadow-green-500/25 active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                t('auth.verifyCode')
              )}
            </button>
            
            <button 
              type="button"
              onClick={() => setStep('phone')}
              disabled={loading}
              className="w-full py-3 text-slate-500 font-medium text-sm hover:text-slate-700 transition-colors"
            >
              Change Phone Number
            </button>
          </form>
        )}
        
        {error && (
          <div className="mt-6 p-4 text-sm font-medium text-red-600 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3 animate-in fade-in duration-200">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p>{error}</p>
          </div>
        )}
      </div>
      
      <div className="absolute bottom-8 text-center text-xs text-slate-400 font-medium tracking-wide">
        Made for Bharat 🇮🇳
      </div>
    </div>
  );
}
