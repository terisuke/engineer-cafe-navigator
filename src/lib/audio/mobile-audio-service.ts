/**
 * Mobile-friendly audio service
 * Provides fallback mechanisms and better error handling for mobile devices
 */

import { WebAudioPlayer } from './web-audio-player';
import { AudioInteractionManager } from './audio-interaction-manager';
import { AudioDataProcessor } from './audio-data-processor';
import { 
  AudioError, 
  AudioErrorType, 
  type AudioOperationResult,
  type AudioDataInput,
  type MobileAudioPlayerOptions
} from './audio-interfaces';

export interface MobileAudioOptions extends MobileAudioPlayerOptions {
  retryAttempts?: number;
  retryDelay?: number;
}

// Legacy type alias for backward compatibility
export type AudioPlaybackResult = AudioOperationResult;

export class MobileAudioService {
  private webAudioPlayer: WebAudioPlayer | null = null;
  private interactionManager: AudioInteractionManager;
  private options: MobileAudioOptions;
  private currentMethod: 'web-audio' | null = null;

  constructor(options: MobileAudioOptions = {}) {
    this.options = {
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
    this.interactionManager = AudioInteractionManager.getInstance();
  }

  /**
   * Update event handlers for this instance
   */
  public updateEventHandlers(handlers: Partial<Pick<MobileAudioOptions, 'onPlay' | 'onEnded' | 'onError' | 'onPause'>>): void {
    this.options = { ...this.options, ...handlers };
  }

  /**
   * Load and play audio using Web Audio API only
   */
  public async playAudio(audioData: AudioDataInput): Promise<AudioOperationResult> {
    try {
      const result = await this.tryWebAudio(audioData);
      if (result.success) {
        this.currentMethod = 'web-audio';
        return { ...result, method: 'web-audio' };
      }
      
      const error = result.error || new AudioError(
        AudioErrorType.PLAYBACK_FAILED, 
        'Web Audio API playback failed'
      );

      return {
        success: false,
        method: 'web-audio',
        error
      };
    } catch (error) {
      const audioError = AudioError.fromError(error as Error, AudioErrorType.PLAYBACK_FAILED);
      return {
        success: false,
        method: 'web-audio',
        error: audioError
      };
    }
  }

  /**
   * Try Web Audio API playback
   * Uses AudioContext.decodeAudioData() - no HTMLAudioElement needed
   */
  private async tryWebAudio(audioData: AudioDataInput): Promise<AudioOperationResult> {
    try {
      const isTablet = /iPad|Android.*Tablet/i.test(navigator.userAgent);
      
      console.log('[MOBILE-AUDIO] Attempting Web Audio playback...', {
        isTablet,
        hasWebAudioPlayer: !!this.webAudioPlayer,
        audioDataType: typeof audioData,
        audioDataSize: audioData instanceof ArrayBuffer ? audioData.byteLength : 
                      audioData instanceof Blob ? audioData.size : audioData.length
      });

      // Ensure audio context is ready
      try {
        await this.interactionManager.ensureAudioContext();
      } catch (error) {
        // If user interaction is required, let the UI handle it
        if (error instanceof Error && error.message.includes('User interaction required')) {
          console.log('[MOBILE-AUDIO] User interaction required - letting UI handle this');
          throw new AudioError(
            AudioErrorType.USER_INTERACTION_REQUIRED,
            'User interaction required for audio playback',
            error as Error,
            true // requiresUserInteraction flag
          );
        } else {
          throw error;
        }
      }

      // For tablets, always recreate the player to avoid state issues
      if (!this.webAudioPlayer) {
        console.log('[MOBILE-AUDIO] Creating new WebAudioPlayer');
        this.webAudioPlayer = new WebAudioPlayer(this.options);
      } else if (isTablet) {
        // Reset existing player for tablets to avoid state issues
        console.log('[MOBILE-AUDIO] Resetting WebAudioPlayer for tablet compatibility');
        this.webAudioPlayer.reset();
      }

      // Load audio data using the new unified method
      const loadResult = await this.webAudioPlayer.loadAudioData(audioData);
      if (!loadResult.success) {
        return {
          success: false,
          method: 'web-audio',
          error: loadResult.error
        };
      }

      // Start audio playback
      const playResult = await this.webAudioPlayer.play();
      if (!playResult.success) {
        return playResult;
      }

      console.log('[MOBILE-AUDIO] Web Audio playback started successfully');
      
      // Simply return success - let AudioPlaybackService handle the waiting
      return {
        success: true,
        method: 'web-audio'
      };
    } catch (error) {
      console.warn('[MOBILE-AUDIO] Web Audio playback failed:', error);
      const audioError = AudioError.fromError(error as Error, AudioErrorType.PLAYBACK_FAILED);
      return {
        success: false,
        method: 'web-audio',
        error: audioError
      };
    }
  }



  // Removed helper methods - now using shared utilities from AudioDataProcessor and AudioError

  /**
   * Pause current playback
   */
  public pause(): void {
    if (this.webAudioPlayer) {
      this.webAudioPlayer.pause();
    }
  }

  /**
   * Stop current playback
   */
  public stop(): void {
    if (this.webAudioPlayer) {
      this.webAudioPlayer.stop();
      
      // Reset for tablets to prevent state issues
      const isTablet = /iPad|Android.*Tablet/i.test(navigator.userAgent);
      if (isTablet) {
        console.log('[MOBILE-AUDIO] Resetting WebAudioPlayer after stop for tablet compatibility');
        this.webAudioPlayer.reset();
      }
    }
  }

  /**
   * Set volume
   */
  public setVolume(volume: number): void {
    if (this.webAudioPlayer) {
      this.webAudioPlayer.setVolume(volume);
    }
  }

  /**
   * Get current playback time
   */
  public getCurrentTime(): number {
    if (this.webAudioPlayer) {
      return this.webAudioPlayer.getCurrentTime();
    }
    return 0;
  }

  /**
   * Get duration
   */
  public getDuration(): number {
    if (this.webAudioPlayer) {
      return this.webAudioPlayer.getDuration();
    }
    return 0;
  }

  /**
   * Check if playing
   */
  public isPlaying(): boolean {
    if (this.webAudioPlayer) {
      return this.webAudioPlayer.getIsPlaying();
    }
    return false;
  }

  /**
   * Get current playback method
   */
  public getCurrentMethod(): 'web-audio' | null {
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