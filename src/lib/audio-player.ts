export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private isPlaying = false;
  private volume = 1.0;
  private playbackRate = 1.0;

  constructor(
    private onEnded?: () => void,
    private onError?: (error: Error) => void,
    private onTimeUpdate?: (currentTime: number, duration: number) => void
  ) {}

  async playFromBase64(
    audioBase64: string,
    audioType: string = 'audio/mp3'
  ): Promise<void> {
    try {
      // Stop any currently playing audio
      this.stop();

      // Convert base64 to blob
      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioData], { type: audioType });
      const audioUrl = URL.createObjectURL(audioBlob);

      await this.playFromUrl(audioUrl);
    } catch (error) {
      this.onError?.(new Error(`Failed to play from base64: ${error}`));
    }
  }

  async playFromUrl(url: string): Promise<void> {
    try {
      // Stop any currently playing audio
      this.stop();

      this.audio = new Audio(url);
      this.currentUrl = url;

      // Configure audio element
      this.audio.volume = this.volume;
      this.audio.playbackRate = this.playbackRate;

      // Set up event listeners
      this.setupEventListeners();

      // Start playing
      await this.audio.play();
      this.isPlaying = true;
    } catch (error) {
      this.onError?.(new Error(`Failed to play audio: ${error}`));
    }
  }

  async playFromBlob(blob: Blob): Promise<void> {
    try {
      const url = URL.createObjectURL(blob);
      await this.playFromUrl(url);
    } catch (error) {
      this.onError?.(new Error(`Failed to play from blob: ${error}`));
    }
  }

  private setupEventListeners(): void {
    if (!this.audio) return;

    this.audio.onended = () => {
      this.isPlaying = false;
      this.cleanup();
      this.onEnded?.();
    };

    this.audio.onerror = () => {
      this.isPlaying = false;
      this.onError?.(new Error('Audio playback error'));
      this.cleanup();
    };

    this.audio.ontimeupdate = () => {
      if (this.audio) {
        this.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
      }
    };

    this.audio.onpause = () => {
      this.isPlaying = false;
    };

    this.audio.onplay = () => {
      this.isPlaying = true;
    };
  }

  pause(): void {
    if (this.audio && this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  resume(): void {
    if (this.audio && !this.isPlaying) {
      this.audio.play();
      this.isPlaying = true;
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isPlaying = false;
    }
    this.cleanup();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.25, Math.min(4, rate));
    if (this.audio) {
      this.audio.playbackRate = this.playbackRate;
    }
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  private cleanup(): void {
    if (this.currentUrl) {
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }

  destroy(): void {
    this.stop();
    this.audio = null;
  }

  // Static methods for simple playback
  static async playBeep(frequency: number = 440, duration: number = 200): Promise<void> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);

      setTimeout(() => {
        audioContext.close();
      }, duration + 100);
    } catch (error) {
      console.error('Failed to play beep:', error);
    }
  }

  static async playNotificationSound(): Promise<void> {
    await AudioPlayer.playBeep(800, 150);
    setTimeout(() => AudioPlayer.playBeep(600, 150), 200);
  }

  static async playErrorSound(): Promise<void> {
    await AudioPlayer.playBeep(200, 300);
  }

  static async playSuccessSound(): Promise<void> {
    await AudioPlayer.playBeep(550, 100);
    setTimeout(() => AudioPlayer.playBeep(660, 100), 120);
    setTimeout(() => AudioPlayer.playBeep(770, 200), 240);
  }
}

// Queue-based audio player for sequential playback
export class AudioQueue {
  private queue: Array<{
    id: string;
    audioBase64: string;
    audioType: string;
    priority: number;
  }> = [];
  private player: AudioPlayer;
  private isProcessing = false;
  private currentId: string | null = null;

  constructor(
    private onItemStarted?: (id: string) => void,
    private onItemCompleted?: (id: string) => void,
    private onError?: (id: string, error: Error) => void
  ) {
    this.player = new AudioPlayer(
      () => this.processNext(),
      (error) => this.handleError(error),
      (currentTime, duration) => this.onTimeUpdate?.(currentTime, duration)
    );
  }

  add(
    id: string,
    audioBase64: string,
    audioType: string = 'audio/mp3',
    priority: number = 0
  ): void {
    const item = { id, audioBase64, audioType, priority };
    
    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    if (!this.isProcessing) {
      this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      this.currentId = null;
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift()!;
    this.currentId = item.id;

    try {
      this.onItemStarted?.(item.id);
      await this.player.playFromBase64(item.audioBase64, item.audioType);
    } catch (error) {
      this.handleError(new Error(`Failed to play ${item.id}: ${error}`));
    }
  }

  private handleError(error: Error): void {
    if (this.currentId) {
      this.onError?.(this.currentId, error);
      this.onItemCompleted?.(this.currentId);
    }
    this.processNext();
  }

  clear(): void {
    this.queue = [];
    this.player.stop();
    this.isProcessing = false;
    this.currentId = null;
  }

  skip(): void {
    this.player.stop();
    // processNext will be called automatically via onEnded
  }

  pause(): void {
    this.player.pause();
  }

  resume(): void {
    this.player.resume();
  }

  setVolume(volume: number): void {
    this.player.setVolume(volume);
  }

  setPlaybackRate(rate: number): void {
    this.player.setPlaybackRate(rate);
  }

  getCurrentId(): string | null {
    return this.currentId;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getQueueItems(): string[] {
    return this.queue.map(item => item.id);
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  isPlaying(): boolean {
    return this.player.isCurrentlyPlaying();
  }

  destroy(): void {
    this.clear();
    this.player.destroy();
  }

  // Event handlers that can be overridden
  private onTimeUpdate?: (currentTime: number, duration: number) => void;

  onProgress(callback: (currentTime: number, duration: number) => void): void {
    this.onTimeUpdate = callback;
  }
}

// Utility functions
export class AudioUtils {
  static async convertBase64ToBlob(base64: string, mimeType: string): Promise<Blob> {
    const response = await fetch(`data:${mimeType};base64,${base64}`);
    return response.blob();
  }

  static async convertBlobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  static async getAudioDuration(base64: string, mimeType: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };
      audio.onerror = reject;
      
      const blob = AudioUtils.base64ToBlob(base64, mimeType);
      audio.src = URL.createObjectURL(blob);
    });
  }

  static base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  static formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  static calculateWaveformData(audioBuffer: AudioBuffer, samples: number = 100): number[] {
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerGroup = Math.floor(channelData.length / samples);
    const waveformData: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = i * samplesPerGroup;
      const end = start + samplesPerGroup;
      let max = 0;

      for (let j = start; j < end; j++) {
        const value = Math.abs(channelData[j]);
        if (value > max) {
          max = value;
        }
      }

      waveformData.push(max);
    }

    return waveformData;
  }

  static async analyzeAudioFrequency(
    audioBuffer: AudioBuffer,
    fftSize: number = 2048
  ): Promise<Float32Array> {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);

    const frequencyData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(frequencyData);

    await audioContext.close();
    return frequencyData;
  }
}

// Types
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
}

export interface AudioQueueItem {
  id: string;
  audioBase64: string;
  audioType: string;
  priority: number;
}
