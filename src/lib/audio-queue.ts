/**
 * Audio queue system for smooth streaming playback
 */

export interface AudioQueueItem {
  id: string;
  audioData: string; // base64
  text: string;
  index: number;
  isLast: boolean;
  emotion?: string;
}

export interface AudioQueueCallbacks {
  onChunkStart?: (item: AudioQueueItem) => void;
  onChunkEnd?: (item: AudioQueueItem) => void;
  onQueueEmpty?: () => void;
  onError?: (error: Error, item: AudioQueueItem) => void;
}

export class AudioQueue {
  private queue: AudioQueueItem[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private callbacks: AudioQueueCallbacks;
  private volume: number = 1.0;
  private isStopped = false;

  constructor(callbacks: AudioQueueCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Add audio chunk to queue
   */
  enqueue(item: AudioQueueItem): void {
    if (this.isStopped) return;
    
    this.queue.push(item);
    
    // Start playing if not already playing
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  /**
   * Play next audio in queue
   */
  private async playNext(): Promise<void> {
    if (this.isStopped || this.queue.length === 0) {
      this.isPlaying = false;
      this.callbacks.onQueueEmpty?.();
      return;
    }

    this.isPlaying = true;
    const item = this.queue.shift()!;

    try {
      // Notify chunk start
      this.callbacks.onChunkStart?.(item);

      // Create audio element
      const audioData = Uint8Array.from(atob(item.audioData), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audio.volume = this.volume;
      this.currentAudio = audio;

      // Setup event handlers
      const playPromise = new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          this.callbacks.onChunkEnd?.(item);
          resolve();
        };

        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          reject(new Error(`Audio playback error: ${error}`));
        };
      });

      // Play audio
      await audio.play();
      await playPromise;

      // Add small gap between chunks for natural speech
      if (!item.isLast && this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Play next chunk
      this.playNext();
    } catch (error) {
      console.error('Audio queue playback error:', error);
      this.callbacks.onError?.(error as Error, item);
      
      // Continue with next item
      this.playNext();
    }
  }

  /**
   * Stop all playback and clear queue
   */
  stop(): void {
    this.isStopped = true;
    this.queue = [];
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    this.isPlaying = false;
  }

  /**
   * Pause current playback
   */
  pause(): void {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  /**
   * Get queue status
   */
  getStatus(): { isPlaying: boolean; queueLength: number; isStopped: boolean } {
    return {
      isPlaying: this.isPlaying,
      queueLength: this.queue.length,
      isStopped: this.isStopped
    };
  }

  /**
   * Reset the queue for reuse
   */
  reset(): void {
    this.stop();
    this.isStopped = false;
  }
}