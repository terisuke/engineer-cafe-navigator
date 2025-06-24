/**
 * Unified Audio Interfaces
 * 
 * Standardized interfaces and types for the audio system.
 * Provides consistent error handling, event callbacks, and method signatures
 * across all audio services and components.
 * 
 * @author Engineer Cafe Navigator Team
 * @since 2025-06-24
 */

import type { AudioFormat } from './audio-data-processor';

/**
 * Audio data input types
 */
export type AudioDataInput = string | ArrayBuffer | Blob;

/**
 * Audio playback states
 */
export type AudioPlaybackState = 'idle' | 'loading' | 'loaded' | 'playing' | 'paused' | 'ended' | 'error';

/**
 * Audio error types for better error categorization
 */
export enum AudioErrorType {
  INITIALIZATION_FAILED = 'initialization_failed',
  LOAD_FAILED = 'load_failed',
  DECODE_FAILED = 'decode_failed',
  PLAYBACK_FAILED = 'playback_failed',
  FORMAT_UNSUPPORTED = 'format_unsupported',
  PERMISSION_DENIED = 'permission_denied',
  NETWORK_ERROR = 'network_error',
  INVALID_DATA = 'invalid_data',
  USER_INTERACTION_REQUIRED = 'user_interaction_required'
}

/**
 * Standardized audio error class
 */
export class AudioError extends Error {
  public readonly type: AudioErrorType;
  public readonly originalError?: Error;
  public readonly requiresUserInteraction: boolean;

  constructor(
    type: AudioErrorType, 
    message: string, 
    originalError?: Error,
    requiresUserInteraction: boolean = false
  ) {
    super(message);
    this.name = 'AudioError';
    this.type = type;
    this.originalError = originalError;
    this.requiresUserInteraction = requiresUserInteraction;
  }

  /**
   * Check if error is due to missing user interaction
   */
  static isInteractionRequired(error: Error): boolean {
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
   * Create AudioError from generic error
   */
  static fromError(error: Error, type: AudioErrorType = AudioErrorType.PLAYBACK_FAILED): AudioError {
    const requiresInteraction = this.isInteractionRequired(error);
    return new AudioError(type, error.message, error, requiresInteraction);
  }
}

/**
 * Result wrapper for audio operations
 */
export interface AudioOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: AudioError;
  method?: string; // e.g., 'web-audio', 'html-audio'
}

/**
 * Audio playback information
 */
export interface AudioInfo {
  format: AudioFormat;
  duration: number;
  size: number;
  sampleRate?: number;
}

/**
 * Unified audio player interface
 * All audio players should implement this interface for consistency
 */
export interface UnifiedAudioPlayer {
  // Core playback methods
  load(data: AudioDataInput): Promise<AudioOperationResult<AudioInfo>>;
  play(): Promise<AudioOperationResult>;
  pause(): void;
  stop(): void;
  
  // Audio control
  setVolume(volume: number): void;
  getVolume(): number;
  
  // Playback state
  getCurrentTime(): number;
  getDuration(): number;
  getState(): AudioPlaybackState;
  isPlaying(): boolean;
  isPaused(): boolean;
  
  // Resource management
  dispose(): void;
  
  // Event handling
  on(event: AudioPlayerEvent, callback: AudioEventCallback): void;
  off(event: AudioPlayerEvent, callback: AudioEventCallback): void;
}

/**
 * Audio player events
 */
export type AudioPlayerEvent = 
  | 'loadstart'
  | 'loaded' 
  | 'play'
  | 'pause'
  | 'ended'
  | 'error'
  | 'timeupdate'
  | 'volumechange';

/**
 * Audio event callback types
 */
export type AudioEventCallback = 
  | (() => void)
  | ((error: AudioError) => void)
  | ((time: number) => void)
  | ((volume: number) => void);

/**
 * Audio player configuration options
 */
export interface AudioPlayerOptions {
  volume?: number;
  autoplay?: boolean;
  loop?: boolean;
  preload?: boolean;
  crossOrigin?: string;
  
  // Event callbacks (legacy support)
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: AudioError) => void;
  onTimeUpdate?: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
}

/**
 * Mobile audio specific options
 */
export interface MobileAudioPlayerOptions extends AudioPlayerOptions {
  enableFallback?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  preferredMethod?: 'web-audio' | 'html-audio' | 'auto';
}

/**
 * Lip-sync related interfaces
 */
export interface VisemeFrame {
  mouthShape: string;
  mouthOpen: number;
  timestamp: number;
}

export interface LipSyncOptions {
  enableLipSync: boolean;
  onVisemeUpdate?: (viseme: string, intensity: number) => void;
  frameRate?: number; // fps
}

/**
 * Audio playback service options
 */
export interface AudioPlaybackServiceOptions extends AudioPlayerOptions, LipSyncOptions {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

/**
 * Audio service factory interface
 * For creating appropriate audio services based on environment
 */
export interface AudioServiceFactory {
  createPlayer(options?: AudioPlayerOptions): UnifiedAudioPlayer;
  createMobilePlayer(options?: MobileAudioPlayerOptions): UnifiedAudioPlayer;
  getSupportedFormats(): AudioFormat[];
  isSupported(): boolean;
}

/**
 * Audio context management interface
 */
export interface AudioContextManager {
  getContext(): AudioContext | null;
  initialize(): Promise<AudioContext>;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
  getState(): AudioContextState;
  isInitialized(): boolean;
}

/**
 * Device capabilities for audio optimization
 */
export interface AudioDeviceCapabilities {
  supportsWebAudio: boolean;
  supportsHtmlAudio: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  hasUserGestureRestriction: boolean;
  recommendedMethod: 'web-audio' | 'html-audio';
}

/**
 * Audio processing pipeline interface
 */
export interface AudioProcessor {
  process(data: AudioDataInput): Promise<AudioOperationResult<Blob>>;
  validate(data: AudioDataInput): Promise<AudioOperationResult<boolean>>;
  getInfo(data: AudioDataInput): Promise<AudioOperationResult<AudioInfo>>;
}