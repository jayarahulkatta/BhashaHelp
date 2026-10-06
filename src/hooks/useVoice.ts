import { useState, useCallback, useRef, useEffect } from 'react';
import { Language } from '@/lib/i18n';

const MAX_RECORDING_MS = 20_000; // 20 seconds
const MAX_AUDIO_BYTES = 2 * 1024 * 1024; // 2 MB

export function useVoice(lang: Language) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalSizeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
    }
  }, []);

  const stopRecordingInternal = useCallback(async () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setRecordingSeconds(0);

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const stream = mediaRecorder.stream;
    
    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size > MAX_AUDIO_BYTES) {
          setError('Recording too large. Please keep it under 20 seconds.');
          setIsRecording(false);
          resolve();
          return;
        }

        if (audioBlob.size < 100) {
          setError('No audio captured. Please check your microphone.');
          setIsRecording(false);
          resolve();
          return;
        }

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
            setError('Transcription failed. Please try again.');
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

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    audioChunksRef.current = [];
    totalSizeRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000 
        }
      });
      
      // Prefer opus codec if available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          totalSizeRef.current += event.data.size;
          if (totalSizeRef.current > MAX_AUDIO_BYTES) {
            setError('Recording too large. Stopping automatically.');
            stopRecordingInternal();
            return;
          }
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onerror = () => {
        setError('Recording failed. Please try again.');
        setIsRecording(false);
        setRecordingSeconds(0);
        stream.getTracks().forEach(track => track.stop());
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      // Request data every 250ms for more granular size checking
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      // Recording timer (UI countdown)
      intervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      // Auto-stop after MAX_RECORDING_MS
      timeoutRef.current = setTimeout(() => {
        stopRecordingInternal();
      }, MAX_RECORDING_MS);
      
    } catch (err) {
      console.error('Error starting recording', err);
      if ((err as DOMException)?.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone in your browser settings.');
      } else if ((err as DOMException)?.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Could not start recording. Please try again.');
      }
      setIsRecording(false);
    }
  }, [stopRecordingInternal]);

  return {
    isRecording,
    transcript,
    error,
    recordingSeconds,
    maxRecordingSeconds: MAX_RECORDING_MS / 1000,
    startRecording,
    stopRecording: stopRecordingInternal
  };
}
