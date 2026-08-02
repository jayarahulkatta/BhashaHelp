import { useState, useCallback, useRef } from 'react';
import { Language } from '@/lib/i18n';

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResultItem;
  };
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

// Extend window object for web speech api
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useVoice(lang: Language) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const startRecording = useCallback(() => {
    setError(null);
    setTranscript('');
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      
      // Map our language codes to standard BCP-47 for browser speech API
      const langCodeMap = {
        'en': 'en-IN',
        'te': 'te-IN',
        'hi': 'hi-IN'
      };
      
      recognition.lang = langCodeMap[lang];
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        setIsRecording(true);
      };
      
      recognition.onresult = (event) => {
        const speechResult = event.results[0][0].transcript;
        setTranscript(speechResult);
      };
      
      recognition.onerror = (event) => {
        setIsRecording(false);
        setError(`Speech recognition error: ${event.error}`);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognition.start();
      recognitionRef.current = recognition;
      
    } catch (err) {
      console.error('Error starting speech recognition', err);
      setError('Could not start microphone');
      setIsRecording(false);
    }
  }, [lang]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording
  };
}
