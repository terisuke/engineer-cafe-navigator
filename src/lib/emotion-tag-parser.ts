/**
 * Emotion Tag Parser for VRM character expression control
 * Parses emotion tags like [happy], [sad], [surprised] from AI responses
 */

export interface ParsedResponse {
  cleanText: string;        // Text with emotion tags removed
  emotions: EmotionTag[];   // Array of detected emotion tags
  primaryEmotion?: string;  // The most prominent emotion
}

export interface EmotionTag {
  emotion: string;
  position: number;         // Position in original text
  intensity?: number;       // Optional intensity (0-1)
}

export class EmotionTagParser {
  // Supported emotion tags with VRM expression mapping
  private static readonly EMOTION_MAPPING = {
    // Basic emotions
    'happy': 'happy',
    'joy': 'happy',
    'excited': 'happy',
    'cheerful': 'happy',
    'pleased': 'happy',
    
    'sad': 'sad',
    'disappointed': 'sad',
    'melancholy': 'sad',
    'down': 'sad',
    
    'angry': 'angry',
    'mad': 'angry',
    'frustrated': 'angry',
    'annoyed': 'angry',
    
    'surprised': 'surprised',
    'shocked': 'surprised',
    'amazed': 'surprised',
    'astonished': 'surprised',
    
    'neutral': 'neutral',
    'calm': 'neutral',
    'normal': 'neutral',
    
    // Speaking states
    'thinking': 'thinking',
    'pondering': 'thinking',
    'wondering': 'thinking',
    
    'explaining': 'explaining',
    'teaching': 'explaining',
    'describing': 'explaining',
    
    'greeting': 'greeting',
    'welcoming': 'greeting',
    
    'listening': 'listening',
    'attentive': 'listening',
    
    // Special expressions
    'confused': 'thinking',
    'worried': 'sad',
    'concerned': 'thinking',
    'embarrassed': 'sad',
    'shy': 'neutral',
    'confident': 'happy',
    'proud': 'happy',
    'grateful': 'happy',
    'apologetic': 'sad',
  };

  /**
   * Parse emotion tags from text
   */
  static parseEmotionTags(text: string): ParsedResponse {
    // Regex to match emotion tags: [emotion] or [emotion:intensity]
    const emotionRegex = /\[([a-zA-Z_]+)(?::(\d*\.?\d+))?\]/g;
    const emotions: EmotionTag[] = [];
    let cleanText = text;
    let match;

    // Find all emotion tags
    while ((match = emotionRegex.exec(text)) !== null) {
      const emotion = match[1].toLowerCase();
      const intensityStr = match[2];
      const intensity = intensityStr ? parseFloat(intensityStr) : 1.0;
      const position = match.index;

      // Map to VRM expression if supported
      const mappedEmotion = this.EMOTION_MAPPING[emotion];
      if (mappedEmotion) {
        emotions.push({
          emotion: mappedEmotion,
          position,
          intensity: Math.max(0, Math.min(1, intensity))
        });
      } else {
        console.warn(`Unknown emotion tag: [${emotion}]`);
      }
    }

    // Remove all emotion tags from text
    cleanText = text.replace(emotionRegex, '').trim();
    
    // Remove extra whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    // Determine primary emotion (first valid emotion or most intense)
    let primaryEmotion: string | undefined;
    if (emotions.length > 0) {
      // Use the first emotion, or the one with highest intensity
      const sortedEmotions = emotions.sort((a, b) => (b.intensity || 1) - (a.intensity || 1));
      primaryEmotion = sortedEmotions[0].emotion;
    }

    return {
      cleanText,
      emotions,
      primaryEmotion
    };
  }

  /**
   * Get VRM expression weights for given emotion
   */
  static getExpressionWeights(emotion: string, intensity: number = 1.0): Record<string, number> {
    const weights: Record<string, number> = {
      neutral: 0,
      happy: 0,
      sad: 0,
      angry: 0,
      surprised: 0,
      thinking: 0,
      explaining: 0,
      greeting: 0,
      listening: 0,
    };

    const normalizedIntensity = Math.max(0, Math.min(1, intensity));

    switch (emotion) {
      case 'happy':
        weights.happy = normalizedIntensity;
        weights.neutral = 1 - normalizedIntensity;
        break;
      case 'sad':
        weights.sad = normalizedIntensity;
        weights.neutral = 1 - normalizedIntensity;
        break;
      case 'angry':
        weights.angry = normalizedIntensity;
        weights.neutral = 1 - normalizedIntensity;
        break;
      case 'surprised':
        weights.surprised = normalizedIntensity;
        weights.neutral = 1 - normalizedIntensity;
        break;
      case 'thinking':
        weights.thinking = normalizedIntensity;
        weights.neutral = 1 - normalizedIntensity;
        break;
      case 'explaining':
        weights.explaining = normalizedIntensity;
        weights.neutral = 1 - normalizedIntensity;
        break;
      case 'greeting':
        weights.greeting = normalizedIntensity;
        weights.happy = normalizedIntensity * 0.3; // Slight happiness
        weights.neutral = 1 - normalizedIntensity;
        break;
      case 'listening':
        weights.listening = normalizedIntensity;
        weights.surprised = normalizedIntensity * 0.2; // Slight attention
        weights.neutral = 1 - normalizedIntensity;
        break;
      default:
        weights.neutral = 1;
        break;
    }

    return weights;
  }

  /**
   * Create sample text with emotion tags for testing
   */
  static createSampleEmotionalText(language: 'ja' | 'en' = 'ja'): string {
    if (language === 'ja') {
      return '[greeting]はじめまして！[happy]今日はとても良い天気ですね。[thinking]ところで、何かお手伝いできることはありますか？[listening]';
    } else {
      return '[greeting]Hello there! [happy]It\'s such a beautiful day today. [thinking]By the way, is there anything I can help you with? [listening]';
    }
  }

  /**
   * Validate if emotion tag is supported
   */
  static isValidEmotion(emotion: string): boolean {
    return emotion.toLowerCase() in this.EMOTION_MAPPING;
  }

  /**
   * Get all supported emotions
   */
  static getSupportedEmotions(): string[] {
    return Object.keys(this.EMOTION_MAPPING);
  }

  /**
   * Get mapped VRM expressions
   */
  static getVRMExpressions(): string[] {
    return Array.from(new Set(Object.values(this.EMOTION_MAPPING)));
  }
}