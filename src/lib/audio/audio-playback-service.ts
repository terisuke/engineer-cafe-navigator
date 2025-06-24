/**
 * Unified Audio Playback Service - Web Audio API Only
 * 
 * Provides a simplified, high-performance audio playback service
 * optimized for Web Audio API with optional lip-sync support.
 * 
 * @author Engineer Cafe Navigator Team
 * @since 2025-06-24
 */

import { AudioDataProcessor } from './audio-data-processor';
import {
  AudioError,
  AudioErrorType,
  type AudioDataInput,
  type AudioOperationResult
} from './audio-interfaces';
import { MobileAudioService } from './mobile-audio-service';

export interface AudioPlaybackOptions {
  volume?: number;
  enableLipSync?: boolean;
  onVisemeUpdate?: (viseme: string, intensity: number) => void;
  onPlaybackEnd?: () => void;
  onError?: (error: AudioError) => void;
}

export interface LipSyncData {
  frames: Array<{
    time: number;
    mouthShape: 'A' | 'I' | 'U' | 'E' | 'O' | 'Closed';
    mouthOpen: number;
    volume: number;
  }>;
  duration: number;
}

/**
 * Unified Audio Playback Service
 * 
 * This service provides a single interface for all audio playback needs
 * with Web Audio API optimization and optional lip-sync support.
 */
export class AudioPlaybackService {
  
  /**
   * Play audio with optional lip-sync animation
   * 
   * This method provides comprehensive audio playback with the option to include
   * real-time lip-sync animation. It uses Web Audio API exclusively for
   * maximum performance and compatibility.
   * 
   * @param audioData - Base64, ArrayBuffer, or Blob audio data
   * @param options - Configuration options for playback
   * @returns Promise that resolves with operation result
   * 
   * @example
   * ```typescript
   * await AudioPlaybackService.playAudioWithLipSync(audioData, {
   *   volume: 0.8,
   *   enableLipSync: true,
   *   onVisemeUpdate: (viseme, intensity) => {
   *     updateCharacterMouth(viseme, intensity);
   *   }
   * });
   * ```
   */
  static async playAudioWithLipSync(
    audioData: AudioDataInput,
    options: AudioPlaybackOptions
  ): Promise<AudioOperationResult> {
    try {

      // Keep track of playback state for lip-sync
      let playbackStartTime = 0;
      let isPlaying = false;

      // Perform lip-sync analysis if enabled
      let lipSyncData: LipSyncData | null = null;
      
      if (options.enableLipSync && options.onVisemeUpdate && typeof audioData === 'string') {
        try {
          // Convert base64 to blob for lip-sync analysis
          const blobResult = await AudioDataProcessor.base64ToBlob(audioData);
          if (blobResult.success && blobResult.data) {
            const { LipSyncAnalyzer } = await import('@/lib/lip-sync-analyzer');
            const analyzer = new LipSyncAnalyzer();
            
            lipSyncData = await analyzer.analyzeLipSync(blobResult.data);
            analyzer.dispose();
          }
        } catch (lipSyncError) {
          console.warn('[AudioPlaybackService] Lip-sync analysis failed:', lipSyncError);
          // Continue without lip-sync
        }
      }

      // Lip-sync update function
      const updateLipSync = () => {
        if (!isPlaying || !lipSyncData || !options.onVisemeUpdate) {
          return;
        }

        const currentTime = (performance.now() - playbackStartTime) / 1000;
        
        // Find the appropriate frame for current time
        const frame = lipSyncData.frames.find((f, index) => {
          const nextFrame = lipSyncData.frames[index + 1];
          return f.time <= currentTime && (!nextFrame || nextFrame.time > currentTime);
        });

        if (frame) {
          options.onVisemeUpdate(frame.mouthShape, frame.mouthOpen);
        }

        // Continue animation if still playing
        if (isPlaying) {
          requestAnimationFrame(updateLipSync);
        }
      };

      // Create a Promise that resolves when audio playback is complete
      return new Promise<AudioOperationResult>((resolve, reject) => {
        // Guard to ensure the promise is settled only once
        let settled = false;
        const safeResolve = (value: AudioOperationResult) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const safeReject = (error: AudioError) => {
          if (settled) return;
          settled = true;
          reject(error);
        };

        // Create mobile audio service with options (Web Audio API only)
        const audioService = new MobileAudioService({
          volume: options.volume || 0.8,
          onPlay: () => {
            isPlaying = true;
            playbackStartTime = performance.now();
            
            // Start lip-sync animation if available
            if (lipSyncData && options.onVisemeUpdate) {
              updateLipSync();
            }
          },
          onEnded: () => {
            isPlaying = false;
            // Set mouth to closed state
            if (options.onVisemeUpdate) {
              options.onVisemeUpdate('Closed', 0);
            }
            options.onPlaybackEnd?.();
            
            // Resolve the Promise when audio playback ends
            safeResolve({ success: true, method: 'web-audio' });
          },
          onError: (error) => {
            const audioError = error instanceof AudioError
              ? error
              : new AudioError(
                  AudioErrorType.PLAYBACK_FAILED,
                  (error as Error)?.message || 'Audio playback failed'
                );
            console.error('[AudioPlayback] Playback failed:', audioError);
            options.onError?.(audioError);
            safeReject(audioError);
          }
        });
        
        // Start audio playback
        audioService.playAudio(audioData)
          .then((result) => {
            if (!result.success) {
              const audioError = result.error ?? new AudioError(
                AudioErrorType.PLAYBACK_FAILED,
                'Audio playback failed'
              );
              options.onError?.(audioError);
              safeReject(audioError);
              return; // Early exit to prevent further processing
            }
            // Don't resolve here - wait for onEnded callback
          })
          .catch((error) => {
            const audioError = AudioError.fromError(error as Error, AudioErrorType.PLAYBACK_FAILED);
            options.onError?.(audioError);
            safeReject(audioError);
          });
      });
      
    } catch (error) {
      const audioError = AudioError.fromError(error as Error, AudioErrorType.PLAYBACK_FAILED);
      options.onError?.(audioError);
      return { success: false, error: audioError };
    }
  }

  /**
   * Fast audio playback without lip-sync
   * 
   * Optimized for quick audio playback without animation features.
   * 
   * @param audioData - Base64, ArrayBuffer, or Blob audio data
   * @param volume - Volume level (0.0 - 1.0)
   * @returns Promise that resolves with operation result
   */
  static async playAudioFast(
    audioData: AudioDataInput, 
    volume: number = 0.8
  ): Promise<AudioOperationResult> {
    // Create a Promise that resolves when audio playback is complete
    return new Promise<AudioOperationResult>((resolve, reject) => {
      const audioService = new MobileAudioService({
        volume,
        onEnded: () => {
          resolve({ success: true, method: 'web-audio' });
        },
        onError: (error) => {
          reject(error);
        }
      });

      // Start audio playback
      audioService.playAudio(audioData).then((result) => {
        if (!result.success) {
          reject(result.error!);
        }
        // Don't resolve here - wait for onEnded callback
      }).catch((error) => {
        const audioError = AudioError.fromError(error as Error, AudioErrorType.PLAYBACK_FAILED);
        reject(audioError);
      });
    });
  }
}