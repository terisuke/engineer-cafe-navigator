'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MarpViewer from '../components/MarpViewer';
import CharacterAvatar from '../components/CharacterAvatar';
import EnvironmentSettings from '../components/EnvironmentSettings';
import BackgroundSelector, { BackgroundOption } from '../components/BackgroundSelector';
import LanguageSelector from '../components/LanguageSelector';
import AudioControls from '../components/AudioControls';
import VoiceInterface from '../components/VoiceInterface';
import { Sparkles, MessageSquare, Presentation, Settings, ArrowLeft } from 'lucide-react';

export default function SlidesPage() {
  const router = useRouter();
  const [characterBackground, setCharacterBackground] = useState<BackgroundOption>({
    id: 'gradient-sky',
    name: 'Sky Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 50%, #fce4ec 100%)',
  });
  const [selectedBackground, setSelectedBackground] = useState<BackgroundOption>({
    id: 'gradient-sky',
    name: 'Sky Gradient',
    type: 'gradient',
    value: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 50%, #fce4ec 100%)',
  });
  const [lightingIntensity, setLightingIntensity] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  
  // Audio control state
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isRecording, setIsRecording] = useState(false);
  const [showVoiceInterface, setShowVoiceInterface] = useState(false);

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
    }
    return {};
  };

  // Synchronized voice interface and recording control
  const handleVoiceInterfaceToggle = () => {
    const newRecordingState = !isRecording;
    const newVoiceInterfaceState = !showVoiceInterface;
    
    setIsRecording(newRecordingState);
    setShowVoiceInterface(newVoiceInterfaceState);
  };

  // Close voice interface and stop recording
  const handleVoiceInterfaceClose = () => {
    setIsRecording(false);
    setShowVoiceInterface(false);
  };

  // Navigate back to home
  const handleBackToHome = () => {
    router.push('/');
  };

  return (
    <main className="h-screen flex flex-col" style={getBackgroundStyle()}>
      {/* Header */}
      <header className="flex-shrink-0 backdrop-blur-sm">
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
            {/* Back button */}
            <button
              onClick={handleBackToHome}
              className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:bg-white transition-colors"
              title="戻る"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-800">
              Engineer Cafe Navigator
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Audio Controls */}
            <AudioControls
              isMuted={isMuted}
              volume={volume}
              isRecording={isRecording}
              onMuteToggle={() => setIsMuted(!isMuted)}
              onVolumeChange={setVolume}
              onMicToggle={handleVoiceInterfaceToggle}
            />
            
            {/* Language Selector */}
            <LanguageSelector onLanguageChange={(lang) => {
              // Handle language change if needed
              console.log('Language changed to:', lang);
            }} />
          </div>
        </div>
      </header>

      {/* Main Content - No scrolling */}
      <div className="flex-1 container mx-auto px-4 py-6 overflow-hidden">
        <div className="grid grid-cols-12 gap-6 h-full">
          {/* Character Avatar Section */}
          <div className="col-span-12 lg:col-span-4">
            <div 
              className="h-full flex flex-col rounded-lg shadow-lg"
              style={{
                backgroundColor: 'transparent',
                backdropFilter: 'none',
              }}
            >
              <div 
                className="flex items-center space-x-2 p-4 rounded-t-lg"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(5px)',
                  WebkitBackdropFilter: 'blur(5px)',
                }}
              >
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-800">
                  AI ガイド
                </h2>
              </div>
              <div className="flex-1 p-4 relative">
                <div 
                  className="h-full"
                  style={{
                    backgroundColor: 'transparent',
                  }}
                >
                  <CharacterAvatar 
                    modelPath="/characters/models/sakura.vrm"
                    background={characterBackground}
                    lightingIntensity={lightingIntensity}
                  />
                </div>
                <div className="absolute top-4 left-4">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:bg-white transition-colors"
                    title="Settings"
                  >
                    <Settings className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                
                {/* Settings Panel */}
                {showSettings && (
                  <div className="absolute top-16 left-4 z-10 w-80 max-h-96 overflow-y-auto">
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

          {/* Content Area */}
          <div className="col-span-12 lg:col-span-8">
            <div 
              className="h-full flex flex-col rounded-lg shadow-lg overflow-hidden"
              style={{
                backgroundColor: 'transparent',
              }}
            >
              <div 
                className="flex items-center justify-between p-4"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(5px)',
                  WebkitBackdropFilter: 'blur(5px)',
                }}
              >
                <div className="flex items-center space-x-2">
                  <Presentation className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-gray-800">
                    プレゼンテーション & Q&A
                  </h2>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <MarpViewer />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating Voice Interface */}
      {showVoiceInterface && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full mx-4">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">音声インターフェース</h3>
              <button
                onClick={handleVoiceInterfaceClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <VoiceInterface layout="vertical" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}