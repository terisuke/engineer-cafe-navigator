export class AudioStateManager {
  private audioProcessingCount: number = 0;
  private audioQueue: Array<{
    id: string;
    audioUrl: string;
    onComplete?: () => void;
  }> = [];
  private currentAudio: HTMLAudioElement | null = null;
  private isProcessing: boolean = false;
  private activeAudios: Set<HTMLAudioElement> = new Set();
  private globalVolume: number = 0.8;
  private globalMuted: boolean = false;
  
  incrementProcessingCount(): void {
    this.audioProcessingCount++;
    console.log(`[AudioStateManager] Processing count incremented: ${this.audioProcessingCount}`);
  }
  
  decrementProcessingCount(): void {
    this.audioProcessingCount--;
    console.log(`[AudioStateManager] Processing count decremented: ${this.audioProcessingCount}`);
    
    if (this.audioProcessingCount === 0) {
      this.onAllAudioComplete();
    }
  }
  
  isAudioProcessing(): boolean {
    return this.audioProcessingCount > 0;
  }
  
  queueAudio(audioUrl: string, onComplete?: () => void): void {
    const id = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.audioQueue.push({ id, audioUrl, onComplete });
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  private async processQueue(): Promise<void> {
    if (this.audioQueue.length === 0 || this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    const { audioUrl, onComplete } = this.audioQueue.shift()!;
    
    this.incrementProcessingCount();
    
    try {
      await this.playAudio(audioUrl);
      onComplete?.();
    } catch (error) {
      console.error('[AudioStateManager] Audio playback error:', error);
    } finally {
      this.decrementProcessingCount();
      this.isProcessing = false;
      
      if (this.audioQueue.length > 0) {
        this.processQueue();
      }
    }
  }
  
  private playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this.registerAudio(audio);
      
      // Add small preload delay to prevent audio truncation
      audio.preload = 'auto';
      
      audio.onended = () => {
        this.activeAudios.delete(audio);
        resolve();
      };
      
      audio.onerror = (error) => {
        console.error('[AudioStateManager] Audio error:', error);
        reject(error);
      };
      
      // Wait for audio to be ready before playing
      audio.oncanplaythrough = () => {
        console.log('[AudioStateManager] Audio ready to play');
        audio.play().catch((error) => {
          if (error.name === 'NotAllowedError') {
            console.warn('[AudioStateManager] Autoplay blocked by browser. User interaction required.');
            resolve();
          } else {
            console.error('[AudioStateManager] Audio play failed:', error);
            reject(error);
          }
        });
      };
      
      // Start loading the audio
      audio.load();
    });
  }
  
  stopAll(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.audioQueue = [];
    this.audioProcessingCount = 0;
    this.isProcessing = false;
  }
  
  private onAllAudioComplete(): void {
    console.log('[AudioStateManager] All audio processing complete');
    window.dispatchEvent(new CustomEvent('audioProcessingComplete'));
  }
  
  // Register externally created audio instances
  registerAudio(audio: HTMLAudioElement) {
    this.activeAudios.add(audio);
    audio.volume = this.globalMuted ? 0 : this.globalVolume;
    audio.muted = this.globalMuted;
    audio.onended = () => {
      this.activeAudios.delete(audio);
    };
  }
  
  setVolume(vol: number) {
    this.globalVolume = Math.max(0, Math.min(1, vol));
    this.activeAudios.forEach(a => {
      a.volume = this.globalMuted ? 0 : this.globalVolume;
    });
  }
  
  setMuted(muted: boolean) {
    this.globalMuted = muted;
    this.activeAudios.forEach(a => {
      a.muted = muted;
      if (muted) {
        a.volume = 0;
      } else {
        a.volume = this.globalVolume;
      }
    });
  }
}

export const audioStateManager = new AudioStateManager();