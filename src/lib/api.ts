import { Language } from './i18n';
import { supabase } from './supabase';

export interface Scheme {
  id: string;
  name: string;
  description: string;
  eligibility_criteria: string;
  benefits: string;
  application_process: string;
  similarity: number;
  source_url?: string;
}

export interface QueryResponse {
  answer: string;
  schemes: Scheme[];
  error?: string;
}

export interface UserProfile {
  id?: string;
  gender?: string | null;
  age?: number | null;
  state?: string | null;
  category?: string | null;
  is_disabled?: boolean;
  is_minority?: boolean;
  is_student?: boolean;
}


export const api = {
  auth: {
    sendOtp: async (phone: string) => {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send OTP');
      }
      return res.json() as Promise<{ sessionId: string, phone: string }>;
    },
    
    verifyOtp: async (phone: string, otp: string, sessionId: string) => {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, sessionId })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to verify OTP');
      }
      // Returns { phone, password } for immediate Supabase sign in
      return res.json() as Promise<{ email: string, phone: string, password: string }>;
    }
  },

  query: {
    search: async (text: string, lang: Language, userId?: string): Promise<QueryResponse> => {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang, userId })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Search failed');
      }
      return res.json();
    }
  },

  voice: {
    // Calls Bhashini TTS and returns an object URL of the audio
    tts: async (text: string, lang: Language): Promise<string> => {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'TTS failed');
      }
      const data = await res.json();
      if (!data.audioContent) {
        throw new Error('No audio received');
      }
      
      // Convert base64 to Blob URL
      const byteCharacters = atob(data.audioContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' }); // Usually WAV or MP3
      return URL.createObjectURL(blob);
    }
  },

  preferences: {
    saveLanguage: async (userId: string, lang: Language) => {
      if (!supabase) {
        throw new Error('Supabase client is unavailable');
      }

      const { error } = await supabase
        .from('user_preferences')
        .upsert({ id: userId, preferred_language: lang });
      
      if (error) {
        console.error('Failed to save language preference:', error);
        throw error;
      }
    }
  },

  user: {
    getProfile: async (userId: string): Promise<UserProfile | null> => {
      if (!supabase) throw new Error('Supabase client is unavailable');
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Failed to get user profile:', error);
        throw error;
      }
      return data || null;
    },

    updateProfile: async (userId: string, profile: Omit<UserProfile, 'id'>) => {
      if (!supabase) throw new Error('Supabase client is unavailable');
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ id: userId, ...profile });
      
      if (error) {
        console.error('Failed to update user profile:', error);
        throw error;
      }
    }
  }
};
