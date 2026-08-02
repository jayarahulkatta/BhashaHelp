"use client";

import React, { useState, useRef } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { api, Scheme } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { Language, getTranslation } from '@/lib/i18n';

interface VoiceInterfaceProps {
  lang: Language;
}

export function VoiceInterface({ lang }: VoiceInterfaceProps) {
  const t = getTranslation(lang);
  const { user } = useAuth();
  
  const { isRecording, transcript, error: voiceError, startRecording, stopRecording } = useVoice(lang);
  
  const [appState, setAppState] = useState<'idle' | 'recording' | 'confirming' | 'searching' | 'answering' | 'result'>('idle');
  const [confirmedQuery, setConfirmedQuery] = useState('');
  
  const [answer, setAnswer] = useState('');
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [apiError, setApiError] = useState('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // When speech recognition produces a final result or we stop it, check if we have text
  React.useEffect(() => {
    if (!isRecording && appState === 'recording') {
      if (transcript.trim()) {
        setConfirmedQuery(transcript);
        setAppState('confirming');
      } else {
        setAppState('idle');
      }
    }
  }, [isRecording, transcript, appState]);

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setApiError('');
      setAnswer('');
      setSchemes([]);
      setAppState('recording');
      startRecording();
    }
  };

  const handleSearch = async () => {
    setAppState('searching');
    setApiError('');
    try {
      const res = await api.query.search(confirmedQuery, lang, user?.id);
      setAnswer(res.answer);
      setSchemes(res.schemes || []);
      setAppState('result');
      
      // Auto-play TTS for the answer
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
          // Don't fail the whole search if TTS fails, just won't play audio.
        }
      }
    } catch (err: any) {
      setApiError(err.message || t.errors.search);
      setAppState('confirming');
    }
  };

  const cancelQuery = () => {
    setAppState('idle');
    setConfirmedQuery('');
    setApiError('');
  };

  return (
    <div className="flex flex-col flex-1 relative h-full w-full max-w-sm mx-auto">
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden" 
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center space-y-6 pb-32">
        
        {appState === 'idle' && !answer && (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-semibold text-slate-800">{t.common.welcome}</h1>
            <p className="text-slate-600 text-lg">{t.common.description}</p>
          </div>
        )}

        {(appState === 'recording' || appState === 'confirming') && (
          <div className="w-full bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-inner">
            <p className="text-lg text-slate-800 mb-2 font-medium">
              {appState === 'recording' ? t.states.recording : 'Did you mean:'}
            </p>
            <p className="text-xl text-blue-900 leading-relaxed min-h-[3rem]">
              {appState === 'confirming' ? confirmedQuery : transcript}
            </p>
          </div>
        )}

        {appState === 'searching' && (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-lg text-slate-600">{t.states.searching}</p>
          </div>
        )}

        {appState === 'result' && (
          <div className="w-full space-y-6">
            <div className="bg-green-50 p-6 rounded-2xl border border-green-100 shadow-sm relative">
              <button 
                onClick={() => {
                  if (isPlaying) {
                    audioRef.current?.pause();
                  } else {
                    audioRef.current?.play();
                  }
                }}
                className="absolute top-4 right-4 p-3 bg-white rounded-full shadow-sm text-green-700 hover:bg-green-100 active:scale-95 transition-transform min-h-[48px] min-w-[48px] flex items-center justify-center"
              >
                {isPlaying ? '⏸️' : '🔊'}
              </button>
              <h3 className="font-semibold text-green-900 mb-4 text-lg pr-12">Answer</h3>
              <p className="text-lg text-green-950 leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>

            {schemes.length > 0 && (
              <div className="space-y-4 mt-8">
                <h4 className="font-semibold text-slate-800 text-lg border-b pb-2">Related Schemes</h4>
                {schemes.map((s) => (
                  <div key={s.id} className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
                    <h5 className="font-semibold text-lg text-blue-700">{s.name}</h5>
                    <p className="text-slate-700 line-clamp-3">{s.description}</p>
                    <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium inline-flex items-center mt-2 p-2 -ml-2 rounded-lg hover:bg-blue-50">
                      Learn More ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Errors */}
        {(voiceError || apiError) && (
          <div className="w-full p-4 text-red-700 bg-red-50 rounded-xl border border-red-200">
            {voiceError || apiError}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.05)]">
        {appState === 'confirming' ? (
          <div className="flex gap-4">
            <button 
              onClick={cancelQuery}
              className="flex-1 py-4 text-lg font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 active:scale-95 transition-transform flex justify-center items-center gap-2 min-h-[48px]"
            >
              <span>❌</span> {t.common.reRecord}
            </button>
            <button 
              onClick={handleSearch}
              className="flex-1 py-4 text-lg font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 active:scale-95 transition-transform flex justify-center items-center gap-2 min-h-[48px]"
            >
              <span>🔍</span> Search
            </button>
          </div>
        ) : (
          <button 
            onClick={handleMicClick}
            disabled={appState === 'searching'}
            className={`w-full py-5 text-xl font-semibold text-white rounded-full flex items-center justify-center space-x-3 shadow-lg active:scale-95 transition-all min-h-[64px] ${
              isRecording 
                ? 'bg-red-500 animate-pulse' 
                : appState === 'searching' 
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <span className="text-2xl">{isRecording ? '🛑' : '🎤'}</span>
            <span>{isRecording ? t.states.recording : t.common.tapToSpeak}</span>
          </button>
        )}
      </div>
    </div>
  );
}
