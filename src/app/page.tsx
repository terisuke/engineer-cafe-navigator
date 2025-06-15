'use client';

import { Maximize, MessageSquare, Presentation, Settings, UserPlus, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BackgroundSelector, { BackgroundOption } from './components/BackgroundSelector';
import CharacterAvatar from './components/CharacterAvatar';
import EnvironmentSettings from './components/EnvironmentSettings';
import MarpViewer from './components/MarpViewer';

// Emotion to expression mapping - used across the component
const EMOTION_TO_EXPRESSION: Record<string, string> = {
  'happy': 'happy',
  'excited': 'happy', 
  'sad': 'sad',
  'angry': 'angry',
  'surprised': 'surprised',
  'neutral': 'neutral',
  'relaxed': 'relaxed',
  'thoughtful': 'relaxed',
  'confused': 'surprised',
  'apologetic': 'sad',
  'curious': 'surprised',
  'warm': 'happy',
  'grateful': 'happy',
  'confident': 'happy',
  'supportive': 'relaxed',
  'gentle': 'relaxed',
  'knowledgeable': 'neutral',
  'analytical': 'neutral',
  'energetic': 'happy'
};

export default function Home() {
  const [showSlideMode, setShowSlideMode] = useState(false);
  const [characterBackground, setCharacterBackground] = useState<BackgroundOption>({
    id: 'engineer-cafe-bg',
    name: 'Engineer Cafe',
    type: 'image',
    value: '/backgrounds/IMG_5573.JPG',
  });
  const [selectedBackground, setSelectedBackground] = useState<BackgroundOption>({
    id: 'solid-black',
    name: 'Black',
    type: 'solid',
    value: '#000000',
  });
  const [lightingIntensity, setLightingIntensity] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  
  // Audio control state
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [currentLanguage, setCurrentLanguage] = useState<'ja' | 'en'>('ja');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceRecorder, setVoiceRecorder] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializingRecorder, setIsInitializingRecorder] = useState(false);
  const [setVisemeFunction, setSetVisemeFunction] = useState<((viseme: string, intensity: number) => void) | null>(null);
  const [setExpressionFunction, setSetExpressionFunction] = useState<((expression: string, weight: number) => void) | null>(null);
  
  // Loading state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // ボイスウェーブの高さ（scaleY）を一度だけ生成して保持
  const voiceWaveScales = useMemo(() =>
    Array.from({ length: 5 }, () => Math.random() * 0.5 + 0.5),
    []
  );

  // Apply selected background to both character and main display
  const handleBackgroundChange = (newBackground: BackgroundOption) => {
    setCharacterBackground(newBackground);
    setSelectedBackground(newBackground);
  };

  // Generate CSS for selected background
  const getBackgroundStyle = () => {
    if (selectedBackground.type === 'gradient') {
      return { background: selectedBackground.value };
    } else if (selectedBackground.type === 'image') {
      return {
        backgroundImage: `url(${selectedBackground.value})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };
    } else if (selectedBackground.type === 'solid') {
      return { backgroundColor: selectedBackground.value };
    }
    return {};
  };


  // Handle language-based voice interaction start
  const handleLanguageVoiceStart = async (language: 'ja' | 'en') => {
    setCurrentLanguage(language);
    setIsProcessing(true);
    setProcessingMessage(language === 'ja' ? '挨拶を準備中...' : 'Preparing greeting...');
    
    // Start voice interaction directly with the character
    try {
      // Set language in voice service
      await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_language',
          language: language
        })
      });

      // Start auto greeting using cache for speed
      const { GreetingCache } = await import('@/lib/greeting-cache');
      const cachedGreeting = GreetingCache.getGreeting(language, 'initial');
      
      if (cachedGreeting.audioBase64) {
        // Use cached audio for instant playback
        console.log('[Main] Using cached greeting audio');
        setIsProcessing(false);
        setProcessingMessage('');
        await playAudioWithLipSync(cachedGreeting.audioBase64);
        
        // Apply emotion tags from cached greeting
        if (cachedGreeting.text.includes('[')) {
          const { EmotionTagParser } = await import('@/lib/emotion-tag-parser');
          const parsedResponse = EmotionTagParser.parseEmotionTags(cachedGreeting.text);
          
          if (parsedResponse.primaryEmotion && setExpressionFunction) {
            const expressionWeights = EmotionTagParser.getExpressionWeights(parsedResponse.primaryEmotion, 0.8);
            const strongestExpression = Object.entries(expressionWeights)
              .filter(([_, weight]) => weight > 0.1)
              .sort(([_, a], [__, b]) => b - a)[0];
            
            if (strongestExpression) {
              const [expressionName, weight] = strongestExpression;
              setExpressionFunction(expressionName, weight);
            }
          }
        }
      } else {
        // Fallback to API if no cached audio
        console.log('[Main] No cached audio, using API');
        const { EmotionTagParser } = await import('@/lib/emotion-tag-parser');
        const cleanText = EmotionTagParser.parseEmotionTags(cachedGreeting.text).cleanText;
        
        const response = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'text_to_speech',
            text: cleanText,
            language: language,
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
          })
        });
        
        const result = await response.json();
        if (result.success && result.audioResponse) {
          // Cache this greeting for future use
          GreetingCache.cacheGreeting({
            ...cachedGreeting,
            audioBase64: result.audioResponse
          });
          
          // Play greeting audio with lip-sync
          setIsProcessing(false);
          setProcessingMessage('');
          await playAudioWithLipSync(result.audioResponse);
        }
      }

      // Set character to speaking state
      await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setExpression',
          expression: 'happy',
          transition: true
        })
      });

    } catch (error) {
      console.error('Error starting voice interaction:', error);
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Initialize voice recorder
  const initializeVoiceRecorder = async () => {
    if (isInitializingRecorder) {
      console.log('Voice recorder initialization already in progress');
      return null;
    }

    try {
      setIsInitializingRecorder(true);
      console.log('Initializing voice recorder...');
      const { VoiceRecorder } = await import('@/lib/voice-recorder');
      
      const recorder = new VoiceRecorder(
        async (audioBlob: Blob) => {
          console.log('Audio recorded, processing...', audioBlob.size, 'bytes');
          // Handle recorded audio
          await processVoiceInput(audioBlob);
        },
        (error: Error) => {
          console.error('Voice recorder error:', error);
          setIsListening(false);
          setIsRecording(false);
        }
      );
      
      console.log('Voice recorder created, initializing...');
      await recorder.initialize();
      console.log('Voice recorder initialized successfully');
      setVoiceRecorder(recorder);
      setIsInitializingRecorder(false);
      return recorder;
    } catch (error) {
      console.error('Failed to initialize voice recorder:', error);
      setIsInitializingRecorder(false);
      alert('マイクの初期化に失敗しました。ブラウザの設定でマイクの許可を確認してください。');
      return null;
    }
  };

  // Process voice input
  const processVoiceInput = async (audioBlob: Blob) => {
    try {
      setIsListening(false);
      setIsRecording(false);
      setIsProcessing(true);
      setProcessingMessage(currentLanguage === 'ja' ? '音声を認識中...' : 'Recognizing speech...');
      
      // First try to get speech-to-text for quick response check
      const audioBuffer = await audioBlob.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      
      // Try speech recognition first for quick response
      const speechResponse = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'speech_to_text',
          audioData: audioBase64,
          language: currentLanguage
        })
      });
      
      const speechResult = await speechResponse.json();
      
      // Check for quick cached responses
      if (speechResult.success && speechResult.transcript) {
        setProcessingMessage(currentLanguage === 'ja' ? 'AIが考えています...' : 'AI is thinking...');
        const { ResponseCache } = await import('@/lib/response-cache');
        const { EnhancedEmotionManager } = await import('@/lib/enhanced-emotion-manager');
        const { ConversationMemory } = await import('@/lib/conversation-memory');
        
        console.log('[Main] Speech transcript:', speechResult.transcript);
        
        // First check FAQ database
        const faqMatch = ConversationMemory.searchFAQ(speechResult.transcript, currentLanguage);
        
        let quickResponse;
        if (faqMatch) {
          console.log('[Main] Found FAQ match:', faqMatch);
          quickResponse = {
            text: faqMatch.answer,
            emotion: faqMatch.emotion,
            audioBase64: faqMatch.audioBase64,
            cached: !!faqMatch.audioBase64
          };
        } else {
          // Try to get a quick response from cache or predefined responses
          quickResponse = await ResponseCache.getQuickResponse(
            speechResult.transcript,
            currentLanguage
          );
        }
        
        if (quickResponse) {
          console.log('[Main] Using quick response:', quickResponse);
          
          // Analyze emotion from the response text
          const emotionManager = new EnhancedEmotionManager();
          const emotionAnalysis = emotionManager.analyzeTextEmotion(quickResponse.text, currentLanguage);
          
          // Set emotion with enhanced analysis
          const emotionToUse = quickResponse.emotion || emotionAnalysis.emotion;
          console.log('[Main] Setting enhanced emotion:', emotionToUse, 'intensity:', emotionAnalysis.intensity);
          
          // Apply expressions directly with simple mapping
          console.log('[Main] ==========================================');
          console.log('[Main] Processing cached response emotion:', emotionToUse);
          console.log('[Main] setExpressionFunction available:', !!setExpressionFunction);
          
          if (setExpressionFunction) {
            // Simple direct emotion to expression mapping
            const expressionName = EMOTION_TO_EXPRESSION[emotionToUse] || 'neutral';
            console.log(`[Main] Direct mapping: ${emotionToUse} -> ${expressionName}`);
            console.log(`[Main] Calling setExpressionFunction('${expressionName}', 0.8)`);
            
            try {
              setExpressionFunction(expressionName, 0.8);
              console.log(`[Main] Successfully called setExpressionFunction`);
            } catch (error) {
              console.error(`[Main] Error calling setExpressionFunction:`, error);
            }
          } else {
            console.warn('[Main] setExpressionFunction is not available');
          }
          
          // If we have cached audio, use it; otherwise generate TTS
          if (quickResponse.audioBase64) {
            setIsProcessing(false);
            setProcessingMessage('');
            await playAudioWithLipSync(quickResponse.audioBase64);
          } else {
            setProcessingMessage(currentLanguage === 'ja' ? '音声を生成中...' : 'Generating voice...');
            // Generate TTS for the quick response
            const ttsResponse = await fetch('/api/voice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'text_to_speech',
                text: quickResponse.text,
                language: currentLanguage,
                emotion: emotionToUse,
                intensity: emotionAnalysis.intensity
              })
            });
            
            const ttsResult = await ttsResponse.json();
            if (ttsResult.success && ttsResult.audioResponse) {
              // Cache the audio for future use
              await ResponseCache.cacheResponse({
                id: `quick_${Date.now()}`,
                text: quickResponse.text,
                audioBase64: ttsResult.audioResponse,
                emotion: emotionToUse,
                language: currentLanguage,
                category: 'common'
              });
              
              setIsProcessing(false);
              setProcessingMessage('');
              await playAudioWithLipSync(ttsResult.audioResponse);
            }
          }
          
          // Save conversation to memory
          ConversationMemory.saveConversation({
            userInput: speechResult.transcript,
            aiResponse: quickResponse.text,
            emotion: emotionToUse,
            language: currentLanguage,
            responseTime: Date.now() - (speechResult.startTime || Date.now()),
            cached: quickResponse.cached
          });
          
          return; // Early return for quick response
        }
      }
      
      // If no quick response, proceed with full AI processing
      setProcessingMessage(currentLanguage === 'ja' ? 'AIが応答を生成中...' : 'AI is generating response...');
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_voice',
          audioData: audioBase64,
          language: currentLanguage,
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[Main] Voice processing result:', result);
        
        // Enhanced emotion processing
        if (result.responseText) {
          const { EnhancedEmotionManager } = await import('@/lib/enhanced-emotion-manager');
          const { ResponseCache } = await import('@/lib/response-cache');
          const { ConversationMemory } = await import('@/lib/conversation-memory');
          
          const emotionManager = new EnhancedEmotionManager();
          const emotionAnalysis = emotionManager.analyzeTextEmotion(result.responseText, currentLanguage);
          
          const emotionToUse = result.primaryEmotion || result.emotion || emotionAnalysis.emotion;
          const intensity = emotionAnalysis.intensity;
          
          console.log('[Main] Enhanced emotion analysis:', { emotionToUse, intensity, confidence: emotionAnalysis.confidence });
          
          // Apply expressions directly with simple mapping
          console.log('[Main] ==========================================');
          console.log('[Main] Processing voice result emotion:', emotionToUse);
          console.log('[Main] setExpressionFunction available:', !!setExpressionFunction);
          
          if (setExpressionFunction) {
            // Simple direct emotion to expression mapping
            const expressionName = EMOTION_TO_EXPRESSION[emotionToUse] || 'neutral';
            console.log(`[Main] Direct mapping: ${emotionToUse} -> ${expressionName}`);
            console.log(`[Main] Calling setExpressionFunction('${expressionName}', 0.8)`);
            
            try {
              setExpressionFunction(expressionName, 0.8);
              console.log(`[Main] Successfully called setExpressionFunction`);
            } catch (error) {
              console.error(`[Main] Error calling setExpressionFunction:`, error);
            }
          } else {
            console.warn('[Main] setExpressionFunction is not available');
          }
          
          // Cache the response for future use
          if (result.audioResponse && result.responseText) {
            await ResponseCache.cacheResponse({
              id: `ai_${Date.now()}`,
              text: result.responseText,
              audioBase64: result.audioResponse,
              emotion: emotionToUse,
              language: currentLanguage,
              category: 'common'
            });
          }
          
          // Save conversation to memory
          if (result.responseText && speechResult.transcript) {
            ConversationMemory.saveConversation({
              userInput: speechResult.transcript,
              aiResponse: result.responseText,
              emotion: emotionToUse,
              language: currentLanguage,
              responseTime: Date.now() - (speechResult.startTime || Date.now()),
              cached: false
            });
          }
        }
        
        // Play response audio with lip-sync
        if (result.audioResponse) {
          setProcessingMessage(currentLanguage === 'ja' ? '音声を準備中...' : 'Preparing audio...');
          setIsProcessing(false);
          setProcessingMessage('');
          await playAudioWithLipSync(result.audioResponse);
        }
      }
      setIsProcessing(false);
      setProcessingMessage('');
    } catch (error) {
      console.error('Error processing voice input:', error);
      
      // Fallback error response
      const { ResponseCache } = await import('@/lib/response-cache');
      const errorResponse = ResponseCache.getPredefinedResponse('confusion', currentLanguage, 'apologetic');
      
      if (errorResponse && setExpressionFunction) {
        setExpressionFunction('sorry', 0.8);
        
        // Generate TTS for error response
        try {
          const ttsResponse = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'text_to_speech',
              text: errorResponse.text,
              language: currentLanguage,
              emotion: errorResponse.emotion
            })
          });
          
          const ttsResult = await ttsResponse.json();
          if (ttsResult.success && ttsResult.audioResponse) {
            await playAudioWithLipSync(ttsResult.audioResponse);
          }
        } catch (ttsError) {
          console.error('Error generating error response TTS:', ttsError);
        }
      }
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Start voice recording
  const startVoiceRecording = async () => {
    if (isInitializingRecorder) {
      console.log('Voice recorder is initializing, please wait...');
      return;
    }

    if (isRecording) {
      console.log('Already recording, ignoring start request');
      return;
    }

    let recorder = voiceRecorder;
    
    if (!recorder) {
      console.log('No recorder found, initializing...');
      recorder = await initializeVoiceRecorder();
      if (!recorder) {
        console.error('Failed to initialize voice recorder');
        return;
      }
    }

    // Verify recorder is properly initialized
    if (!recorder.isInitialized()) {
      console.log('Recorder not properly initialized, re-initializing...');
      recorder = await initializeVoiceRecorder();
      if (!recorder) {
        console.error('Failed to re-initialize voice recorder');
        return;
      }
    }

    // Check if recorder is in a valid state to start
    const recorderState = recorder.getState();
    if (recorderState === 'recording') {
      console.log('Recorder already recording, stopping first');
      recorder.stop();
      // Wait a bit for the recorder to fully stop
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    try {
      setIsListening(true);
      setIsRecording(true);
      recorder.start();
      
      // Auto-stop recording after 10 seconds
      const timeoutId = setTimeout(() => {
        stopVoiceRecording();
      }, 10000);
      
      // Store timeout ID for potential cleanup
      (recorder as any).autoStopTimeout = timeoutId;
    } catch (error) {
      console.error('Error starting voice recording:', error);
      setIsListening(false);
      setIsRecording(false);
    }
  };

  // Stop voice recording
  const stopVoiceRecording = () => {
    if (voiceRecorder) {
      // Clear auto-stop timeout if it exists
      if ((voiceRecorder as any).autoStopTimeout) {
        clearTimeout((voiceRecorder as any).autoStopTimeout);
        (voiceRecorder as any).autoStopTimeout = null;
      }
      
      if (isRecording) {
        voiceRecorder.stop();
      }
      setIsRecording(false);
      setIsListening(false);
    }
  };

  // Play audio with lip-sync
  const playAudioWithLipSync = async (audioBase64: string) => {
    try {
      console.log('[Main] Playing audio with lip-sync');
      
      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.volume = volume / 100;

      // Perform lip-sync analysis
      if (setVisemeFunction) {
        console.log('[Main] Starting lip-sync analysis with direct viseme control');
        
        try {
          const { LipSyncAnalyzer } = await import('@/lib/lip-sync-analyzer');
          const analyzer = new LipSyncAnalyzer();
          const lipSyncData = await analyzer.analyzeLipSync(audioBlob);
          
          console.log('[Main] Lip-sync analysis complete:', lipSyncData.frames.length, 'frames');
          
          // Schedule viseme updates
          let frameIndex = 0;
          const updateLipSync = () => {
            if (frameIndex < lipSyncData.frames.length && audio.currentTime >= 0) {
              const frame = lipSyncData.frames[frameIndex];
              
              console.log(`[Main] Lip-sync frame ${frameIndex}:`, frame.mouthShape, 'intensity:', frame.mouthOpen);
              setVisemeFunction(frame.mouthShape, frame.mouthOpen);
              
              frameIndex++;
              setTimeout(updateLipSync, 50); // 20fps
            } else if (frameIndex >= lipSyncData.frames.length) {
              console.log('[Main] Lip-sync animation complete');
              setVisemeFunction('Closed', 0); // Reset to closed mouth
            }
          };
          
          // Start lip-sync when audio starts
          audio.onplay = () => {
            console.log('[Main] Audio started, beginning lip-sync animation');
            updateLipSync();
          };
          
          analyzer.dispose();
        } catch (lipSyncError) {
          console.warn('[Main] Lip-sync analysis failed:', lipSyncError);
        }
      } else {
        console.warn('[Main] Viseme control function not available');
      }

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        console.log('[Main] Audio ended');
        
        // Reset only the viseme (mouth shape) to closed, but keep the current expression
        if (setVisemeFunction) {
          setVisemeFunction('Closed', 0);
        }
        
        // Don't reset expression to neutral - keep the current emotion
      };

      await audio.play();
    } catch (error) {
      console.error('[Main] Error playing audio with lip-sync:', error);
    }
  };

  // Pre-generate greetings on app load for faster responses
  useEffect(() => {
    const preGenerateGreetings = async () => {
      try {
        const { GreetingCache } = await import('@/lib/greeting-cache');
        const stats = GreetingCache.getCacheStats();
        
        // Only pre-generate if cache is empty or has few greetings
        if (stats.totalCached < 4) {
          console.log('[Main] Pre-generating greetings for faster responses...');
          await GreetingCache.preGenerateGreetings();
          console.log('[Main] Greeting pre-generation complete');
        } else {
          console.log('[Main] Greetings already cached:', stats);
        }
      } catch (error) {
        console.warn('[Main] Failed to pre-generate greetings:', error);
      }
    };

    // Delay the pre-generation to not block initial load
    const timer = setTimeout(preGenerateGreetings, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen relative" style={getBackgroundStyle()}>
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-md mx-4">
            <div className="flex flex-col items-center space-y-4">
              {/* Animated loader */}
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-200 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-20 h-20 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
              </div>
              
              {/* Loading message */}
              <h2 className="text-xl font-semibold text-gray-800">
                {processingMessage}
              </h2>
              
              {/* Sub-message */}
              <p className="text-sm text-gray-600 text-center">
                {currentLanguage === 'ja' 
                  ? 'しばらくお待ちください...' 
                  : 'Please wait a moment...'
                }
              </p>
              
              {/* Voice wave animation */}
              <div className="flex items-center space-x-1 h-8">
                {voiceWaveScales.map((scale, i) => (
                  <div
                    key={i}
                    className="w-1 bg-blue-500 rounded-full animate-pulse"
                    style={{ 
                      height: '100%',
                      animationDelay: `${i * 0.1}s`,
                      transform: `scaleY(${scale})`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="h-screen flex flex-col">
        <div className="flex-1 pt-4">
          <div className="h-full flex flex-col lg:flex-row">
            {/* Character Section */}
            <div className={`${showSlideMode ? 'w-full lg:w-1/3 h-[45vh] lg:h-full' : 'w-full h-full'} transition-all duration-500 ease-in-out`}>
              <div className="h-full p-4">
                {showSlideMode && (
                  <div className="flex items-center space-x-2 mb-4 px-4 py-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-gray-800">AI ガイド</h2>
                  </div>
                )}
                <div className="h-[calc(100%-4rem)] relative">
                  <CharacterAvatar 
                    modelPath="/characters/models/sakura.vrm"
                    background={characterBackground}
                    lightingIntensity={lightingIntensity}
                    modelPositionOffset={showSlideMode ? { x: -1.2, y: 0, z: 0 } : { x: 0, y: 0, z: 0 }}
                    cameraPositionOffset={showSlideMode ? { x: 0, y: 0, z: 0 } : { x: 0, y: 0, z: 0 }}
                    modelRotationOffset={showSlideMode ? { x: -0.1, y: 1, z: 0.1 } : { x: 0, y: 0, z: 0 }}
                    enableClickAnimation={!showSlideMode}
                    onVisemeControl={(setViseme) => {
                      console.log('[Main] Received viseme control function');
                      setSetVisemeFunction(() => setViseme);
                    }}
                    onExpressionControl={(setExpression) => {
                      console.log('[Main] === Received expression control function ===');
                      console.log('[Main] setExpression function type:', typeof setExpression);
                      console.log('[Main] setExpression function:', setExpression);
                      setSetExpressionFunction(() => setExpression);
                      console.log('[Main] setExpressionFunction state updated');
                    }}
                  />
                  
                  {/* Settings and test buttons */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:bg-white transition-colors"
                      title="Settings"
                    >
                      <Settings className="w-6 h-6 text-gray-600" />
                    </button>
                    
                  </div>
                  
                  {/* Voice interaction controls - only show when not in slide mode */}
                  {!showSlideMode && (
                    <div className="absolute bottom-12 md:bottom-16 left-0 right-0 px-8 md:px-12">
                      <div className="container mx-auto">
                        {!isVoiceActive ? (
                          // Language selection buttons - grouped layout
                          <div className="flex flex-col lg:flex-row lg:justify-between items-center lg:items-end gap-8 lg:gap-6">
                            {/* Japanese buttons group - left side */}
                            <div className="flex flex-col gap-6 w-full lg:w-auto">
                              <button
                                onClick={() => {
                                  handleLanguageVoiceStart('ja');
                                  setIsVoiceActive(true);
                                }}
                                className="flex items-center justify-center gap-0 md:gap-4 px-6 md:px-8 py-6 md:py-8 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-w-[56px] md:min-w-[320px] touch-manipulation"
                              >
                                <MessageSquare className="w-6 h-6 md:w-8 md:h-8" />
                                <span className="hidden md:inline text-lg md:text-xl font-semibold ml-2">日本語で話しかける</span>
                              </button>
                              <button
                                onClick={() => {
                                  setShowSlideMode(true);
                                  // Auto-start presentation in Japanese
                                  setTimeout(() => {
                                    // Find MarpViewer and trigger auto-play
                                    const autoPlayEvent = new CustomEvent('autoStartPresentation', { 
                                      detail: { autoPlay: true, language: 'ja' } 
                                    });
                                    window.dispatchEvent(autoPlayEvent);
                                  }, 100);
                                }}
                                className="flex items-center justify-center gap-4 px-8 py-6 md:py-8 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-w-[280px] md:min-w-[320px] touch-manipulation"
                              >
                                <UserPlus className="w-7 h-7 md:w-8 md:h-8" />
                                <span className="text-lg md:text-xl font-semibold">初めての方へ</span>
                              </button>
                            </div>
                            
                            {/* English buttons group - right side */}
                            <div className="flex flex-col gap-6 w-full lg:w-auto">
                              <button
                                onClick={() => {
                                  handleLanguageVoiceStart('en');
                                  setIsVoiceActive(true);
                                }}
                                className="flex items-center justify-center gap-4 px-8 py-6 md:py-8 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-w-[280px] md:min-w-[320px] touch-manipulation"
                              >
                                <MessageSquare className="w-7 h-7 md:w-8 md:h-8" />
                                <span className="text-lg md:text-xl font-semibold">Speak English</span>
                              </button>
                              <button
                                onClick={() => {
                                  setShowSlideMode(true);
                                  // Auto-start presentation in English
                                  setTimeout(() => {
                                    // Find MarpViewer and trigger auto-play
                                    const autoPlayEvent = new CustomEvent('autoStartPresentation', { 
                                      detail: { autoPlay: true, language: 'en' } 
                                    });
                                    window.dispatchEvent(autoPlayEvent);
                                  }, 100);
                                }}
                                className="flex items-center justify-center gap-4 px-8 py-6 md:py-8 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-w-[280px] md:min-w-[320px] touch-manipulation"
                              >
                                <UserPlus className="w-7 h-7 md:w-8 md:h-8" />
                                <span className="text-lg md:text-xl font-semibold">For first-time users</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Voice control interface
                          <div className="flex flex-col items-center gap-6">
                            {/* Mic button */}
                            <button
                              onMouseDown={startVoiceRecording}
                              onMouseUp={stopVoiceRecording}
                              onTouchStart={startVoiceRecording}
                              onTouchEnd={stopVoiceRecording}
                              onContextMenu={(e) => e.preventDefault()}
                              className={`select-none w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${
                                isListening 
                                  ? 'bg-red-500 hover:bg-red-600 scale-110' 
                                  : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
                              }`}
                            >
                              <svg 
                                className="w-10 h-10 md:w-12 md:h-12 text-white" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={2} 
                                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
                                />
                              </svg>
                            </button>
                            {/* End conversation button */}
                            <button
                              onClick={() => {
                                setIsVoiceActive(false);
                                setIsListening(false);
                                setIsRecording(false);
                                if (voiceRecorder) {
                                  voiceRecorder.cleanup();
                                  setVoiceRecorder(null);
                                }
                              }}
                              className="px-6 py-3 md:py-4 bg-gray-500 hover:bg-gray-600 text-white text-base md:text-lg rounded-xl transition-colors touch-manipulation"
                            >
                              {currentLanguage === 'ja' ? '会話を終了' : 'End'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Settings Panel */}
                  {showSettings && (
                    <div className="absolute top-20 left-4 z-10 w-80 max-h-96 overflow-y-auto">
                      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                        <BackgroundSelector
                          onBackgroundChange={handleBackgroundChange}
                          currentBackground={selectedBackground}
                        />
                        <div className="mt-4">
                          <EnvironmentSettings
                            lightingIntensity={lightingIntensity}
                            onLightingChange={setLightingIntensity}
                          />
                        </div>
                        {/* Audio Controls inside settings */}
                        <div className="mt-4">
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">Audio</h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setIsMuted(!isMuted)}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              title={isMuted ? '音声をオンにする' : '音声をオフにする'}
                            >
                              {isMuted ? (
                                <VolumeX className="w-5 h-5 text-gray-600" />
                              ) : (
                                <Volume2 className="w-5 h-5 text-gray-600" />
                              )}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={volume}
                              onChange={(e) => setVolume(Number(e.target.value))}
                              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              title="音量調整"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Slide Section - only show when in slide mode */}
            {showSlideMode && (
              <div className="w-full lg:w-2/3 h-[55vh] lg:h-full transition-all duration-500 ease-in-out">
                <div className="h-full p-4">
                  <div className="h-full bg-white/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b bg-white/95">
                      <div className="flex items-center space-x-2">
                        <Presentation className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold text-gray-800">プレゼンテーション & Q&A</h2>
                      </div>
                      <button
                        onClick={() => setShowSlideMode(false)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        title="全画面表示に戻る"
                      >
                        <Maximize className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                    <div className="h-[calc(100%-4rem)]">
                      <MarpViewer 
                        onVisemeControl={setVisemeFunction}
                        onExpressionControl={setExpressionFunction}
                        volume={volume}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
    </main>
  );
}
