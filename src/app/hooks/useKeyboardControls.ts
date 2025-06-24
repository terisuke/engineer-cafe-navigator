'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardControlsOptions {
  onPrevious?: () => void;
  onReset?: () => void;
  onTogglePlay?: () => void;
  onToggleNotes?: () => void;
  onToggleFullscreen?: () => void;
  onQuestionMode?: () => void;
  onEscape?: () => void;
  onNumberKey?: (num: number) => void;
  enabled?: boolean;
}

export function useKeyboardControls({
  onPrevious,
  onReset,
  onTogglePlay,
  onToggleNotes,
  onToggleFullscreen,
  onQuestionMode,
  onEscape,
  onNumberKey,
  enabled = true
}: KeyboardControlsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if user is typing in an input field
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Prevent default for handled keys
    const preventDefault = () => event.preventDefault();

    switch (event.key.toLowerCase()) {
      // Navigation (next removed - auto-advance only)
      // case 'arrowright':
      // case ' ': // Space bar
      //   preventDefault();
      //   onNext?.();
      //   break;
      
      case 'arrowleft':
        preventDefault();
        onPrevious?.();
        break;
      
      case 'home':
      case 'r':
        preventDefault();
        onReset?.();
        break;
      
      // Playback
      case 'p':
        preventDefault();
        onTogglePlay?.();
        break;
      
      // View controls
      case 'n':
        preventDefault();
        onToggleNotes?.();
        break;
      
      case 'f':
        if (!event.metaKey && !event.ctrlKey) { // Avoid conflict with browser fullscreen
          preventDefault();
          onToggleFullscreen?.();
        }
        break;
      
      // Question mode
      case 'q':
        preventDefault();
        onQuestionMode?.();
        break;
      
      // Escape
      case 'escape':
        preventDefault();
        onEscape?.();
        break;
      
      // Number keys for direct slide navigation
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '0':
        preventDefault();
        const num = event.key === '0' ? 10 : parseInt(event.key);
        onNumberKey?.(num);
        break;
    }

    // Handle arrow up/down for volume control if needed
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      // Could be used for volume control in the future
    }
  }, [
    enabled,
    onPrevious,
    onReset,
    onTogglePlay,
    onToggleNotes,
    onToggleFullscreen,
    onQuestionMode,
    onEscape,
    onNumberKey
  ]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: [
      { key: '←', description: 'Previous slide' },
      { key: 'R / Home', description: 'Reset to first slide' },
      { key: 'P', description: 'Play/Pause' },
      { key: 'N', description: 'Toggle notes' },
      { key: 'F', description: 'Toggle fullscreen' },
      { key: 'Q', description: 'Question mode' },
      { key: '1-9', description: 'Jump to slide' },
      { key: 'Esc', description: 'Exit mode' }
    ]
  };
}