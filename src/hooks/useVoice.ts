import { useState, useCallback, useRef } from 'react';
import { Language } from '@/lib/i18n';

export function useVoice(lang: Language) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onerror = () => {
        setError('Recording failed');
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      
    } catch (err) {
      console.error('Error starting recording', err);
      setError('Microphone access denied');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const stream = mediaRecorder.stream;
    
    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          
          try {
            const response = await fetch('/api/stt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64, lang })
            });
            
            const data = await response.json();
            
            if (data.text) {
              setTranscript(data.text);
            } else if (data.error) {
              setError(data.error);
            }
          } catch (err) {
            console.error('STT API error:', err);
            setError('Transcription failed');
          } finally {
            setIsRecording(false);
            resolve();
          }
        };
        
        reader.readAsDataURL(audioBlob);
      };
      
      mediaRecorder.stop();
    });
  }, [lang]);

  return {
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording
  };
}
