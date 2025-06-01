/**
 * Audio Queue for managing sequential audio playback
 * Handles TTS audio streaming and queueing
 */

export interface AudioQueueItem {
  id: string;
  audioData: string; // base64 encoded audio
  text?: string;
  priority?: number;
  emotion?: string;
}

export class AudioQueue {
  private queue: AudioQueueItem[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private volume = 0.8;
  private onFinishedCallback?: () => void;
  private isSkipping = false;

  constructor() {
    // Initialize audio queue
  }

  /**
   * Set callback for when queue finishes playing
   */
  setOnFinished(callback: () => void): void {
    this.onFinishedCallback = callback;
  }

  /**
   * Add audio to the queue
   */
  add(item: AudioQueueItem): void {
    // Sort by priority (higher priority first)
    if (item.priority !== undefined) {
      const insertIndex = this.queue.findIndex(
        queueItem => (queueItem.priority || 0) < (item.priority ?? 0)
      );
      if (insertIndex === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(insertIndex, 0, item);
      }
    } else {
      this.queue.push(item);
    }

    // Start playing if not already playing
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }

  /**
   * Set volume for all audio
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if audio is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Play the next item in the queue
   */
  private async playNext(): Promise<void> {
    // Prevent concurrent playNext calls during skip operations
    if (this.isSkipping) {
      return;
    }
    
    if (this.queue.length === 0) {
      this.isPlaying = false;
      // Call finished callback if set
      if (this.onFinishedCallback) {
        this.onFinishedCallback();
      }
      return;
    }

    // Prevent multiple concurrent playNext calls
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    const item = this.queue.shift()!;

    try {
      await this.playAudio(item);
    } catch (error) {
      console.error('Error playing audio:', error);
    }

    // Continue with next item
    this.isPlaying = false; // Reset before recursive call
    setTimeout(() => {
      this.playNext();
    }, 0);
  }

  /**
   * Play a single audio item
   */
  private async playAudio(item: AudioQueueItem): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Convert base64 to audio blob
        let audioData: Uint8Array;
        try {
          audioData = Uint8Array.from(atob(item.audioData), c => c.charCodeAt(0));
        } catch (error) {
          throw new Error(`Invalid base64 audio data: ${error}`);
        }
        
        const audioBlob = new Blob([audioData.buffer as ArrayBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);
        audio.volume = this.volume;
        this.currentAudio = audio;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          reject(new Error('Audio playback failed'));
        };

        audio.play().catch(error => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Skip the current audio and play next
   */
  skip(): void {
    if (this.currentAudio) {
      this.isSkipping = true;
      this.currentAudio.pause();
      this.currentAudio = null;
      this.isPlaying = false; // Set isPlaying to false immediately after pausing
      
      // Trigger next playback safely using setTimeout to avoid race conditions
      setTimeout(() => {
        this.isSkipping = false;
        if (!this.isPlaying) {
          this.playNext();
        }
      }, 0);
    }
  }

  /**
   * Pause current playback
   */
  pause(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  /**
   * Resume current playback
   */
  resume(): void {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().catch(error => {
        console.error('Error resuming audio:', error);
      });
    }
  }

  /**
   * Get current playing status
   */
  getStatus(): {
    isPlaying: boolean;
    queueSize: number;
    currentItem?: AudioQueueItem;
  } {
    return {
      isPlaying: this.isPlaying,
      queueSize: this.queue.length,
      currentItem: this.queue[0]
    };
  }
}