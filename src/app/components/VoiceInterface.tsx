'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, Loader2, AlertCircle } from 'lucide-react';
import { formatError } from '@/lib/error-messages';

interface VoiceInterfaceProps {
  onLanguageChange?: (language: 'ja' | 'en') => void;
  onPageTransition?: (page: string) => void;
  layout?: 'vertical' | 'horizontal';
  language?: 'ja' | 'en';
  autoGreeting?: boolean;
}

export default function VoiceInterface({ 
  onLanguageChange, 
  onPageTransition,
  layout = 'vertical',
  language = 'ja',
  autoGreeting = false
}: VoiceInterfaceProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [conversationState, setConversationState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [currentLanguage, setCurrentLanguage] = useState<'ja' | 'en'>(language);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update language when prop changes
  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);

  // Auto greeting when component mounts with autoGreeting enabled
  useEffect(() => {
    if (autoGreeting) {
      performAutoGreeting();
    }
  }, [autoGreeting, language]);

  // Perform automatic greeting
  const performAutoGreeting = async () => {
    const greetingText = language === 'ja' 
      ? 'はじめまして！何かお手伝いできることはありますか？'
      : 'Hello there! How can I help you today?';
    
    try {
      setConversationState('speaking');
      setResponse(greetingText);
      setIsLoading(true);
      setLoadingMessage(language === 'ja' ? '挨拶を準備中...' : 'Preparing greeting...');

      // Generate TTS audio for greeting
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'text_to_speech',
          text: greetingText,
          language: language,
          sessionId: generateSessionId(),
        }),
      });

      const result = await response.json();

      if (result.success && result.audioResponse && !isMuted) {
        await playAudioResponse(result.audioResponse);
      } else {
        setConversationState('idle');
        setIsLoading(false);
        setLoadingMessage('');
      }

      // Update character animation for greeting
      updateCharacter('greeting');

    } catch (error) {
      console.error('Auto greeting error:', error);
      setError(language === 'ja' ? '挨拶の再生に失敗しました' : 'Failed to play greeting');
      setConversationState('idle');
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Start voice recording
  const startListening = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setLoadingMessage(currentLanguage === 'ja' ? 'マイクにアクセス中...' : 'Accessing microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processAudioInput(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsListening(true);
      setConversationState('listening');
      setIsLoading(false);
      setLoadingMessage('');
    } catch (error: any) {
      console.error('Error starting voice recording:', error);
      setError(formatError(error, currentLanguage));
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Stop voice recording
  const stopListening = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsListening(false);
      setConversationState('processing');
    }
  };

  // Process audio input
  const processAudioInput = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      setLoadingMessage(currentLanguage === 'ja' ? '音声を処理中...' : 'Processing audio...');
      const audioBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(audioBuffer);
      const audioBase64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process_voice',
          audioData: audioBase64,
          sessionId: generateSessionId(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTranscript(result.transcript);
        setResponse(result.response);

        // Play audio response
        if (result.audioResponse && !isMuted) {
          await playAudioResponse(result.audioResponse);
        }

        // Update character if needed
        if (result.shouldUpdateCharacter && result.characterAction) {
          updateCharacter(result.characterAction);
        }
      } else {
        setError(result.error || formatError({ code: 'VOICE_PROCESSING_ERROR' }, currentLanguage));
      }
    } catch (error: any) {
      console.error('Error processing audio:', error);
      setError(formatError(error, currentLanguage));
    } finally {
      setConversationState('idle');
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Play audio response
  const playAudioResponse = async (audioBase64: string) => {
    try {
      setIsLoading(true);
      setLoadingMessage(currentLanguage === 'ja' ? '音声を準備中...' : 'Preparing audio...');
      setIsSpeaking(true);
      setConversationState('speaking');

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audio.volume = volume;
      currentAudioRef.current = audio;

      // Start lip-sync analysis with the audio
      let lipSyncCleanup: (() => void) | null = null;
      try {
        console.log('Starting lip-sync analysis for audio blob:', audioBlob.size, 'bytes');
        
        // Analyze audio for lip-sync
        const { LipSyncAnalyzer } = await import('@/lib/lip-sync-analyzer');
        const analyzer = new LipSyncAnalyzer();
        const lipSyncData = await analyzer.analyzeLipSync(audioBlob);
        
        console.log('Lip-sync analysis complete:', lipSyncData.frames.length, 'frames, duration:', lipSyncData.duration);
        
        // Apply lip-sync to character
        const startLipSyncResponse = await fetch('/api/character', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'startLipSync',
            lipSyncData,
          }),
        });
        console.log('Start lip-sync API response:', await startLipSyncResponse.json());

        // Schedule viseme updates
        let frameIndex = 0;
        const updateLipSync = () => {
          if (frameIndex < lipSyncData.frames.length && currentAudioRef.current) {
            const frame = lipSyncData.frames[frameIndex];
            
            console.log(`Lip-sync frame ${frameIndex}:`, frame.mouthShape, 'intensity:', frame.mouthOpen);
            
            // Send viseme to character
            fetch('/api/character', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'setViseme',
                viseme: frame.mouthShape,
                intensity: frame.mouthOpen,
              }),
            }).then(response => response.json())
              .then(result => console.log('Viseme API response:', result))
              .catch(console.error);
            
            frameIndex++;
            setTimeout(updateLipSync, 50); // 20fps
          } else {
            console.log('Lip-sync animation complete or audio stopped');
          }
        };
        
        // Start lip-sync updates when audio starts playing
        audio.onplay = () => {
          console.log('Audio started playing, beginning lip-sync animation');
          updateLipSync();
        };

        analyzer.dispose();
      } catch (lipSyncError) {
        console.warn('Lip-sync analysis failed, continuing with audio playback:', lipSyncError);
      }

      audio.onended = () => {
        setIsSpeaking(false);
        setConversationState('idle');
        setIsLoading(false);
        setLoadingMessage('');
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        
        // Stop lip-sync
        fetch('/api/character', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'stopLipSync',
          }),
        }).catch(console.error);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setConversationState('idle');
        setIsLoading(false);
        setLoadingMessage('');
        setError(formatError({ code: 'VOICE_PROCESSING_ERROR' }, currentLanguage));
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        
        // Stop lip-sync on error
        fetch('/api/character', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'stopLipSync',
          }),
        }).catch(console.error);
      };

      await audio.play();
      setIsLoading(false);
      setLoadingMessage('');
    } catch (error: any) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
      setConversationState('idle');
      setIsLoading(false);
      setLoadingMessage('');
      setError(formatError(error, currentLanguage));
    }
  };

  // Update character animation
  const updateCharacter = async (action: string) => {
    try {
      await fetch('/api/character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'playAnimation',
          animation: action,
          transition: true,
        }),
      });
    } catch (error) {
      console.error('Error updating character:', error);
    }
  };

  // Generate session ID
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle interruption
  const handleInterruption = async () => {
    if (isSpeaking) {
      // Stop current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // Notify backend of interruption
      try {
        await fetch('/api/voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'handle_interruption',
          }),
        });
      } catch (error) {
        console.error('Error handling interruption:', error);
      }

      setIsSpeaking(false);
      setConversationState('idle');
    }
  };

  // Toggle language
  const toggleLanguage = async () => {
    const newLanguage = currentLanguage === 'ja' ? 'en' : 'ja';
    
    try {
      setIsLoading(true);
      setLoadingMessage(currentLanguage === 'ja' ? '言語を切り替え中...' : 'Switching language...');
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set_language',
          language: newLanguage,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setCurrentLanguage(newLanguage);
        onLanguageChange?.(newLanguage);
      }
    } catch (error: any) {
      console.error('Error changing language:', error);
      setError(formatError(error, currentLanguage));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Clear conversation
  const clearConversation = async () => {
    try {
      await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear_conversation',
        }),
      });

      setTranscript('');
      setResponse('');
      setError(null);
    } catch (error) {
      console.error('Error clearing conversation:', error);
    }
  };

  if (layout === 'horizontal') {
    return (
      <div className="glass rounded-2xl p-4 shadow-2xl border border-white/30">
        <div className="flex items-center gap-6">
          {/* Status Indicator */}
          <div className="flex items-center space-x-3">
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
            ) : (
              <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
                conversationState === 'idle' ? 'bg-gray-400' :
                conversationState === 'listening' ? 'bg-blue-500 animate-pulse' :
                conversationState === 'processing' ? 'bg-yellow-500 animate-bounce' :
                'bg-green-500 animate-pulse'
              }`} />
            )}
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {isLoading ? loadingMessage :
                conversationState === 'idle' && (currentLanguage === 'ja' ? '待機中' : 'Ready') ||
                conversationState === 'listening' && (currentLanguage === 'ja' ? '聞いています...' : 'Listening...') ||
                conversationState === 'processing' && (currentLanguage === 'ja' ? '処理中...' : 'Processing...') ||
                conversationState === 'speaking' && (currentLanguage === 'ja' ? '話しています...' : 'Speaking...')
              }
            </span>
          </div>

          {/* Voice Waveform Indicator */}
          {(isListening || isSpeaking) && (
            <div className="flex items-center space-x-1 h-6">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="voice-wave-bar w-1 bg-primary rounded-full transition-all"
                  style={{ height: '100%' }}
                />
              ))}
            </div>
          )}

          {/* Main Controls */}
          <div className="flex items-center space-x-3">
            {/* Voice button */}
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={conversationState === 'processing' || isLoading}
              className={`p-3 rounded-full transition-smooth transform ${
                isListening 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg scale-110 ring-4 ring-red-500/30' 
                  : (conversationState === 'processing' || isLoading)
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white shadow-lg hover:shadow-xl hover:scale-105'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Interruption button */}
            {isSpeaking && (
              <button
                onClick={handleInterruption}
                className="p-2.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg transition-smooth transform hover:scale-105"
                title={currentLanguage === 'ja' ? '話を止める' : 'Interrupt'}
              >
                <VolumeX className="w-4 h-4" />
              </button>
            )}

            {/* Volume control */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2.5 rounded-full transition-smooth transform hover:scale-105 ${
                isMuted 
                  ? 'bg-gray-500 hover:bg-gray-600' 
                  : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
              } text-white shadow-lg`}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Volume Slider */}
          {!isMuted && (
            <div className="flex items-center space-x-3 flex-1 max-w-xs">
              <label className="text-xs text-gray-600 whitespace-nowrap">
                {currentLanguage === 'ja' ? '音量' : 'Volume'}
              </label>
              <div className="slider-container flex-1">
                <div 
                  className="slider-fill" 
                  style={{ width: `${volume * 100}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="slider w-full"
                />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {Math.round(volume * 100)}%
              </span>
            </div>
          )}

          {/* Conversation Display (Compact) */}
          {(transcript || response) && (
            <div className="flex-1 max-w-lg">
              <div className="bg-gray-50/50 backdrop-blur-sm rounded-lg px-4 py-2 max-h-12 overflow-hidden">
                {response ? (
                  <p className="text-sm text-gray-800 truncate">
                    <span className="text-xs text-secondary font-semibold">AI: </span>
                    {response}
                  </p>
                ) : transcript && (
                  <p className="text-sm text-gray-800 truncate">
                    <span className="text-xs text-primary font-semibold">
                      {currentLanguage === 'ja' ? 'あなた: ' : 'You: '}
                    </span>
                    {transcript}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <div className="px-2 py-1 bg-primary/10 rounded-full">
              <span className="text-xs font-semibold text-primary">
                {currentLanguage.toUpperCase()}
              </span>
            </div>
            
            <button
              onClick={toggleLanguage}
              className="btn-primary text-sm px-3 py-1.5"
            >
              {currentLanguage === 'ja' ? 'EN' : 'JP'}
            </button>
            
            <button
              onClick={clearConversation}
              className="btn-secondary text-sm px-3 py-1.5"
            >
              {currentLanguage === 'ja' ? 'リセット' : 'Clear'}
            </button>
            
            <button
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-smooth"
              title={currentLanguage === 'ja' ? '設定' : 'Settings'}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 bg-red-50/80 border border-red-200 rounded-lg px-3 py-2 backdrop-blur-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700 transition-colors"
              aria-label={currentLanguage === 'ja' ? 'エラーを閉じる' : 'Close error'}
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  }

  // Original vertical layout
  return (
    <div className="glass rounded-2xl p-6 max-w-md shadow-2xl border border-white/30">
      {/* Status Indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          ) : (
            <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
              conversationState === 'idle' ? 'bg-gray-400' :
              conversationState === 'listening' ? 'bg-blue-500 animate-pulse' :
              conversationState === 'processing' ? 'bg-yellow-500 animate-bounce' :
              'bg-green-500 animate-pulse'
            }`} />
          )}
          <span className="text-sm font-medium text-gray-700">
            {isLoading ? loadingMessage :
              conversationState === 'idle' && (currentLanguage === 'ja' ? '待機中' : 'Ready') ||
              conversationState === 'listening' && (currentLanguage === 'ja' ? '聞いています...' : 'Listening...') ||
              conversationState === 'processing' && (currentLanguage === 'ja' ? '処理中...' : 'Processing...') ||
              conversationState === 'speaking' && (currentLanguage === 'ja' ? '話しています...' : 'Speaking...')
            }
          </span>
        </div>
        <div className="px-2 py-1 bg-primary/10 rounded-full">
          <span className="text-xs font-semibold text-primary">
            {currentLanguage.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Voice Waveform Indicator */}
      {(isListening || isSpeaking) && (
        <div className="flex items-center justify-center space-x-1 mb-4 h-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="voice-wave-bar w-1 bg-primary rounded-full transition-all"
              style={{ height: '100%' }}
            />
          ))}
        </div>
      )}

      {/* Main Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        {/* Voice button */}
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={conversationState === 'processing' || isLoading}
          className={`p-4 rounded-full transition-smooth transform ${
            isListening 
              ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg scale-110 ring-4 ring-red-500/30' 
              : (conversationState === 'processing' || isLoading)
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white shadow-lg hover:shadow-xl hover:scale-105'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isListening ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>

        {/* Interruption button */}
        {isSpeaking && (
          <button
            onClick={handleInterruption}
            className="p-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg transition-smooth transform hover:scale-105"
            title={currentLanguage === 'ja' ? '話を止める' : 'Interrupt'}
          >
            <VolumeX className="w-5 h-5" />
          </button>
        )}

        {/* Volume control */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-3 rounded-full transition-smooth transform hover:scale-105 ${
            isMuted 
              ? 'bg-gray-500 hover:bg-gray-600' 
              : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
          } text-white shadow-lg`}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Volume Slider */}
      {!isMuted && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-600">
              {currentLanguage === 'ja' ? '音量' : 'Volume'}
            </label>
            <span className="text-xs text-gray-500">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <div className="slider-container">
            <div 
              className="slider-fill" 
              style={{ width: `${volume * 100}%` }}
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="slider"
            />
          </div>
        </div>
      )}

      {/* Conversation Display */}
      {(transcript || response) && (
        <div className="bg-gray-50/50 backdrop-blur-sm rounded-lg p-3 mb-4 max-h-40 overflow-y-auto scrollbar-thin">
          {transcript && (
            <div className="mb-2">
              <span className="text-xs text-primary font-semibold">
                {currentLanguage === 'ja' ? 'あなた:' : 'You:'}
              </span>
              <p className="text-sm text-gray-800 mt-1">{transcript}</p>
            </div>
          )}
          {response && (
            <div>
              <span className="text-xs text-secondary font-semibold">
                {currentLanguage === 'ja' ? 'AI:' : 'AI:'}
              </span>
              <p className="text-sm text-gray-800 mt-1">{response}</p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50/80 border border-red-200 rounded-lg p-3 mb-4 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 transition-colors text-lg leading-none"
              aria-label={currentLanguage === 'ja' ? 'エラーを閉じる' : 'Close error'}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={toggleLanguage}
          className="btn-primary flex-1"
        >
          {currentLanguage === 'ja' ? 'English' : '日本語'}
        </button>
        
        <button
          onClick={clearConversation}
          className="btn-secondary flex-1"
        >
          {currentLanguage === 'ja' ? 'リセット' : 'Clear'}
        </button>
        
        <button
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-smooth"
          title={currentLanguage === 'ja' ? '設定' : 'Settings'}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          {currentLanguage === 'ja' 
            ? 'マイクボタンを押して話しかけてください' 
            : 'Press the mic button to start talking'
          }
        </p>
      </div>
    </div>
  );
}
