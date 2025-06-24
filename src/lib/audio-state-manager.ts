import { MobileAudioService } from './audio/mobile-audio-service';
import { AudioDataProcessor } from './audio/audio-data-processor';
import { AudioError, AudioErrorType } from './audio/audio-interfaces';

export class AudioStateManager {
  private audioProcessingCount: number = 0;
  private audioQueue: Array<{
    id: string;
    audioData: string; // base64 encoded audio data (data:audio/wav;base64,...)
    onComplete?: () => void;
  }> = [];
  private currentAudioService: MobileAudioService | null = null;
  private isProcessing: boolean = false;
  private activeAudioServices: Set<MobileAudioService> = new Set();
  private globalVolume: number = 0.8;
  private globalMuted: boolean = false;
  
  incrementProcessingCount(): void {
    this.audioProcessingCount++;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AudioStateManager] Processing count incremented to ${this.audioProcessingCount}`);
    }
  }
  
  decrementProcessingCount(): void {
    this.audioProcessingCount--;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AudioStateManager] Processing count decremented to ${this.audioProcessingCount}`);
    }
    
    if (this.audioProcessingCount === 0) {
      this.onAllAudioComplete();
    }
  }
  
  isAudioProcessing(): boolean {
    return this.audioProcessingCount > 0;
  }
  
  queueAudio(audioData: string, onComplete?: () => void): void {
    const id = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.audioQueue.push({ id, audioData, onComplete });
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  private async processQueue(): Promise<void> {
    if (this.audioQueue.length === 0 || this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    const { audioData, onComplete } = this.audioQueue.shift()!;
    
    this.incrementProcessingCount();
    
    try {
      await this.playAudio(audioData);
      onComplete?.();
    } catch (error) {
      console.error('[AudioStateManager] Audio playback failed:', error);
      // Continue processing queue despite error
    } finally {
      this.decrementProcessingCount();
      this.isProcessing = false;
      
      if (this.audioQueue.length > 0) {
        this.processQueue();
      }
    }
  }
  
  private async playAudio(audioData: string): Promise<void> {
    // Stop current audio if playing
    if (this.currentAudioService) {
      this.activeAudioServices.delete(this.currentAudioService);
      this.currentAudioService = null;
    }
    
    // Create new audio service
    const audioService = new MobileAudioService({
      volume: this.globalMuted ? 0 : this.globalVolume,
      onEnded: () => {
        this.activeAudioServices.delete(audioService);
        this.currentAudioService = null;
      },
      onError: (error) => {
        this.activeAudioServices.delete(audioService);
        this.currentAudioService = null;
        throw error;
      }
    });
    
    this.currentAudioService = audioService;
    this.registerAudioService(audioService);
    
    // Play the audio
    const result = await audioService.playAudio(audioData);
    if (!result.success) {
      throw result.error || new AudioError(AudioErrorType.PLAYBACK_FAILED, 'Audio playback failed');
    }
    
    // Wait for audio to complete
    return new Promise((resolve, reject) => {
      audioService.updateEventHandlers({
        onEnded: () => {
          this.activeAudioServices.delete(audioService);
          this.currentAudioService = null;
          resolve();
        },
        onError: (error) => {
          this.activeAudioServices.delete(audioService);
          this.currentAudioService = null;
          reject(error);
        }
      });
    });
  }
  
  stopAll(): void {
    // Stop current audio service
    if (this.currentAudioService) {
      this.currentAudioService.stop();
      this.currentAudioService = null;
    }
    
    // Stop all active audio services
    this.activeAudioServices.forEach(audioService => {
      audioService.stop();
    });
    
    this.activeAudioServices.clear();
    this.audioQueue = [];
    this.audioProcessingCount = 0;
    this.isProcessing = false;
  }
  
  private onAllAudioComplete(): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AudioStateManager] All audio processing complete');
    }
    window.dispatchEvent(new CustomEvent('audioProcessingComplete'));
  }
  
  // Register externally created audio service instances
  registerAudioService(audioService: MobileAudioService) {
    this.activeAudioServices.add(audioService);
    // Volume settings will be applied when creating the service
  }
  
  setVolume(vol: number) {
    this.globalVolume = Math.max(0, Math.min(1, vol));
    // Volume will be applied to new audio service instances
  }
  
  setMuted(muted: boolean) {
    this.globalMuted = muted;
    // Mute state will be applied to new audio service instances
  }
}

export const audioStateManager = new AudioStateManager();