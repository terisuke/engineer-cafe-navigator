'use client';

import React from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface AudioControlsProps {
  isMuted: boolean;
  volume: number;
  isRecording?: boolean;
  onMuteToggle: () => void;
  onVolumeChange: (volume: number) => void;
  onMicToggle?: () => void;
}

export default function AudioControls({
  isMuted,
  volume,
  isRecording = false,
  onMuteToggle,
  onVolumeChange,
  onMicToggle
}: AudioControlsProps) {
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    onVolumeChange(newVolume);
    
    // Update CSS variable for slider fill
    e.target.style.setProperty('--value', `${newVolume}%`);
  };

  return (
    <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm border border-gray-200">
      {/* Microphone toggle */}
      {onMicToggle && (
        <button
          onClick={onMicToggle}
          className={`p-2 rounded-full transition-all ${
            isRecording
              ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {isRecording ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
      )}

      {/* Volume controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMuteToggle}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-gray-600" />
          ) : (
            <Volume2 className="w-4 h-4 text-gray-600" />
          )}
        </button>
        
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={
              {
                '--value': `${volume}%`,
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${volume}%, #E5E7EB ${volume}%, #E5E7EB 100%)`
              } as React.CSSProperties
            }
          />
          <span className="text-xs text-gray-600 w-8 text-right font-mono">
            {volume}%
          </span>
        </div>
      </div>
    </div>
  );
}