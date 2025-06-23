/**
 * Web Audio API based audio player for mobile compatibility
 * Resolves autoplay policy issues on iPad and other mobile devices
 */

export interface AudioPlayerOptions {
  volume?: number;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onPlay?: () => void;
  onPause?: () => void;
}

export class WebAudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private isPaused = false;
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
   * Load audio from URL
   */
  public async loadAudio(url: string): Promise<void> {
    if (!this.audioContext) {
      await this.initializeContext();
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.duration = this.audioBuffer.duration;
    } catch (error) {
      console.error('Failed to load audio:', error);
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Load audio from base64 data
   */
  public async loadBase64Audio(base64Data: string): Promise<void> {
    if (!this.audioContext) {
      await this.initializeContext();
    }

    try {
      // Remove data URL prefix if present
      const cleanBase64 = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
      
      // Convert base64 to ArrayBuffer
      const binaryString = window.atob(cleanBase64);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.duration = this.audioBuffer.duration;
    } catch (error) {
      console.error('Failed to load base64 audio:', error);
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Play audio
   */
  public async play(): Promise<void> {
    if (!this.audioBuffer || !this.audioContext || !this.gainNode) {
      throw new Error('Audio not loaded or context not initialized');
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
        this.isPlaying = false;
        this.isPaused = false;
        this.options.onEnded?.();
      };

      // Start playback
      const offset = this.isPaused ? this.pauseTime : 0;
      this.source.start(0, offset);
      this.startTime = this.audioContext.currentTime - offset;
      this.isPlaying = true;
      this.isPaused = false;

      this.options.onPlay?.();
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Pause audio
   */
  public pause(): void {
    if (this.isPlaying && this.source) {
      this.pauseTime = this.audioContext!.currentTime - this.startTime;
      this.source.stop();
      this.isPlaying = false;
      this.isPaused = true;
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
    this.isPlaying = false;
    this.isPaused = false;
    this.pauseTime = 0;
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
    
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    } else if (this.isPaused) {
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
   * Check if audio is playing
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Check if audio is paused
   */
  public getIsPaused(): boolean {
    return this.isPaused;
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