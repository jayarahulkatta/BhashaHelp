"use client";

import React, { useState, useRef } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { api, Scheme } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { Language, getTranslation } from '@/lib/i18n';

interface VoiceInterfaceProps {
  lang: Language;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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
      queueMicrotask(() => {
        if (transcript.trim()) {
          setConfirmedQuery(transcript);
          setAppState('confirming');
          
          // Auto-play the transcribed query via TTS as confirmation
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
    } catch (err) {
      setApiError(getErrorMessage(err, t.errors.search));
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
          <div className="w-full bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-inner" role="status" aria-live="polite">
            <p className="text-lg text-slate-800 mb-2 font-medium">
              {appState === 'recording' ? t.states.recording : 'Did you mean:'}
            </p>
            <p className="text-xl text-amber-900 leading-relaxed min-h-[3rem]">
              {appState === 'confirming' ? confirmedQuery : transcript}
            </p>
          </div>
        )}

        {appState === 'searching' && (
          <div className="flex flex-col items-center justify-center p-8 space-y-4" role="status" aria-label="Searching">
            <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
            <p className="text-lg text-slate-600">{t.states.searching}</p>
          </div>
        )}

        {appState === 'result' && (
          <div className="w-full space-y-6" role="region" aria-label="Search Results">
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-sm relative">
              <button 
                onClick={() => {
                  if (isPlaying) {
                    audioRef.current?.pause();
                  } else {
                    audioRef.current?.play();
                  }
                }}
                aria-label={isPlaying ? "Pause audio" : "Play audio"}
                className="absolute top-4 right-4 p-3 bg-white rounded-full shadow-sm text-amber-700 hover:bg-amber-100 active:scale-95 transition-transform min-h-[48px] min-w-[48px] flex items-center justify-center focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {isPlaying ? '⏸️' : '🔊'}
              </button>
              <h3 className="font-semibold text-amber-900 mb-4 text-lg pr-12">Answer</h3>
              <p className="text-lg text-amber-950 leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>

            {schemes.length > 0 && (
              <div className="space-y-4 mt-8">
                <h4 className="font-semibold text-slate-800 text-lg border-b border-amber-100 pb-2">Related Schemes</h4>
                {schemes.map((s) => (
                  <div key={s.id} className="bg-white border border-amber-100 rounded-xl p-5 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                    <h5 className="font-semibold text-lg text-amber-800">{s.name}</h5>
                    <p className="text-slate-700 line-clamp-3">{s.description}</p>
                    {s.source_url && (
                      <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-amber-600 font-medium inline-flex items-center mt-2 p-2 -ml-2 rounded-lg hover:bg-amber-50 focus:ring-2 focus:ring-amber-500 focus:outline-none" aria-label={`Learn more about ${s.name}`}>
                        Learn More ↗
                      </a>
                    )}
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
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-amber-100 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.05)]">
        {appState === 'confirming' ? (
          <div className="flex gap-4">
            <button 
              onClick={cancelQuery}
              aria-label="Re-record your query"
              className="flex-1 py-4 text-lg font-medium text-amber-900 bg-amber-100 rounded-xl hover:bg-amber-200 active:scale-95 transition-transform flex justify-center items-center gap-2 min-h-[48px] focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <span>❌</span> {t.common.reRecord}
            </button>
            <button 
              onClick={handleSearch}
              aria-label="Search schemes"
              className="flex-1 py-4 text-lg font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 active:scale-95 transition-transform flex justify-center items-center gap-2 min-h-[48px] focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <span>🔍</span> Search
            </button>
          </div>
        ) : (
          <button 
            onClick={handleMicClick}
            disabled={appState === 'searching'}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
            className={`w-full py-5 text-xl font-semibold text-white rounded-full flex items-center justify-center space-x-3 shadow-lg active:scale-95 transition-all min-h-[64px] focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 focus:outline-none ${
              isRecording 
                ? 'bg-red-500 animate-pulse' 
                : appState === 'searching' 
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-700'
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
