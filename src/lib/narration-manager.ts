import { SupportedLanguage, NarrationConfig, SlideNarration } from '@/mastra/types/config';

export interface NarrationState {
  currentSlide: number;
  isPlaying: boolean;
  autoPlay: boolean;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
}

export interface NarrationEvent {
  type: 'start' | 'end' | 'slide-change' | 'pause' | 'resume' | 'error';
  slideNumber?: number;
  message?: string;
  error?: Error;
}

export class NarrationManager {
  private narrationData: NarrationConfig | null = null;
  private currentState: NarrationState = {
    currentSlide: 1,
    isPlaying: false,
    autoPlay: false,
    playbackSpeed: 1.0,
    volume: 1.0,
    isMuted: false,
  };
  private eventListeners: Array<(event: NarrationEvent) => void> = [];
  private currentAudio: HTMLAudioElement | null = null;
  private autoPlayTimer: NodeJS.Timeout | null = null;

  constructor(
    private voiceService?: any,
    private characterController?: any
  ) {}

  // Event management
  addEventListener(listener: (event: NarrationEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: NarrationEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emit(event: NarrationEvent): void {
    this.eventListeners.forEach(listener => listener(event));
  }

  // Narration data management
  async loadNarration(narrationData: NarrationConfig): Promise<void> {
    try {
      this.validateNarrationData(narrationData);
      this.narrationData = narrationData;
      this.resetState();
      this.emit({ type: 'start' });
    } catch (error) {
      this.emit({ 
        type: 'error', 
        error: error instanceof Error ? error : new Error('Failed to load narration')
      });
      throw error;
    }
  }

  private validateNarrationData(data: NarrationConfig): void {
    if (!data.metadata) {
      throw new Error('Narration data missing metadata');
    }

    if (!data.slides || !Array.isArray(data.slides)) {
      throw new Error('Narration data missing slides array');
    }

    // Validate each slide
    data.slides.forEach((slide, index) => {
      if (typeof slide.slideNumber !== 'number') {
        throw new Error(`Slide ${index} missing valid slideNumber`);
      }

      if (!slide.narration || !slide.narration.auto) {
        throw new Error(`Slide ${slide.slideNumber} missing narration.auto`);
      }
    });
  }

  // Playback control
  async play(slideNumber?: number): Promise<void> {
    if (!this.narrationData) {
      throw new Error('No narration data loaded');
    }

    const targetSlide = slideNumber || this.currentState.currentSlide;
    const slideData = this.findSlideData(targetSlide);

    if (!slideData) {
      throw new Error(`Slide ${targetSlide} not found in narration data`);
    }

    try {
      // Stop any current playback
      this.stop();

      // Update state
      this.currentState.currentSlide = targetSlide;
      this.currentState.isPlaying = true;

      // Get narration text
      const narrationText = slideData.narration.auto;

      // Generate speech
      const audioBuffer = await this.generateSpeech(narrationText);

      // Play audio
      await this.playAudio(audioBuffer);

      // Update character if available
      if (this.characterController) {
        await this.updateCharacterForSlide(slideData);
      }

      // Setup auto-advance if enabled
      if (this.currentState.autoPlay) {
        this.scheduleNextSlide();
      }

      this.emit({ type: 'slide-change', slideNumber: targetSlide });
    } catch (error) {
      this.currentState.isPlaying = false;
      this.emit({ 
        type: 'error', 
        error: error instanceof Error ? error : new Error('Playback failed')
      });
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }

    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }

    this.currentState.isPlaying = false;
    this.emit({ type: 'pause' });
  }

  async resume(): Promise<void> {
    if (this.currentAudio) {
      await this.currentAudio.play();
      this.currentState.isPlaying = true;

      if (this.currentState.autoPlay) {
        this.scheduleNextSlide();
      }

      this.emit({ type: 'resume' });
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }

    this.currentState.isPlaying = false;
  }

  // Navigation
  async nextSlide(): Promise<void> {
    if (!this.narrationData) return;

    const nextSlideNumber = this.currentState.currentSlide + 1;
    const maxSlides = this.narrationData.slides.length;

    if (nextSlideNumber <= maxSlides) {
      await this.play(nextSlideNumber);
    } else {
      this.stop();
      this.emit({ type: 'end' });
    }
  }

  async previousSlide(): Promise<void> {
    if (!this.narrationData) return;

    const prevSlideNumber = this.currentState.currentSlide - 1;

    if (prevSlideNumber >= 1) {
      await this.play(prevSlideNumber);
    }
  }

  async goToSlide(slideNumber: number): Promise<void> {
    if (!this.narrationData) return;

    const maxSlides = this.narrationData.slides.length;
    if (slideNumber >= 1 && slideNumber <= maxSlides) {
      await this.play(slideNumber);
    } else {
      throw new Error(`Invalid slide number: ${slideNumber}`);
    }
  }

  // Settings
  setVolume(volume: number): void {
    this.currentState.volume = Math.max(0, Math.min(1, volume));
    
    if (this.currentAudio) {
      this.currentAudio.volume = this.currentState.isMuted ? 0 : this.currentState.volume;
    }
  }

  setMuted(muted: boolean): void {
    this.currentState.isMuted = muted;
    
    if (this.currentAudio) {
      this.currentAudio.volume = muted ? 0 : this.currentState.volume;
    }
  }

  setPlaybackSpeed(speed: number): void {
    this.currentState.playbackSpeed = Math.max(0.25, Math.min(4, speed));
    
    if (this.currentAudio) {
      this.currentAudio.playbackRate = this.currentState.playbackSpeed;
    }
  }

  setAutoPlay(enabled: boolean): void {
    this.currentState.autoPlay = enabled;

    if (!enabled && this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    } else if (enabled && this.currentState.isPlaying) {
      this.scheduleNextSlide();
    }
  }

  // State access
  getState(): NarrationState {
    return { ...this.currentState };
  }

  getNarrationData(): NarrationConfig | null {
    return this.narrationData;
  }

  getCurrentSlideData(): SlideNarration | null {
    return this.findSlideData(this.currentState.currentSlide);
  }

  // Question handling
  async answerQuestion(question: string): Promise<string> {
    if (!this.narrationData) {
      throw new Error('No narration data loaded');
    }

    const currentSlideData = this.getCurrentSlideData();
    if (!currentSlideData) {
      throw new Error('Current slide data not found');
    }

    // Check for predefined answers
    const onDemandAnswers = currentSlideData.narration.onDemand;
    
    // Simple keyword matching
    const questionLower = question.toLowerCase();
    for (const [keyword, answer] of Object.entries(onDemandAnswers)) {
      if (questionLower.includes(keyword.toLowerCase())) {
        // Generate speech for the answer
        if (this.voiceService) {
          const audioBuffer = await this.generateSpeech(answer);
          await this.playAudio(audioBuffer);
        }
        return answer;
      }
    }

    // No predefined answer found
    throw new Error('No answer found for the question');
  }

  // Utility methods
  private findSlideData(slideNumber: number): SlideNarration | null {
    if (!this.narrationData) return null;
    
    return this.narrationData.slides.find(slide => slide.slideNumber === slideNumber) || null;
  }

  private async generateSpeech(text: string): Promise<ArrayBuffer> {
    if (!this.voiceService) {
      throw new Error('Voice service not available');
    }

    const language = this.narrationData?.metadata.language || 'ja';
    const speaker = this.narrationData?.metadata.speaker;

    return await this.voiceService.textToSpeech(text, {
      language: language as SupportedLanguage,
      speaker,
      speed: this.currentState.playbackSpeed,
    });
  }

  private async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        
        this.currentAudio = new Audio(audioUrl);
        this.currentAudio.volume = this.currentState.isMuted ? 0 : this.currentState.volume;
        this.currentAudio.playbackRate = this.currentState.playbackSpeed;

        this.currentAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          this.currentState.isPlaying = false;

          if (this.currentState.autoPlay) {
            this.nextSlide();
          }

          resolve();
        };

        this.currentAudio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          this.currentState.isPlaying = false;
          reject(new Error('Audio playback failed'));
        };

        this.currentAudio.play();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async updateCharacterForSlide(slideData: SlideNarration): Promise<void> {
    if (!this.characterController) return;

    // Determine appropriate character action based on slide content
    const narrationText = slideData.narration.auto.toLowerCase();
    let animation = 'neutral';
    let expression = 'neutral';

    if (narrationText.includes('welcome') || narrationText.includes('ようこそ')) {
      animation = 'greeting';
      expression = 'happy';
    } else if (narrationText.includes('explain') || narrationText.includes('説明')) {
      animation = 'explaining';
      expression = 'neutral';
    } else if (narrationText.includes('question') || narrationText.includes('質問')) {
      animation = 'thinking';
      expression = 'thinking';
    } else {
      animation = 'presenting';
      expression = 'neutral';
    }

    try {
      await this.characterController.execute({
        action: 'setExpression',
        expression,
        transition: true,
      });

      await this.characterController.execute({
        action: 'playAnimation',
        animation,
        transition: true,
      });
    } catch (error) {
      console.warn('Failed to update character:', error);
    }
  }

  private scheduleNextSlide(): void {
    if (!this.currentState.autoPlay || !this.currentAudio) return;

    // Calculate time remaining for current audio
    const audioRemaining = this.currentAudio.duration - this.currentAudio.currentTime;
    const delayMs = (audioRemaining * 1000) + 2000; // Add 2 second pause

    this.autoPlayTimer = setTimeout(() => {
      this.nextSlide();
    }, delayMs);
  }

  private resetState(): void {
    this.stop();
    this.currentState = {
      currentSlide: 1,
      isPlaying: false,
      autoPlay: this.currentState.autoPlay,
      playbackSpeed: this.currentState.playbackSpeed,
      volume: this.currentState.volume,
      isMuted: this.currentState.isMuted,
    };
  }

  // Cleanup
  destroy(): void {
    this.stop();
    this.eventListeners = [];
    this.narrationData = null;
  }
}

// Utility functions for narration processing
export class NarrationUtils {
  static async loadNarrationFile(filePath: string): Promise<NarrationConfig> {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load narration file: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Error loading narration file: ${error}`);
    }
  }

  static validateNarrationFile(narration: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check metadata
    if (!narration.metadata) {
      errors.push('Missing metadata');
    } else {
      if (!narration.metadata.title) errors.push('Missing metadata.title');
      if (!narration.metadata.language) errors.push('Missing metadata.language');
      if (!narration.metadata.speaker) errors.push('Missing metadata.speaker');
    }

    // Check slides
    if (!Array.isArray(narration.slides)) {
      errors.push('Slides must be an array');
    } else {
      narration.slides.forEach((slide: any, index: number) => {
        if (typeof slide.slideNumber !== 'number') {
          errors.push(`Slide ${index}: invalid slideNumber`);
        }
        if (!slide.narration || !slide.narration.auto) {
          errors.push(`Slide ${index}: missing narration.auto`);
        }
        if (!slide.transitions) {
          errors.push(`Slide ${index}: missing transitions`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static createEmptyNarration(
    title: string,
    language: SupportedLanguage,
    slideCount: number
  ): NarrationConfig {
    const slides: SlideNarration[] = Array.from({ length: slideCount }, (_, index) => ({
      slideNumber: index + 1,
      narration: {
        auto: `Slide ${index + 1} narration`,
        onEnter: `Entering slide ${index + 1}`,
        onDemand: {
          'more info': `Additional information for slide ${index + 1}`,
          'details': `Detailed explanation of slide ${index + 1}`,
        },
      },
      transitions: {
        next: index < slideCount - 1 ? `Moving to slide ${index + 2}` : null,
        previous: index > 0 ? `Going back to slide ${index}` : null,
      },
    }));

    return {
      metadata: {
        title,
        language,
        speaker: language === 'ja' ? 'ja-JP-Neural2-B' : 'en-US-Neural2-F',
        version: '1.0',
      },
      slides,
    };
  }

  static mergeNarrations(
    primary: NarrationConfig,
    secondary: NarrationConfig
  ): NarrationConfig {
    const merged: NarrationConfig = {
      metadata: { ...primary.metadata },
      slides: [...primary.slides],
    };

    // Merge slide data
    secondary.slides.forEach(secondarySlide => {
      const primarySlideIndex = merged.slides.findIndex(
        slide => slide.slideNumber === secondarySlide.slideNumber
      );

      if (primarySlideIndex !== -1) {
        // Merge existing slide
        const primarySlide = merged.slides[primarySlideIndex];
        merged.slides[primarySlideIndex] = {
          ...primarySlide,
          narration: {
            ...primarySlide.narration,
            ...secondarySlide.narration,
            onDemand: {
              ...primarySlide.narration.onDemand,
              ...secondarySlide.narration.onDemand,
            },
          },
          transitions: {
            ...primarySlide.transitions,
            ...secondarySlide.transitions,
          },
        };
      } else {
        // Add new slide
        merged.slides.push(secondarySlide);
      }
    });

    // Sort slides by slide number
    merged.slides.sort((a, b) => a.slideNumber - b.slideNumber);

    return merged;
  }

  static exportNarrationToJson(narration: NarrationConfig): string {
    return JSON.stringify(narration, null, 2);
  }

  static calculateDuration(narration: NarrationConfig, wordsPerMinute: number = 150): number {
    let totalWords = 0;

    narration.slides.forEach(slide => {
      const text = slide.narration.auto;
      const words = text.split(/\s+/).length;
      totalWords += words;
    });

    return totalWords / wordsPerMinute; // Duration in minutes
  }

  static extractKeywords(narration: NarrationConfig): string[] {
    const keywords = new Set<string>();

    narration.slides.forEach(slide => {
      Object.keys(slide.narration.onDemand).forEach(keyword => {
        keywords.add(keyword.toLowerCase());
      });
    });

    return Array.from(keywords);
  }

  static generateTranscript(narration: NarrationConfig): string {
    let transcript = `# ${narration.metadata.title}\n\n`;
    transcript += `Language: ${narration.metadata.language}\n`;
    transcript += `Speaker: ${narration.metadata.speaker}\n\n`;

    narration.slides.forEach(slide => {
      transcript += `## Slide ${slide.slideNumber}\n\n`;
      transcript += `${slide.narration.auto}\n\n`;
    });

    return transcript;
  }
}

// Types for narration events
export interface NarrationProgress {
  currentSlide: number;
  totalSlides: number;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  progress: number; // 0-1
}

export interface NarrationConfig {
  metadata: {
    title: string;
    language: string;
    speaker: string;
    version: string;
  };
  slides: SlideNarration[];
}

export interface SlideNarration {
  slideNumber: number;
  narration: {
    auto: string;
    onEnter: string;
    onDemand: Record<string, string>;
  };
  transitions: {
    next: string | null;
    previous: string | null;
  };
}
