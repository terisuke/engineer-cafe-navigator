/**
 * Audio Interaction Manager
 * Handles user interaction requirements for audio playback on mobile devices
 */

import { GlobalAudioManager } from './web-audio-player';

export interface AudioInteractionEvents {
  onContextInitialized?: () => void;
  onInteractionRequired?: () => void;
  onError?: (error: Error) => void;
}

export class AudioInteractionManager {
  private static instance: AudioInteractionManager;
  private globalAudioManager: GlobalAudioManager;
  private isContextInitialized = false;
  private pendingInteractionCallbacks: (() => void)[] = [];
  private interactionEventListeners: AudioInteractionEvents = {};
  private hasUserInteracted = false;

  private constructor() {
    this.globalAudioManager = GlobalAudioManager.getInstance();
    this.setupInteractionListeners();
  }

  public static getInstance(): AudioInteractionManager {
    if (!AudioInteractionManager.instance) {
      AudioInteractionManager.instance = new AudioInteractionManager();
    }
    return AudioInteractionManager.instance;
  }

  /**
   * Setup interaction event listeners
   */
  private setupInteractionListeners(): void {
    // List of user interaction events that can unlock audio
    const interactionEvents = [
      'touchstart',
      'touchend',
      'mousedown',
      'mouseup',
      'click',
      'keydown'
    ];

    const handleUserInteraction = async (event: Event) => {
      if (this.hasUserInteracted) return;

      this.hasUserInteracted = true;
      
      try {
        await this.initializeAudioContext();
        
        // Remove event listeners after first interaction
        interactionEvents.forEach(eventType => {
          document.removeEventListener(eventType, handleUserInteraction, { capture: true });
        });
      } catch (error) {
        console.error('Failed to initialize audio context on user interaction:', error);
        this.interactionEventListeners.onError?.(error as Error);
      }
    };

    // Add event listeners with capture phase to catch early
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, handleUserInteraction, { 
        capture: true, 
        passive: true,
        once: false // Don't use once in case first attempt fails
      });
    });
  }

  /**
   * Initialize AudioContext after user interaction
   */
  private async initializeAudioContext(): Promise<void> {
    if (this.isContextInitialized) {
      await this.globalAudioManager.ensureResumed();
      return;
    }

    try {
      await this.globalAudioManager.initialize();
      this.isContextInitialized = true;
      
      // Execute pending callbacks
      const callbacks = [...this.pendingInteractionCallbacks];
      this.pendingInteractionCallbacks = [];
      
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error executing pending audio callback:', error);
        }
      });

      this.interactionEventListeners.onContextInitialized?.();
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      this.interactionEventListeners.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Ensure audio context is ready for playback
   */
  public async ensureAudioContext(): Promise<AudioContext> {
    if (this.isContextInitialized) {
      await this.globalAudioManager.ensureResumed();
      return this.globalAudioManager.getContext()!;
    }

    if (!this.hasUserInteracted) {
      this.interactionEventListeners.onInteractionRequired?.();
      throw new Error('User interaction required for audio playback');
    }

    await this.initializeAudioContext();
    return this.globalAudioManager.getContext()!;
  }

  /**
   * Request user interaction for audio playback
   */
  public async requestUserInteraction(): Promise<AudioContext> {
    return new Promise((resolve, reject) => {
      if (this.isContextInitialized) {
        this.globalAudioManager.ensureResumed().then(() => {
          resolve(this.globalAudioManager.getContext()!);
        }).catch(reject);
        return;
      }

      // Add to pending callbacks
      this.pendingInteractionCallbacks.push(() => {
        const context = this.globalAudioManager.getContext();
        if (context) {
          resolve(context);
        } else {
          reject(new Error('Failed to get AudioContext'));
        }
      });

      // Notify that interaction is required
      this.interactionEventListeners.onInteractionRequired?.();
    });
  }

  /**
   * Execute callback when audio context is ready
   */
  public executeWhenReady(callback: () => void): void {
    if (this.isContextInitialized) {
      callback();
    } else {
      this.pendingInteractionCallbacks.push(callback);
      if (!this.hasUserInteracted) {
        this.interactionEventListeners.onInteractionRequired?.();
      }
    }
  }

  /**
   * Check if audio context is ready
   */
  public isAudioContextReady(): boolean {
    return this.isContextInitialized && this.globalAudioManager.isContextInitialized();
  }

  /**
   * Check if user has interacted
   */
  public hasUserInteraction(): boolean {
    return this.hasUserInteracted;
  }

  /**
   * Get AudioContext state
   */
  public getAudioContextState(): AudioContextState | null {
    const context = this.globalAudioManager.getContext();
    return context?.state || null;
  }

  /**
   * Set event listeners
   */
  public setEventListeners(listeners: AudioInteractionEvents): void {
    this.interactionEventListeners = { ...this.interactionEventListeners, ...listeners };
  }

  /**
   * Force initialize context (use with caution)
   */
  public async forceInitialize(): Promise<AudioContext> {
    this.hasUserInteracted = true;
    await this.initializeAudioContext();
    return this.globalAudioManager.getContext()!;
  }

  /**
   * Reset interaction state (for testing)
   */
  public reset(): void {
    this.hasUserInteracted = false;
    this.isContextInitialized = false;
    this.pendingInteractionCallbacks = [];
    this.globalAudioManager.dispose();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.globalAudioManager.dispose();
    this.pendingInteractionCallbacks = [];
    this.interactionEventListeners = {};
  }
}

/**
 * Hook for React components to handle audio interaction
 */
export const useAudioInteraction = () => {
  const manager = AudioInteractionManager.getInstance();

  const ensureAudioContext = async (): Promise<AudioContext> => {
    return manager.ensureAudioContext();
  };

  const requestUserInteraction = async (): Promise<AudioContext> => {
    return manager.requestUserInteraction();
  };

  const executeWhenReady = (callback: () => void): void => {
    manager.executeWhenReady(callback);
  };

  const isReady = (): boolean => {
    return manager.isAudioContextReady();
  };

  const hasInteraction = (): boolean => {
    return manager.hasUserInteraction();
  };

  const getState = (): AudioContextState | null => {
    return manager.getAudioContextState();
  };

  return {
    ensureAudioContext,
    requestUserInteraction,
    executeWhenReady,
    isReady,
    hasInteraction,
    getState
  };
};