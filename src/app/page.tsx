'use client';

import { useState } from 'react';
import VoiceInterface from './components/VoiceInterface';
import MarpViewer from './components/MarpViewer';
import CharacterAvatar from './components/CharacterAvatar';
import EnvironmentSettings from './components/EnvironmentSettings';
import BackgroundSelector, { BackgroundOption } from './components/BackgroundSelector';
import LanguageSelector from './components/LanguageSelector';
import AudioControls from './components/AudioControls';
import { Sparkles, Settings, UserPlus, Maximize, MessageSquare, Presentation } from 'lucide-react';

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
    } else if (selectedBackground.type === 'solid') {
      return { backgroundColor: selectedBackground.value };
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
                  
                  {/* Register button - only show when not in slide mode */}
                  {!showSlideMode && (
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                      <button
                        onClick={() => setShowSlideMode(true)}
                        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        <UserPlus className="w-6 h-6" />
                        <span className="text-lg font-semibold">初めての方へ</span>
                      </button>
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