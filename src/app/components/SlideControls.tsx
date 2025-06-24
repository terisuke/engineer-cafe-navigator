'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  List,
  Settings2
} from 'lucide-react';

interface SlideControlsProps {
  currentSlide: number;
  totalSlides: number;
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  onNavigate: (direction: 'prev' | 'first' | number) => void;
  onPlayPause: () => void;
  onMuteToggle: () => void;
  onFullscreenToggle: () => void;
  onShowNotes?: () => void;
  onShowSettings?: () => void;
}

export default function SlideControls({
  currentSlide,
  totalSlides,
  isPlaying,
  isMuted,
  isFullscreen,
  onNavigate,
  onPlayPause,
  onMuteToggle,
  onFullscreenToggle,
  onShowNotes,
  onShowSettings
}: SlideControlsProps) {
  const [showSlideMenu, setShowSlideMenu] = useState(false);

  // Generate slide numbers for quick navigation
  const slideNumbers = Array.from({ length: totalSlides }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-between bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-3 border border-gray-200">
      {/* Left Controls */}
      <div className="flex items-center gap-2">
        {/* Navigation */}
        <button
          onClick={() => onNavigate('first')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          disabled={currentSlide === 1}
          title="最初のスライド (Home)"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => onNavigate('prev')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          disabled={currentSlide === 1}
          title="前のスライド (←)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className="p-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-md"
          title={isPlaying ? "一時停止 (P)" : "再生 (P)"}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
      </div>

      {/* Center - Slide Counter */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowSlideMenu(!showSlideMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <span className="font-medium text-gray-700">
              {currentSlide} / {totalSlides}
            </span>
            <List className="w-4 h-4 text-gray-500" />
          </button>

          {/* Slide Quick Navigation Menu */}
          {showSlideMenu && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-xl border border-gray-200 p-2 grid grid-cols-5 gap-1 min-w-[200px]">
              {slideNumbers.map(num => (
                <button
                  key={num}
                  onClick={() => {
                    onNavigate(num);
                    setShowSlideMenu(false);
                  }}
                  className={`p-2 rounded hover:bg-gray-100 transition-colors text-sm font-medium ${
                    num === currentSlide ? 'bg-primary text-white hover:bg-primary/90' : ''
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentSlide / totalSlides) * 100}%` }}
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Audio */}
        <button
          onClick={onMuteToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={isMuted ? "音声オン (M)" : "ミュート (M)"}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* Notes */}
        {onShowNotes && (
          <button
            onClick={onShowNotes}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="発表者ノート (N)"
          >
            <List className="w-5 h-5" />
          </button>
        )}

        {/* Settings */}
        {onShowSettings && (
          <button
            onClick={onShowSettings}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="設定"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        )}

        {/* Fullscreen */}
        <button
          onClick={onFullscreenToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={isFullscreen ? "全画面終了 (F)" : "全画面 (F)"}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}