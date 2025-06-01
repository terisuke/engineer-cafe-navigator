import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { SupportedLanguage, SlideNarration } from '../types/config';

export class SlideNarrator extends Agent {
  private currentSlide: number = 1;
  private totalSlides: number = 0;
  private autoPlay: boolean = false;
  private narrationData: any = null;
  private memory: any;
  private _tools: Map<string, any> = new Map();

  constructor(config: any) {
    super({
      name: 'SlideNarrator',
      model: config.llm.model,
      instructions: `You are a slide narration agent for Engineer Cafe presentations.
        Your role is to:
        1. Provide scripted narration for each slide
        2. Handle slide navigation commands
        3. Answer questions about slide content
        4. Maintain presentation flow and timing
        5. Coordinate with slide display and character animation
        
        Deliver narrations in a clear, engaging manner.
        Respond to navigation commands promptly.
        Provide informative answers to content questions.`,
    });
    
    // Initialize memory
    this.memory = config.memory || new Map();
  }

  // Method to add tools to this agent
  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }

  async loadNarration(slideFile: string, language: SupportedLanguage): Promise<void> {
    try {
      // Load narration JSON for the specified language
      const narrationLoader = this._tools.get('narrationLoader');
      const result = await narrationLoader.execute({
        slideFile,
        language,
        action: 'load'
      });
      
      if (!result.success || !result.narrationData) {
        throw new Error(`Failed to load narration: ${result.error}`);
      }
      
      this.narrationData = result.narrationData;
      this.totalSlides = this.narrationData.slides.length;
      this.currentSlide = 1;
      
      // Store in memory if available
      if (this.memory && typeof this.memory.store === 'function') {
        await this.memory.store('currentSlide', this.currentSlide);
        await this.memory.store('totalSlides', this.totalSlides);
        await this.memory.store('narrationData', this.narrationData);
      } else if (this.memory instanceof Map) {
        this.memory.set('currentSlide', this.currentSlide);
        this.memory.set('totalSlides', this.totalSlides);
        this.memory.set('narrationData', this.narrationData);
      }
      
    } catch (error) {
      console.error('Failed to load narration:', error);
      throw error;
    }
  }

  async narrateSlide(slideNumber?: number): Promise<{
    narration: string;
    slideNumber: number;
    audioBuffer: ArrayBuffer;
    characterAction: string;
  }> {
    const targetSlide = slideNumber || this.currentSlide;
    
    if (!this.narrationData || targetSlide < 1 || targetSlide > this.totalSlides) {
      throw new Error(`Invalid slide number: ${targetSlide}`);
    }

    const slideData = this.narrationData.slides.find((s: any) => s.slideNumber === targetSlide);
    if (!slideData) {
      throw new Error(`No narration data for slide ${targetSlide}`);
    }

    const narration = slideData.narration.auto;
    
    // Convert narration to speech
    const voiceService = this._tools.get('voiceService');
    // Get language from memory
    let language: SupportedLanguage = 'ja';
    if (this.memory && typeof this.memory.get === 'function') {
      language = await this.memory.get('language') as SupportedLanguage || 'ja';
    } else if (this.memory instanceof Map) {
      language = this.memory.get('language') as SupportedLanguage || 'ja';
    }
    const ttsResult = await voiceService.textToSpeech(narration, language);
    
    if (!ttsResult.success || !ttsResult.audioBase64) {
      throw new Error(`Text-to-Speech failed: ${ttsResult.error}`);
    }
    
    // Convert base64 to ArrayBuffer
    const buffer = Buffer.from(ttsResult.audioBase64, 'base64');
    const audioBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    // Update current slide
    this.currentSlide = targetSlide;
    // Store current slide in memory
    if (this.memory && typeof this.memory.store === 'function') {
      await this.memory.store('currentSlide', this.currentSlide);
    } else if (this.memory instanceof Map) {
      this.memory.set('currentSlide', this.currentSlide);
    }
    
    // Determine character action based on slide content
    const characterAction = this.determineCharacterAction(slideData);
    
    return {
      narration,
      slideNumber: targetSlide,
      audioBuffer,
      characterAction,
    };
  }

  async nextSlide(): Promise<{
    success: boolean;
    narration?: string;
    slideNumber?: number;
    audioBuffer?: ArrayBuffer;
    characterAction?: string;
    transitionMessage?: string;
  }> {
    if (this.currentSlide >= this.totalSlides) {
      // Get language from memory
      let language: SupportedLanguage = 'ja';
      if (this.memory && typeof this.memory.get === 'function') {
        language = await this.memory.get('language') as SupportedLanguage || 'ja';
      } else if (this.memory instanceof Map) {
        language = this.memory.get('language') as SupportedLanguage || 'ja';
      }
      const message = language === 'en' 
        ? "This is the last slide. Would you like to go back to the beginning or ask any questions?"
        : "最後のスライドです。最初に戻りますか、それとも何かご質問はございますか？";
      
      return { 
        success: false, 
        transitionMessage: message 
      };
    }

    const slideData = this.narrationData.slides.find((s: any) => s.slideNumber === this.currentSlide);
    const transitionMessage = slideData?.transitions?.next;
    
    // Move to next slide
    this.currentSlide++;
    const result = await this.narrateSlide(this.currentSlide);
    
    return {
      success: true,
      narration: result.narration,
      slideNumber: result.slideNumber,
      audioBuffer: result.audioBuffer,
      characterAction: result.characterAction,
      transitionMessage,
    };
  }

  async previousSlide(): Promise<{
    success: boolean;
    narration?: string;
    slideNumber?: number;
    audioBuffer?: ArrayBuffer;
    characterAction?: string;
    transitionMessage?: string;
  }> {
    if (this.currentSlide <= 1) {
      // Get language from memory
      let language: SupportedLanguage = 'ja';
      if (this.memory && typeof this.memory.get === 'function') {
        language = await this.memory.get('language') as SupportedLanguage || 'ja';
      } else if (this.memory instanceof Map) {
        language = this.memory.get('language') as SupportedLanguage || 'ja';
      }
      const message = language === 'en' 
        ? "This is the first slide. Would you like to continue forward?"
        : "最初のスライドです。先に進みますか？";
      
      return { 
        success: false, 
        transitionMessage: message 
      };
    }

    const slideData = this.narrationData.slides.find((s: any) => s.slideNumber === this.currentSlide);
    const transitionMessage = slideData?.transitions?.previous;
    
    // Move to previous slide
    this.currentSlide--;
    const result = await this.narrateSlide(this.currentSlide);
    
    return {
      success: true,
      narration: result.narration,
      slideNumber: result.slideNumber,
      audioBuffer: result.audioBuffer,
      characterAction: result.characterAction,
      transitionMessage,
    };
  }

  async gotoSlide(slideNumber: number): Promise<{
    success: boolean;
    narration?: string;
    slideNumber?: number;
    audioBuffer?: ArrayBuffer;
    characterAction?: string;
  }> {
    if (slideNumber < 1 || slideNumber > this.totalSlides) {
      return { success: false };
    }

    const result = await this.narrateSlide(slideNumber);
    return {
      success: true,
      narration: result.narration,
      slideNumber: result.slideNumber,
      audioBuffer: result.audioBuffer,
      characterAction: result.characterAction,
    };
  }

  async answerSlideQuestion(question: string): Promise<string> {
    if (!this.narrationData) {
      throw new Error('No narration data loaded');
    }

    const currentSlideData = this.narrationData.slides.find((s: any) => s.slideNumber === this.currentSlide);
    // Get language from memory
    let language: SupportedLanguage = 'ja';
    if (this.memory && typeof this.memory.get === 'function') {
      language = await this.memory.get('language') as SupportedLanguage || 'ja';
    } else if (this.memory instanceof Map) {
      language = this.memory.get('language') as SupportedLanguage || 'ja';
    }
    
    // Check if there's a predefined answer for this question
    if (currentSlideData?.narration?.onDemand) {
      const keywords = Object.keys(currentSlideData.narration.onDemand);
      const matchingKeyword = keywords.find(keyword => 
        question.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (matchingKeyword) {
        return currentSlideData.narration.onDemand[matchingKeyword];
      }
    }

    // Generate dynamic response based on slide content
    const slideContext = currentSlideData ? JSON.stringify(currentSlideData) : '';
    const prompt = language === 'en'
      ? `Answer this question about slide ${this.currentSlide}: ${question}\nSlide context: ${slideContext}`
      : `スライド${this.currentSlide}について以下の質問に答えてください: ${question}\nスライドの内容: ${slideContext}`;
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    return response.text;
  }

  private determineCharacterAction(slideData: any): string {
    // Determine character action based on slide content
    const narration = slideData.narration.auto.toLowerCase();
    
    if (narration.includes('welcome') || narration.includes('ようこそ')) {
      return 'greeting';
    } else if (narration.includes('service') || narration.includes('サービス')) {
      return 'presenting';
    } else if (narration.includes('price') || narration.includes('料金')) {
      return 'explaining';
    } else if (narration.includes('thank') || narration.includes('ありがとう')) {
      return 'bowing';
    } else {
      return 'neutral';
    }
  }

  async getCurrentSlideInfo(): Promise<{
    currentSlide: number;
    totalSlides: number;
    slideData: any;
  }> {
    const slideData = this.narrationData?.slides?.find((s: any) => s.slideNumber === this.currentSlide);
    
    return {
      currentSlide: this.currentSlide,
      totalSlides: this.totalSlides,
      slideData,
    };
  }

  async setAutoPlay(enabled: boolean, interval?: number): Promise<void> {
    this.autoPlay = enabled;
    // Store autoPlay settings in memory
    if (this.memory && typeof this.memory.store === 'function') {
      await this.memory.store('autoPlay', enabled);
      if (enabled && interval) {
        await this.memory.store('autoPlayInterval', interval);
      }
    } else if (this.memory instanceof Map) {
      this.memory.set('autoPlay', enabled);
      if (enabled && interval) {
        this.memory.set('autoPlayInterval', interval);
      }
    }
  }

  async startAutoPlay(): Promise<void> {
    if (!this.autoPlay) {
      return;
    }

    // Get autoPlay interval from memory
    let interval = 30000; // 30 seconds default
    if (this.memory && typeof this.memory.get === 'function') {
      interval = await this.memory.get('autoPlayInterval') || 30000;
    } else if (this.memory instanceof Map) {
      interval = this.memory.get('autoPlayInterval') || 30000;
    }
    
    // TODO: Implement auto-advance logic with timing
    // This would automatically advance slides after the specified interval
  }

  async stopAutoPlay(): Promise<void> {
    this.autoPlay = false;
    // Store autoPlay setting in memory
    if (this.memory && typeof this.memory.store === 'function') {
      await this.memory.store('autoPlay', false);
    } else if (this.memory instanceof Map) {
      this.memory.set('autoPlay', false);
    }
  }
}
