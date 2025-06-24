/**
 * Web Audio API based audio player for mobile compatibility
 * Resolves autoplay policy issues on iPad and other mobile devices
 */

import { AudioDataProcessor, type AudioProcessingResult } from './audio-data-processor';
import { 
  AudioError, 
  AudioErrorType, 
  type AudioPlayerOptions,
  type AudioOperationResult,
  type AudioDataInput,
  type AudioInfo,
  type AudioPlaybackState
} from './audio-interfaces';

export class WebAudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private state: AudioPlaybackState = 'idle';
  private startTime = 0;
  private pauseTime = 0;
  private duration = 0;
  private options: AudioPlayerOptions;

  constructor(options: AudioPlayerOptions = {}) {
    this.options = options;
  }

  /**
   * Initialize AudioContext (must be called after user interaction)
   */
  public async initializeContext(): Promise<void> {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      return;
    }

    try {
      // Use webkitAudioContext for Safari compatibility
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      
      if (this.options.volume !== undefined) {
        this.gainNode.gain.value = this.options.volume;
      }
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      throw new Error('AudioContext initialization failed');
    }
  }

  /**
   * Load audio from base64 data (legacy method)
   * @deprecated Use loadAudioData instead
   */
  public async loadBase64Audio(base64Data: string): Promise<void> {
    const result = await this.loadAudioData(base64Data);
    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * Load audio from URL (legacy method)
   * @deprecated Use loadAudioData instead
   */
  public async loadAudio(url: string): Promise<void> {
    const result = await this.loadAudioData(url);
    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * Load audio from any supported data type (optimized for Web Audio API)
   */
  public async loadAudioData(data: AudioDataInput): Promise<AudioOperationResult<AudioInfo>> {
    if (!this.audioContext) {
      await this.initializeContext();
    }

    this.state = 'loading';
    
    try {
      let arrayBuffer: ArrayBuffer;
      let audioFormat = 'audio/mpeg';
      
      // Direct conversion for better performance
      if (typeof data === 'string') {
        // Base64 string - convert directly to ArrayBuffer
        console.log('[WebAudioPlayer] Converting base64 to ArrayBuffer:', {
          base64Length: data.length,
          base64Prefix: data.substring(0, 50)
        });
        
        // Clean base64 data
        let cleanedBase64 = data;
        if (data.includes(',')) {
          cleanedBase64 = data.split(',')[1];
        }
        cleanedBase64 = cleanedBase64.replace(/[^A-Za-z0-9+/=]/g, '');
        
        // Convert to binary
        const binaryString = atob(cleanedBase64);
        arrayBuffer = new ArrayBuffer(binaryString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
        
        // Detect audio format from binary data
        audioFormat = AudioDataProcessor.detectAudioFormat(arrayBuffer);
        
      } else if (data instanceof ArrayBuffer) {
        arrayBuffer = data;
        audioFormat = AudioDataProcessor.detectAudioFormat(arrayBuffer);
        
      } else if (data instanceof Blob) {
        arrayBuffer = await data.arrayBuffer();
        audioFormat = data.type || AudioDataProcessor.detectAudioFormat(arrayBuffer);
        
      } else {
        throw new AudioError(
          AudioErrorType.INVALID_DATA,
          'Unsupported audio data type'
        );
      }
      
      console.log('[WebAudioPlayer] Attempting to decode audio data:', {
        arrayBufferSize: arrayBuffer.byteLength,
        audioFormat,
        audioContextState: this.audioContext?.state,
        sampleRate: this.audioContext?.sampleRate,
        firstFewBytes: arrayBuffer.byteLength > 0 ? Array.from(new Uint8Array(arrayBuffer.slice(0, 10))) : 'NO DATA'
      });
      
      if (arrayBuffer.byteLength === 0) {
        throw new AudioError(
          AudioErrorType.INVALID_DATA,
          'Audio data is empty (0 bytes)'
        );
      }
      
      try {
        console.log('[WebAudioPlayer] Starting audio decode...');
        this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer.slice(0)); // Clone to avoid issues
        console.log('[WebAudioPlayer] Audio decode successful:', {
          duration: this.audioBuffer.duration,
          numberOfChannels: this.audioBuffer.numberOfChannels,
          sampleRate: this.audioBuffer.sampleRate,
          length: this.audioBuffer.length
        });
      } catch (decodeError) {
        console.error('[WebAudioPlayer] Failed to decode audio data:', {
          error: decodeError,
          arrayBufferSize: arrayBuffer.byteLength,
          audioContextState: this.audioContext?.state,
          errorName: decodeError instanceof Error ? decodeError.name : 'Unknown',
          errorMessage: decodeError instanceof Error ? decodeError.message : 'Unknown error',
          firstBytes: Array.from(new Uint8Array(arrayBuffer.slice(0, 20)))
        });
        throw new AudioError(
          AudioErrorType.DECODE_FAILED,
          `Failed to decode audio data: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`
        );
      }
      
      this.duration = this.audioBuffer.duration;
      this.state = 'loaded';

      const audioInfo: AudioInfo = {
        format: audioFormat as any,
        duration: this.duration,
        size: arrayBuffer.byteLength,
        sampleRate: this.audioBuffer.sampleRate
      };

      return { success: true, data: audioInfo };
      
    } catch (error) {
      console.error('[WebAudioPlayer] Failed to load audio:', error);
      
      const audioError = error instanceof AudioError ? error : 
        AudioError.fromError(error as Error, AudioErrorType.LOAD_FAILED);
      
      this.state = 'error';
      this.options.onError?.(audioError);
      return { success: false, error: audioError };
    }
  }

  /**
   * Play audio
   */
  public async play(): Promise<AudioOperationResult> {
    if (!this.audioBuffer || !this.audioContext || !this.gainNode) {
      const error = new AudioError(
        AudioErrorType.PLAYBACK_FAILED,
        'Audio not loaded or context not initialized'
      );
      return { success: false, error };
    }

    try {
      // Stop current playback if any
      this.stop();

      // Create new source
      this.source = this.audioContext.createBufferSource();
      this.source.buffer = this.audioBuffer;
      this.source.connect(this.gainNode);

      // Set up event handlers
      this.source.onended = () => {
        this.state = 'ended';
        this.options.onEnded?.();
      };

      // Start playback
      const offset = this.state === 'paused' ? this.pauseTime : 0;
      this.source.start(0, offset);
      this.startTime = this.audioContext.currentTime - offset;
      this.state = 'playing';

      this.options.onPlay?.();
      return { success: true, method: 'web-audio' };
      
    } catch (error) {
      console.error('[WebAudioPlayer] Failed to play audio:', error);
      
      const audioError = AudioError.fromError(
        error as Error, 
        AudioErrorType.PLAYBACK_FAILED
      );
      
      this.state = 'error';
      this.options.onError?.(audioError);
      return { success: false, error: audioError };
    }
  }

  /**
   * Pause audio
   */
  public pause(): void {
    if (this.state === 'playing' && this.source) {
      this.pauseTime = this.audioContext!.currentTime - this.startTime;
      this.source.stop();
      this.state = 'paused';
      this.options.onPause?.();
    }
  }

  /**
   * Stop audio
   */
  public stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch (error) {
        // Ignore errors if already stopped
      }
      this.source = null;
    }
    this.state = this.audioBuffer ? 'loaded' : 'idle';
    this.pauseTime = 0;
  }

  /**
   * Reset audio player for tablet compatibility
   */
  public reset(): void {
    this.stop();
    this.audioBuffer = null;
    this.duration = 0;
    this.state = 'idle';
    
    // Don't reset audioContext and gainNode as they should be reused
  }

  /**
   * Set volume (0.0 - 1.0)
   */
  public setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current playback time
   */
  public getCurrentTime(): number {
    if (!this.audioContext) return 0;
    
    if (this.state === 'playing') {
      return this.audioContext.currentTime - this.startTime;
    } else if (this.state === 'paused') {
      return this.pauseTime;
    }
    return 0;
  }

  /**
   * Get audio duration
   */
  public getDuration(): number {
    return this.duration;
  }

  /**
   * Get current playback state
   */
  public getState(): AudioPlaybackState {
    return this.state;
  }

  /**
   * Check if audio is playing
   */
  public getIsPlaying(): boolean {
    return this.state === 'playing';
  }

  /**
   * Check if audio is paused
   */
  public getIsPaused(): boolean {
    return this.state === 'paused';
  }

  /**
   * Check if audio is loaded
   */
  public isLoaded(): boolean {
    return this.state === 'loaded' || this.state === 'playing' || this.state === 'paused';
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stop();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.audioBuffer = null;
    this.gainNode = null;
    this.state = 'idle';
  }

  /**
   * Check if AudioContext is supported
   */
  public static isSupported(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  /**
   * Get AudioContext state
   */
  public getAudioContextState(): AudioContextState | null {
    return this.audioContext?.state || null;
  }
}

/**
 * Global AudioContext manager for better resource management
 */
export class GlobalAudioManager {
  private static instance: GlobalAudioManager;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): GlobalAudioManager {
    if (!GlobalAudioManager.instance) {
      GlobalAudioManager.instance = new GlobalAudioManager();
    }
    return GlobalAudioManager.instance;
  }

  public async initialize(): Promise<AudioContext> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      return this.audioContext;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      return this.audioContext;
    } catch (error) {
      console.error('Failed to initialize global AudioContext:', error);
      throw error;
    }
  }

  public getContext(): AudioContext | null {
    return this.audioContext;
  }

  public async ensureResumed(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public isContextInitialized(): boolean {
    return this.isInitialized && this.audioContext !== null;
  }

  public dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.isInitialized = false;
  }
}