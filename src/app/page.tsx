'use client';

import { useState } from 'react';
import MarpViewer from './components/MarpViewer';
import CharacterAvatar from './components/CharacterAvatar';
import EnvironmentSettings from './components/EnvironmentSettings';
import BackgroundSelector, { BackgroundOption } from './components/BackgroundSelector';
import { Sparkles, Settings, UserPlus, Maximize, MessageSquare, Presentation, Volume2, VolumeX } from 'lucide-react';

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
        backgroundSize: 'cover',
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

      // Start auto greeting
      await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'text_to_speech',
          text: language === 'ja' 
            ? 'はじめまして！何かお手伝いできることはありますか？'
            : 'Hello there! How can I help you today?',
          language: language,
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })
      }).then(response => response.json()).then(result => {
        if (result.success && result.audioResponse) {
          // Play greeting audio with lip-sync
          playAudioWithLipSync(result.audioResponse);
        }
      });

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
      
      // Convert audio to base64
      const audioBuffer = await audioBlob.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      
      // Send to voice API
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_voice',
          audioData: audioBase64,
          language: currentLanguage,
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[Main] Voice processing result:', result);
        
        // Update character expression based on emotion tags or detected emotion
        if (result.primaryEmotion || result.emotion) {
          const emotionToUse = result.primaryEmotion || result.emotion;
          console.log('[Main] Setting character emotion:', emotionToUse);
          
          await fetch('/api/character', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'setEmotion',
              emotion: emotionToUse,
              transition: true
            })
          });
          
          // Also apply expression directly if we have the viseme function
          if (setVisemeFunction) {
            // Import emotion tag parser for expression weights
            const { EmotionTagParser } = await import('@/lib/emotion-tag-parser');
            const expressionWeights = EmotionTagParser.getExpressionWeights(emotionToUse, 0.8);
            console.log('[Main] Expression weights:', expressionWeights);
            
            // Apply the strongest expression
            const strongestExpression = Object.entries(expressionWeights)
              .filter(([_, weight]) => weight > 0.1)
              .sort(([_, a], [__, b]) => b - a)[0];
            
            if (strongestExpression) {
              const [expressionName, weight] = strongestExpression;
              console.log('[Main] Applying expression:', expressionName, 'weight:', weight);
              
              // Set character expression using the blend shape controller
              if (setExpressionFunction) {
                setExpressionFunction(expressionName, weight);
              }
            }
          }
        }
        
        // Play response audio with lip-sync
        if (result.audioResponse) {
          await playAudioWithLipSync(result.audioResponse);
        }
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
    }
  };

  // Start voice recording
  const startVoiceRecording = async () => {
    if (isInitializingRecorder) {
      console.log('Voice recorder is initializing, please wait...');
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
        console.log('[Main] Audio ended, resetting character');
        
        // Reset character to neutral after speaking
        if (setVisemeFunction) {
          setVisemeFunction('Closed', 0);
        }
        
        fetch('/api/character', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'setExpression',
            expression: 'neutral',
            transition: true
          })
        });
      };

      await audio.play();
    } catch (error) {
      console.error('[Main] Error playing audio with lip-sync:', error);
    }
  };

  return (
    <main className="min-h-screen" style={getBackgroundStyle()}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm">
        <div 
          className="container mx-auto px-4 py-3 flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          }}
        >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-800">
                Engineer Cafe Navigator
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Simplified Audio Controls - Volume only */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={isMuted ? "音声をオンにする" : "音声をオフにする"}
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
                  className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  title="音量調整"
                />
              </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="h-screen flex flex-col">
        <div className="flex-1 pt-16">
          <div className="h-full flex">
            {/* Character Section */}
            <div className={`${showSlideMode ? 'w-1/3' : 'w-full'} h-full transition-all duration-500 ease-in-out`}>
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
                      console.log('[Main] Received expression control function');
                      setSetExpressionFunction(() => setExpression);
                    }}
                  />
                  
                  {/* Settings button */}
                  <div className="absolute top-4 left-4">
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
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-4">
                      {!isVoiceActive ? (
                        // Language selection buttons
                        <>
                          <button
                            onClick={() => {
                              handleLanguageVoiceStart('ja');
                              setIsVoiceActive(true);
                            }}
                            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-w-[200px]"
                          >
                            <MessageSquare className="w-6 h-6" />
                            <span className="text-lg font-semibold">日本語で話しかける</span>
                          </button>
                          <button
                            onClick={() => {
                              handleLanguageVoiceStart('en');
                              setIsVoiceActive(true);
                            }}
                            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-w-[200px]"
                          >
                            <MessageSquare className="w-6 h-6" />
                            <span className="text-lg font-semibold">Speak English</span>
                          </button>
                          <button
                            onClick={() => setShowSlideMode(true)}
                            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                          >
                            <UserPlus className="w-5 h-5" />
                            <span className="text-base font-semibold">初めての方へ</span>
                          </button>
                        </>
                      ) : (
                        // Voice control interface
                        <div className="flex flex-col items-center gap-4">
                          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-6 py-3 shadow-lg">
                            <span className="text-sm font-medium text-gray-700">
                              {currentLanguage === 'ja' ? '会話中（日本語）' : 'Conversation (English)'}
                            </span>
                          </div>
                          
                          {/* Mic button */}
                          <button
                            onMouseDown={startVoiceRecording}
                            onMouseUp={stopVoiceRecording}
                            onTouchStart={startVoiceRecording}
                            onTouchEnd={stopVoiceRecording}
                            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                              isListening 
                                ? 'bg-red-500 hover:bg-red-600 scale-110' 
                                : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
                            }`}
                          >
                            <svg 
                              className="w-8 h-8 text-white" 
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
                          
                          <div className="text-center">
                            <p className="text-sm text-gray-600">
                              {isListening 
                                ? (currentLanguage === 'ja' ? '聞いています...' : 'Listening...') 
                                : (currentLanguage === 'ja' ? 'ボタンを押しながら話してください' : 'Hold to speak')
                              }
                            </p>
                          </div>
                          
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
                            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                          >
                            {currentLanguage === 'ja' ? '会話を終了' : 'End conversation'}
                          </button>
                        </div>
                      )}
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
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Slide Section - only show when in slide mode */}
            {showSlideMode && (
              <div className="w-2/3 h-full transition-all duration-500 ease-in-out">
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
                      <MarpViewer />
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