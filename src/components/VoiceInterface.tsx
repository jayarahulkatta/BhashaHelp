"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { api, Scheme } from '@/lib/api';
import { useLanguage } from './LanguageProvider';
import { VoiceInput } from '@/components/ui/voice-input';
import { Volume2, VolumeX } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  schemes?: Scheme[];
  loading?: boolean;
}

export function VoiceInterface() {
  const { lang, t } = useLanguage();
  const { isRecording, transcript, error: voiceError, startRecording, stopRecording } = useVoice(lang);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState('');

  useEffect(() => () => {
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const speakMessage = async (text: string, idx: number) => {
    if (speakingIndex === idx) {
      audioRef.current?.pause();
      setSpeakingIndex(null);
      return;
    }
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    setSpeechError('');
    setSpeakingIndex(idx);
    try {
      const cleanText = text.replace(/https?:\/\/\S+/g, '').replace(/[📋💰📝📄🔗✅❌⚠️]/gu, '').replace(/\*+/g, '').trim();
      const url = await api.voice.tts(cleanText, lang);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setSpeakingIndex(null);
      audio.onerror = () => { setSpeakingIndex(null); setSpeechError('Audio could not be played. Please try again.'); };
      await audio.play();
    } catch (err) {
      setSpeakingIndex(null);
      setSpeechError(err instanceof Error ? err.message : 'Audio could not be generated.');
    }
  };

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => scrollToBottom(), [messages]);

  const handleQuery = React.useCallback(async (query: string) => {
    if (!query.trim()) return;

    const userMessage: ChatMessage = { role: 'user', text: query };
    const loadingMessage: ChatMessage = { role: 'assistant', text: '', loading: true };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setTextInput('');

    try {
      const res = await api.query.search(query, lang);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { 
          role: 'assistant', 
          text: res.answer, 
          schemes: res.schemes 
        }
      ]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('errors.answer');
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', text: `❌ ${errorMsg}` }
      ]);
    }
  }, [lang, t]);

  // Handle voice transcript updates
  useEffect(() => {
    if (transcript && !isRecording) {
      queueMicrotask(() => handleQuery(transcript));
    }
  }, [transcript, isRecording, handleQuery]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(textInput);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      
      {/* ── Chat History ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in duration-500 opacity-60">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-3xl mb-2">
              🎙️
            </div>
            <h3 className="text-xl font-bold text-slate-800">Ask BhashaHelp</h3>
            <p className="text-slate-500 max-w-xs font-medium text-sm">
              Tap the microphone and ask about any government scheme in English, Hindi, or Telugu.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-md">
              <span className="text-xs font-medium bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-full shadow-sm">&quot;What schemes are for farmers?&quot;</span>
              <span className="text-xs font-medium bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-full shadow-sm">&quot;How to apply for Dalit Bandhu?&quot;</span>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div 
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-[#138808] to-[#117A07] text-white rounded-tr-sm' 
                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                }`}
              >
                {msg.loading ? (
                  <div className="flex gap-1.5 items-center px-2 py-1">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed font-medium">
                    {msg.text}
                  </div>
                )}
              </div>
              {msg.role === 'assistant' && !msg.loading && msg.text && (
                <button type="button" onClick={() => speakMessage(msg.text, idx)} aria-label={speakingIndex === idx ? 'Stop reading answer' : 'Read answer aloud'} className="mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800">
                  {speakingIndex === idx ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  {speakingIndex === idx ? 'Stop' : 'Read aloud'}
                </button>
              )}
              
              {msg.schemes && msg.schemes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 max-w-[85%]">
                  {msg.schemes.slice(0,3).map(s => (
                     <span key={s.id} className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                       {s.name}
                     </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ───────────────────────────────────────── */}
      <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] shrink-0 z-10">
        
        {voiceError && (
          <div className="mb-3 p-2 bg-red-50 text-red-600 text-xs font-semibold rounded-lg text-center animate-in slide-in-from-bottom-2">
            ⚠️ {voiceError}
          </div>
        )}
        {speechError && <div role="status" className="mb-2 text-center text-xs text-red-600">{speechError}</div>}
        
        <div className="flex gap-2 sm:gap-3 max-w-4xl mx-auto">
          <form onSubmit={handleTextSubmit} className="flex-1 relative flex items-center">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t('voice.typeMessage')}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-base font-medium rounded-2xl py-3.5 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-[#FF9933]/50 focus:border-[#FF9933] focus:bg-white transition-all shadow-inner"
              disabled={isRecording}
            />
            <button 
              type="submit" 
              disabled={!textInput.trim() || isRecording}
              className="absolute right-2 w-9 h-9 flex items-center justify-center text-amber-600 disabled:text-slate-300 disabled:opacity-50 hover:bg-amber-50 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
          
          <VoiceInput 
            isRecording={isRecording}
            onStart={startRecording}
            onStop={stopRecording}
            className="w-auto h-auto"
          />
        </div>
        
        {isRecording && (
          <div className="text-center mt-3 text-xs font-bold text-red-500 animate-pulse uppercase tracking-wider">
            Listening... Tap to stop
          </div>
        )}
      </div>
    </div>
  );
}
