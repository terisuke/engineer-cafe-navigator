/**
 * Centralized emotion mapping for consistent VRM character expressions
 * This ensures all components use the same emotion mappings
 */

export type SupportedEmotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'curious' | 'relaxed';

export interface EmotionMappingConfig {
  vrm: Record<string, SupportedEmotion>;
  animations: Record<SupportedEmotion, string>;
  intensities: Record<SupportedEmotion, number>;
}

export class EmotionMapping {
  /**
   * Standard VRM emotion mapping
   * Maps various emotion aliases to supported VRM expressions
   */
  private static readonly VRM_EMOTION_MAP: Record<string, SupportedEmotion> = {
    // Basic emotions
    'neutral': 'neutral',
    'calm': 'neutral',
    'normal': 'neutral',
    'explaining': 'neutral',
    'teaching': 'neutral',
    'describing': 'neutral',
    
    'happy': 'happy',
    'joy': 'happy',
    'excited': 'happy',
    'cheerful': 'happy',
    'pleased': 'happy',
    'greeting': 'happy',
    'welcoming': 'happy',
    'confident': 'happy',
    'proud': 'happy',
    'grateful': 'happy',
    'warm': 'happy',
    
    'sad': 'sad',
    'disappointed': 'sad',
    'melancholy': 'sad',
    'down': 'sad',
    'worried': 'sad',
    'embarrassed': 'sad',
    'apologetic': 'sad',
    
    'angry': 'angry',
    'mad': 'angry',
    'frustrated': 'angry',
    'annoyed': 'angry',
    
    'relaxed': 'relaxed',
    'thinking': 'relaxed',
    'pondering': 'relaxed',
    'wondering': 'relaxed',
    'listening': 'relaxed',
    'attentive': 'relaxed',
    'concerned': 'relaxed',
    'shy': 'relaxed',
    'confused': 'relaxed',
    'thoughtful': 'relaxed',
    'supportive': 'relaxed',
    'gentle': 'relaxed',
    
    // Curiosity and questioning
    'curious': 'curious',
    'surprised': 'curious',
    'shocked': 'curious',
    'amazed': 'curious',
    'astonished': 'curious',
    'questioning': 'curious',
    'inquisitive': 'curious',
  };

  /**
   * Animation mapping for each emotion
   */
  private static readonly ANIMATION_MAP: Record<SupportedEmotion, string> = {
    'neutral': 'idle',
    'happy': 'greeting',
    'sad': 'thinking',
    'angry': 'explaining',
    'curious': 'greeting',
    'relaxed': 'thinking',
  };

  /**
   * Default intensity for each emotion
   */
  private static readonly INTENSITY_MAP: Record<SupportedEmotion, number> = {
    'neutral': 1.0,
    'happy': 0.8,
    'sad': 0.7,
    'angry': 0.9,
    'curious': 0.8,
    'relaxed': 0.6,
  };

  /**
   * Map any emotion string to a supported VRM emotion
   */
  static mapToVRMEmotion(emotion: string): SupportedEmotion {
    const normalizedEmotion = emotion.toLowerCase().trim();
    return this.VRM_EMOTION_MAP[normalizedEmotion] || 'neutral';
  }

  /**
   * Get animation for emotion
   */
  static getAnimationForEmotion(emotion: string): string {
    const vrmEmotion = this.mapToVRMEmotion(emotion);
    return this.ANIMATION_MAP[vrmEmotion];
  }

  /**
   * Get default intensity for emotion
   */
  static getIntensityForEmotion(emotion: string): number {
    const vrmEmotion = this.mapToVRMEmotion(emotion);
    return this.INTENSITY_MAP[vrmEmotion];
  }

  /**
   * Check if emotion is supported
   */
  static isSupportedEmotion(emotion: string): boolean {
    return emotion.toLowerCase() in this.VRM_EMOTION_MAP;
  }

  /**
   * Get all supported emotions
   */
  static getSupportedEmotions(): SupportedEmotion[] {
    return ['neutral', 'happy', 'sad', 'angry', 'curious', 'relaxed'];
  }

  /**
   * Get all emotion aliases
   */
  static getAllEmotionAliases(): string[] {
    return Object.keys(this.VRM_EMOTION_MAP);
  }

  /**
   * Get mapping configuration for external use
   */
  static getConfig(): EmotionMappingConfig {
    return {
      vrm: { ...this.VRM_EMOTION_MAP },
      animations: { ...this.ANIMATION_MAP },
      intensities: { ...this.INTENSITY_MAP },
    };
  }

  /**
   * Validate and normalize emotion data
   */
  static normalizeEmotion(emotion: string, intensity?: number): {
    emotion: SupportedEmotion;
    intensity: number;
  } {
    const normalizedEmotion = this.mapToVRMEmotion(emotion);
    const normalizedIntensity = intensity !== undefined 
      ? Math.max(0, Math.min(1, intensity))
      : this.getIntensityForEmotion(emotion);

    return {
      emotion: normalizedEmotion,
      intensity: normalizedIntensity,
    };
  }
}