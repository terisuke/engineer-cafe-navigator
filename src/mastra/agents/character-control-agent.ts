import { Agent } from '@mastra/core/agent';
import { EmotionMapping } from '@/lib/emotion-mapping';
import { LipSyncAnalyzer, LipSyncFrame } from '@/lib/lip-sync-analyzer';
import { LipSyncCache } from '@/lib/lip-sync-cache';

export interface CharacterControlAgentConfig {
  llm: {
    model: any;
  };
}

export interface CharacterControlRequest {
  emotion?: string;
  text?: string;           // For emotion analysis
  audioData?: ArrayBuffer; // For lip sync
  duration?: number;       // Animation duration
  intensity?: number;      // Emotion intensity (0-1)
  agentName?: string;      // Source agent for logging
}

// Using LipSyncFrame from lip-sync-analyzer instead of redefining it

export interface CharacterControlResponse {
  success: boolean;
  expression?: string;
  animation?: string;
  lipSyncData?: LipSyncFrame[];
  emotionIntensity?: number;
  error?: string;
}

export class CharacterControlAgent extends Agent {
  private lipSyncAnalyzer: LipSyncAnalyzer;
  private lipSyncCache: LipSyncCache;
  private currentExpression: string = 'neutral';
  private currentAnimation: string = 'idle';

  constructor(config: CharacterControlAgentConfig) {
    super({
      name: 'CharacterControlAgent',
      model: config.llm.model,
      instructions: `You are a character control specialist responsible for managing 3D character expressions, animations, and lip sync.
        Your main responsibilities are:
        1. Map emotions to appropriate character expressions
        2. Select suitable animations for different states
        3. Generate lip sync data from audio
        4. Ensure smooth transitions between states`,
    });

    this.lipSyncAnalyzer = new LipSyncAnalyzer();
    this.lipSyncCache = new LipSyncCache();
  }

  /**
   * Process character control request
   */
  async processCharacterControl(request: CharacterControlRequest): Promise<CharacterControlResponse> {
    try {
      console.log(`[CharacterControlAgent] Processing request from ${request.agentName || 'unknown'}`);
      
      // 1. Determine expression from emotion
      const expression = this.getExpressionFromEmotion(request.emotion || 'neutral', request.intensity);
      
      // 2. Select appropriate animation
      const animation = this.getAnimationForEmotion(request.emotion || 'neutral');
      
      // 3. Generate lip sync data if audio is provided
      let lipSyncData: LipSyncFrame[] | undefined;
      if (request.audioData) {
        lipSyncData = await this.generateLipSyncData(request.audioData);
      }
      
      // 4. Update current state
      this.currentExpression = expression;
      this.currentAnimation = animation;
      
      return {
        success: true,
        expression,
        animation,
        lipSyncData,
        emotionIntensity: request.intensity || EmotionMapping.getIntensityForEmotion(request.emotion || 'neutral')
      };
      
    } catch (error) {
      console.error('[CharacterControlAgent] Error in character control:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        // Return current state as fallback
        expression: this.currentExpression,
        animation: this.currentAnimation
      };
    }
  }

  /**
   * Map emotion to character expression
   */
  private getExpressionFromEmotion(emotion: string, intensity?: number): string {
    // Use EmotionMapping for consistent mapping
    const mappedEmotion = EmotionMapping.mapToVRMEmotion(emotion);
    
    // Apply intensity if provided
    if (intensity !== undefined && intensity < 0.3) {
      // Low intensity emotions default to neutral
      return 'neutral';
    }
    
    return mappedEmotion;
  }

  /**
   * Get animation for emotion
   */
  private getAnimationForEmotion(emotion: string): string {
    return EmotionMapping.getAnimationForEmotion(emotion);
  }

  /**
   * Generate lip sync data from audio
   */
  private async generateLipSyncData(audioData: ArrayBuffer): Promise<LipSyncFrame[]> {
    try {
      // Robust server environment detection for Next.js compatibility
      const isServerEnvironment = typeof window === 'undefined' || 
                                 (typeof process !== 'undefined' && process.versions && process.versions.node);
      
      if (isServerEnvironment) {
        console.log('[CharacterControlAgent] Server environment detected, using fallback lip sync');
        return this.generateFallbackLipSync(audioData.byteLength);
      }
      
      // Convert ArrayBuffer to Blob for the analyzer
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      
      // Check cache first
      const cachedData = await this.lipSyncCache.getCachedLipSync(audioBlob);
      
      if (cachedData) {
        console.log('[CharacterControlAgent] Using cached lip sync data');
        return cachedData.frames;
      }
      
      // Analyze audio for lip sync
      console.log('[CharacterControlAgent] Analyzing audio for lip sync...');
      const lipSyncData = await this.lipSyncAnalyzer.analyzeLipSync(audioBlob);
      
      // Cache the result
      await this.lipSyncCache.cacheLipSync(audioBlob, lipSyncData);
      
      return lipSyncData.frames;
      
    } catch (error) {
      console.error('[CharacterControlAgent] Lip sync analysis failed:', error);
      // Return neutral mouth shape as fallback
      return this.generateFallbackLipSync(audioData.byteLength);
    }
  }

  /**
   * Generate fallback lip sync for when analysis fails
   */
  private generateFallbackLipSync(audioByteLength: number): LipSyncFrame[] {
    // Estimate duration from audio size (rough approximation)
    const estimatedDuration = audioByteLength / (16000 * 2); // 16kHz, 16-bit audio
    const frames: LipSyncFrame[] = [];
    const frameInterval = 50; // 50ms intervals
    
    for (let time = 0; time < estimatedDuration * 1000; time += frameInterval) {
      // Simple alternating pattern
      const mouthShape = (Math.floor(time / 200) % 2) === 0 ? 'A' : 'Closed';
      frames.push({
        time,
        volume: 0.5,
        mouthOpen: 0.5,
        mouthShape: mouthShape as 'A' | 'I' | 'U' | 'E' | 'O' | 'Closed'
      });
    }
    
    return frames;
  }

  /**
   * Handle emotion transitions
   */
  async transitionEmotion(fromEmotion: string, toEmotion: string, duration: number = 300): Promise<CharacterControlResponse> {
    // Smooth transition between emotions
    const fromExpression = this.getExpressionFromEmotion(fromEmotion);
    const toExpression = this.getExpressionFromEmotion(toEmotion);
    
    if (fromExpression === toExpression) {
      // No transition needed
      return {
        success: true,
        expression: toExpression,
        animation: this.currentAnimation
      };
    }
    
    // Return transition information
    return {
      success: true,
      expression: toExpression,
      animation: this.getAnimationForEmotion(toEmotion),
      emotionIntensity: EmotionMapping.getIntensityForEmotion(toEmotion)
    };
  }

  /**
   * Reset character to default state
   */
  async resetToDefault(): Promise<CharacterControlResponse> {
    this.currentExpression = 'neutral';
    this.currentAnimation = 'idle';
    
    return {
      success: true,
      expression: 'neutral',
      animation: 'idle',
      emotionIntensity: 1.0
    };
  }

  /**
   * Get current character state
   */
  getCurrentState(): {
    expression: string;
    animation: string;
  } {
    return {
      expression: this.currentExpression,
      animation: this.currentAnimation
    };
  }

  /**
   * Handle real-time updates (for streaming)
   */
  async *streamCharacterUpdates(
    emotionStream: AsyncIterable<string>,
    audioStream?: AsyncIterable<ArrayBuffer>
  ): AsyncGenerator<CharacterControlResponse> {
    let lastEmotion = this.currentExpression;
    
    for await (const emotion of emotionStream) {
      if (emotion !== lastEmotion) {
        // Emotion changed, update character
        const response = await this.transitionEmotion(lastEmotion, emotion);
        lastEmotion = emotion;
        yield response;
      }
    }
    
    // Process audio stream if provided
    if (audioStream) {
      for await (const audioChunk of audioStream) {
        const lipSyncData = await this.generateLipSyncData(audioChunk);
        yield {
          success: true,
          lipSyncData
        };
      }
    }
  }
}