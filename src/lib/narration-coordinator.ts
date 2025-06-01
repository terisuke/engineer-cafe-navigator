import { audioStateManager } from './audio-state-manager';

export interface SlideNarrationData {
  slideNumber: number;
  text: string;
  audioUrl?: string;
  duration?: number;
  characterAction?: string;
}

export class NarrationCoordinator {
  private currentNarration: SlideNarrationData | null = null;
  
  async narrateSlide(
    narrationData: SlideNarrationData,
    options: {
      onStart?: () => void;
      onComplete?: () => void;
      onCharacterAction?: (action: string) => void;
    } = {}
  ): Promise<void> {
    this.currentNarration = narrationData;
    
    console.log(`[NarrationCoordinator] Starting narration for slide ${narrationData.slideNumber}`);
    
    options.onStart?.();
    
    if (narrationData.characterAction && options.onCharacterAction) {
      options.onCharacterAction(narrationData.characterAction);
    }
    
    let audioUrl: string | null = narrationData.audioUrl || null;
    if (!audioUrl && narrationData.text) {
      audioUrl = await this.generateAudio(narrationData.text);
    }
    
    if (audioUrl) {
      audioStateManager.queueAudio(audioUrl, () => {
        console.log(`[NarrationCoordinator] Completed narration for slide ${narrationData.slideNumber}`);
        options.onComplete?.();
      });
    } else {
      options.onComplete?.();
    }
  }
  
  private async generateAudio(text: string): Promise<string | null> {
    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'text_to_speech',
          text: text,
          language: 'ja',
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.audioResponse) {
        const audioData = Uint8Array.from(atob(result.audioResponse), c => c.charCodeAt(0));
        const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
        return URL.createObjectURL(audioBlob);
      }
    } catch (error) {
      console.error('[NarrationCoordinator] Error generating audio:', error);
    }
    
    return null;
  }
  
  stopNarration(): void {
    console.log('[NarrationCoordinator] Stopping narration');
    audioStateManager.stopAll();
    this.currentNarration = null;
  }
  
  isNarrating(): boolean {
    return audioStateManager.isAudioProcessing();
  }
}

export const narrationCoordinator = new NarrationCoordinator();