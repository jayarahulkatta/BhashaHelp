"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { api, Scheme } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface VoiceInterfaceProps {}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  schemes?: Scheme[];
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function VoiceInterface({}: VoiceInterfaceProps) {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  
  const { isRecording, transcript, error: voiceError, startRecording, stopRecording } = useVoice(lang);
  
  const [appState, setAppState] = useState<'idle' | 'recording' | 'confirming' | 'searching' | 'speaking'>('idle');
  const [confirmedQuery, setConfirmedQuery] = useState('');
  const [textInput, setTextInput] = useState('');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiError, setApiError] = useState('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-scroll to bottom when messages or state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, appState, confirmedQuery]);

  // Handle voice recognition finish
  useEffect(() => {
    if (!isRecording && appState === 'recording') {
      queueMicrotask(() => {
        if (transcript.trim()) {
          setConfirmedQuery(transcript);
          setTextInput(transcript); // Load into text input for easy editing
          setAppState('confirming');
          
          api.voice.tts(transcript, lang).then(audioUrl => {
            if (audioRef.current) {
              audioRef.current.src = audioUrl;
              audioRef.current.play().catch(e => console.error("TTS playback failed:", e));
              setIsPlaying(true);
            }
          }).catch(e => console.error("TTS generation failed:", e));
        } else {
          setAppState('idle');
        }
      });
    }
  }, [isRecording, transcript, appState, lang]);

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setApiError('');
      setAppState('recording');
      startRecording();
    }
  };

  const executeSearch = async (queryToSearch: string) => {
    if (!queryToSearch.trim()) return;
    
    setAppState('searching');
    setApiError('');
    
    const newMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: `u-${newMsgId}`, role: 'user', text: queryToSearch }]);
    
    try {
      const res = await api.query.search(queryToSearch, lang, user?.id);
      
      setMessages(prev => [
        ...prev, 
        { id: `a-${newMsgId}`, role: 'assistant', text: res.answer, schemes: res.schemes || [] }
      ]);
      setAppState('speaking');
      
      if (res.answer) {
        try {
          const audioUrl = await api.voice.tts(res.answer, lang);
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.play();
            setIsPlaying(true);
          }
        } catch (ttsErr) {
          console.error("TTS playback failed:", ttsErr);
        }
      } else {
        setAppState('idle');
      }
    } catch (err) {
      setApiError(getErrorMessage(err, t('errors.search')));
      setAppState('idle');
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (appState === 'confirming') {
      executeSearch(textInput);
    } else if (textInput.trim()) {
      executeSearch(textInput);
      setTextInput('');
    }
  };

  const cancelQuery = () => {
    setAppState('idle');
    setConfirmedQuery('');
    setTextInput('');
    setApiError('');
  };

  return (
    <div className="flex flex-col flex-1 relative h-full w-full max-w-3xl mx-auto bg-slate-50">
      <audio 
        ref={audioRef} 
        onEnded={() => { setIsPlaying(false); setAppState('idle'); }}
        onPause={() => { setIsPlaying(false); setAppState('idle'); }}
        onPlay={() => setIsPlaying(true)}
        className="hidden" 
      />

      {/* Main Content Area (Scrollable Transcript) */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col space-y-6 pb-40 scroll-smooth"
      >
        {messages.length === 0 && appState === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-70">
            <h1 className="text-2xl font-semibold text-slate-800">{t('common.welcome')}</h1>
            <p className="text-slate-600 text-lg max-w-md">{t('common.description')}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 md:p-5 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-amber-600 text-white rounded-br-none' 
                : 'bg-white border border-amber-100 text-amber-950 rounded-bl-none'
            }`}>
              {msg.role === 'assistant' && <h3 className="font-semibold text-amber-900 mb-2 text-sm">{t('voice.answerHeading')}</h3>}
              <p className="leading-relaxed whitespace-pre-wrap text-base">{msg.text}</p>
              
              {msg.schemes && msg.schemes.length > 0 && (
                <div className="mt-4 space-y-3 pt-3 border-t border-amber-100">
                  <h4 className="font-semibold text-slate-800 text-sm">{t('results.relatedSchemes')}</h4>
                  <div className="space-y-2">
                    {msg.schemes.map((s) => (
                      <div key={s.id} className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                        <h5 className="font-medium text-amber-900 text-sm mb-1">{s.name}</h5>
                        <p className="text-slate-700 text-xs line-clamp-2">{s.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Temporary state indicators */}
        {(appState === 'recording' || appState === 'confirming') && (
          <div className="flex w-full justify-end">
            <div className="max-w-[85%] bg-amber-100 p-4 rounded-2xl rounded-br-none border border-amber-200 shadow-sm animate-pulse-slow">
              <p className="text-sm text-amber-700 font-medium mb-1">
                {appState === 'recording' ? t('states.recording') : t('voice.didYouMean')}
              </p>
              <p className="text-lg text-amber-900">
                {appState === 'confirming' ? confirmedQuery : transcript}
              </p>
            </div>
          </div>
        )}

        {appState === 'searching' && (
          <div className="flex w-full justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-amber-100 shadow-sm flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-slate-600">{t('states.searching')}</p>
            </div>
          </div>
        )}

        {/* Errors */}
        {(voiceError || apiError) && (
          <div className="w-full p-4 text-red-700 bg-red-50 rounded-xl border border-red-200 text-sm text-center">
            {voiceError || apiError}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)] z-20">
        
        {appState === 'confirming' ? (
          <div className="flex flex-col gap-3 max-w-3xl mx-auto">
            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <input 
                type="text" 
                value={textInput} 
                onChange={e => setTextInput(e.target.value)}
                className="flex-1 p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </form>
            <div className="flex gap-2">
              <button 
                onClick={cancelQuery}
                className="flex-1 py-3 text-base font-medium text-amber-900 bg-amber-100 rounded-xl hover:bg-amber-200 active:scale-95 transition-transform"
              >
                {t('common.reRecord')}
              </button>
              <button 
                onClick={() => executeSearch(textInput)}
                className="flex-[2] py-3 text-base font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 active:scale-95 transition-transform flex justify-center items-center gap-2"
              >
                <span>🔍</span> {t('common.search')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleTextSubmit} className="flex items-center gap-2 max-w-3xl mx-auto">
            <button 
              type="button"
              onClick={handleMicClick}
              disabled={appState === 'searching'}
              className={`p-4 rounded-full flex items-center justify-center transition-all focus:outline-none shadow-sm ${
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse shadow-red-200' 
                  : appState === 'searching' 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-600 text-white hover:bg-amber-700 hover:shadow-md'
              }`}
            >
              <span className="text-xl">{isRecording ? '🛑' : '🎤'}</span>
            </button>
            
            <input 
              type="text" 
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={t('voice.typeMessage')}
              disabled={appState === 'searching' || isRecording}
              className="flex-1 p-4 rounded-full border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
            />
            
            {(textInput.trim() || isPlaying) && (
              <button 
                type={isPlaying ? "button" : "submit"}
                onClick={isPlaying ? () => { audioRef.current?.pause(); setIsPlaying(false); } : undefined}
                className={`p-4 rounded-full flex items-center justify-center transition-all ${
                  isPlaying 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
              >
                <span className="text-xl">{isPlaying ? '⏸️' : '↗️'}</span>
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
