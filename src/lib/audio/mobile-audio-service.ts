/**
 * Mobile-friendly audio service
 * Provides fallback mechanisms and better error handling for mobile devices
 */

import { WebAudioPlayer, type AudioPlayerOptions } from './web-audio-player';
import { AudioInteractionManager } from './audio-interaction-manager';

export interface MobileAudioOptions extends AudioPlayerOptions {
  enableFallback?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface AudioPlaybackResult {
  success: boolean;
  method: 'web-audio' | 'html-audio' | 'failed';
  error?: Error;
  requiresInteraction?: boolean;
}

export class MobileAudioService {
  private webAudioPlayer: WebAudioPlayer | null = null;
  private htmlAudioElement: HTMLAudioElement | null = null;
  private interactionManager: AudioInteractionManager;
  private options: MobileAudioOptions;
  private currentMethod: 'web-audio' | 'html-audio' | null = null;

  constructor(options: MobileAudioOptions = {}) {
    this.options = {
      enableFallback: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
    this.interactionManager = AudioInteractionManager.getInstance();
  }

  /**
   * Load and play audio with automatic fallback
   */
  public async playAudio(audioData: string | ArrayBuffer): Promise<AudioPlaybackResult> {
    let lastError: Error | null = null;

    // Try Web Audio API first
    try {
      const result = await this.tryWebAudio(audioData);
      if (result.success) {
        this.currentMethod = 'web-audio';
        return result;
      }
      lastError = result.error || new Error('Web Audio failed');
    } catch (error) {
      lastError = error as Error;
    }

    // Fallback to HTML Audio if enabled
    if (this.options.enableFallback) {
      try {
        const result = await this.tryHtmlAudio(audioData);
        if (result.success) {
          this.currentMethod = 'html-audio';
          return result;
        }
        lastError = result.error || lastError;
      } catch (error) {
        lastError = error as Error;
      }
    }

    return {
      success: false,
      method: 'failed',
      error: lastError || new Error('All audio playback methods failed'),
      requiresInteraction: this.checkIfInteractionRequired(lastError)
    };
  }

  /**
   * Try Web Audio API playback
   */
  private async tryWebAudio(audioData: string | ArrayBuffer): Promise<AudioPlaybackResult> {
    try {
      // Ensure audio context is ready
      await this.interactionManager.ensureAudioContext();

      // Create new player if needed
      if (!this.webAudioPlayer) {
        this.webAudioPlayer = new WebAudioPlayer(this.options);
      }

      // Load audio data
      if (typeof audioData === 'string') {
        if (audioData.startsWith('data:') || audioData.startsWith('blob:')) {
          await this.webAudioPlayer.loadBase64Audio(audioData);
        } else {
          await this.webAudioPlayer.loadAudio(audioData);
        }
      } else {
        // Handle ArrayBuffer - convert to base64
        const base64 = this.arrayBufferToBase64(audioData);
        await this.webAudioPlayer.loadBase64Audio(`data:audio/wav;base64,${base64}`);
      }

      // Play audio
      await this.webAudioPlayer.play();

      return {
        success: true,
        method: 'web-audio'
      };
    } catch (error) {
      console.warn('Web Audio playback failed:', error);
      return {
        success: false,
        method: 'web-audio',
        error: error as Error,
        requiresInteraction: this.checkIfInteractionRequired(error as Error)
      };
    }
  }

  /**
   * Try HTML Audio fallback
   */
  private async tryHtmlAudio(audioData: string | ArrayBuffer): Promise<AudioPlaybackResult> {
    try {
      let audioUrl: string;

      if (typeof audioData === 'string') {
        audioUrl = audioData;
      } else {
        // Convert ArrayBuffer to blob URL
        const blob = new Blob([audioData], { type: 'audio/wav' });
        audioUrl = URL.createObjectURL(blob);
      }

      // Create HTML audio element
      this.htmlAudioElement = new Audio(audioUrl);
      
      // Set up event handlers
      if (this.options.onPlay) {
        this.htmlAudioElement.addEventListener('play', this.options.onPlay);
      }
      if (this.options.onPause) {
        this.htmlAudioElement.addEventListener('pause', this.options.onPause);
      }
      if (this.options.onEnded) {
        this.htmlAudioElement.addEventListener('ended', this.options.onEnded);
      }

      // Set volume
      if (this.options.volume !== undefined) {
        this.htmlAudioElement.volume = this.options.volume;
      }

      // Play with retry mechanism
      await this.playWithRetry(this.htmlAudioElement);

      return {
        success: true,
        method: 'html-audio'
      };
    } catch (error) {
      console.warn('HTML Audio playback failed:', error);
      return {
        success: false,
        method: 'html-audio',
        error: error as Error,
        requiresInteraction: this.checkIfInteractionRequired(error as Error)
      };
    }
  }

  /**
   * Play HTML audio with retry mechanism
   */
  private async playWithRetry(audio: HTMLAudioElement): Promise<void> {
    let attempts = 0;
    const maxAttempts = this.options.retryAttempts || 3;

    while (attempts < maxAttempts) {
      try {
        await audio.play();
        return; // Success
      } catch (error) {
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw error;
        }

        // Check if it's an interaction error
        if (this.checkIfInteractionRequired(error as Error)) {
          // Wait for user interaction
          await this.interactionManager.requestUserInteraction();
        } else {
          // General retry delay
          await this.delay(this.options.retryDelay || 1000);
        }
      }
    }
  }

  /**
   * Check if error is due to missing user interaction
   */
  private checkIfInteractionRequired(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes('user gesture') ||
      errorMessage.includes('user interaction') ||
      errorMessage.includes('autoplay') ||
      errorMessage.includes('not allowed') ||
      error.name === 'NotAllowedError'
    );
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Pause current playback
   */
  public pause(): void {
    if (this.currentMethod === 'web-audio' && this.webAudioPlayer) {
      this.webAudioPlayer.pause();
    } else if (this.currentMethod === 'html-audio' && this.htmlAudioElement) {
      this.htmlAudioElement.pause();
    }
  }

  /**
   * Stop current playback
   */
  public stop(): void {
    if (this.currentMethod === 'web-audio' && this.webAudioPlayer) {
      this.webAudioPlayer.stop();
    } else if (this.currentMethod === 'html-audio' && this.htmlAudioElement) {
      this.htmlAudioElement.pause();
      this.htmlAudioElement.currentTime = 0;
    }
  }

  /**
   * Set volume
   */
  public setVolume(volume: number): void {
    if (this.currentMethod === 'web-audio' && this.webAudioPlayer) {
      this.webAudioPlayer.setVolume(volume);
    } else if (this.currentMethod === 'html-audio' && this.htmlAudioElement) {
      this.htmlAudioElement.volume = volume;
    }
  }

  /**
   * Get current playback time
   */
  public getCurrentTime(): number {
    if (this.currentMethod === 'web-audio' && this.webAudioPlayer) {
      return this.webAudioPlayer.getCurrentTime();
    } else if (this.currentMethod === 'html-audio' && this.htmlAudioElement) {
      return this.htmlAudioElement.currentTime;
    }
    return 0;
  }

  /**
   * Get duration
   */
  public getDuration(): number {
    if (this.currentMethod === 'web-audio' && this.webAudioPlayer) {
      return this.webAudioPlayer.getDuration();
    } else if (this.currentMethod === 'html-audio' && this.htmlAudioElement) {
      return this.htmlAudioElement.duration || 0;
    }
    return 0;
  }

  /**
   * Check if playing
   */
  public isPlaying(): boolean {
    if (this.currentMethod === 'web-audio' && this.webAudioPlayer) {
      return this.webAudioPlayer.getIsPlaying();
    } else if (this.currentMethod === 'html-audio' && this.htmlAudioElement) {
      return !this.htmlAudioElement.paused;
    }
    return false;
  }

  /**
   * Get current playback method
   */
  public getCurrentMethod(): 'web-audio' | 'html-audio' | null {
    return this.currentMethod;
  }

  /**
   * Check if audio context is ready
   */
  public isAudioContextReady(): boolean {
    return this.interactionManager.isAudioContextReady();
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.webAudioPlayer) {
      this.webAudioPlayer.dispose();
      this.webAudioPlayer = null;
    }

    if (this.htmlAudioElement) {
      this.htmlAudioElement.pause();
      this.htmlAudioElement = null;
    }

    this.currentMethod = null;
  }
}

/**
 * Detect device type for audio optimization
 */
export class DeviceDetector {
  public static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  public static isAndroid(): boolean {
    return /Android/.test(navigator.userAgent);
  }

  public static isMobile(): boolean {
    return this.isIOS() || this.isAndroid() || window.innerWidth <= 768;
  }

  public static isTablet(): boolean {
    return /iPad/.test(navigator.userAgent) || 
           (this.isAndroid() && window.innerWidth >= 768);
  }

  public static getSafariVersion(): number | null {
    const match = navigator.userAgent.match(/Version\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  public static supportsWebAudio(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  public static getRecommendedAudioMethod(): 'web-audio' | 'html-audio' {
    // iOS Safari has strict autoplay policies, Web Audio works better
    if (this.isIOS()) {
      return 'web-audio';
    }
    
    // Android generally works well with both, prefer Web Audio for consistency
    if (this.isAndroid()) {
      return 'web-audio';
    }

    // Desktop - either works, Web Audio preferred for advanced features
    return 'web-audio';
  }
}