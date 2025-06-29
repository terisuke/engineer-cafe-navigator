import { EmotionMapping, type SupportedEmotion } from './emotion-mapping';

/**
 * Emotion Tag Parser for VRM character expression control
 * Parses emotion tags like [happy], [sad], [curious] from AI responses
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

  /**
   * Parse emotion tags from text
   */
  static parseEmotionTags(text: string): ParsedResponse {
    // Regex to match emotion tags: [emotion] or [emotion:intensity]
    const emotionRegex = /\[\/?([a-zA-Z_]+)(?::(\d*\.?\d+))?\]/g;
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
      if (EmotionMapping.isSupportedEmotion(emotion)) {
        const mappedEmotion = EmotionMapping.mapToVRMEmotion(emotion);
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
    const supportedEmotions = EmotionMapping.getSupportedEmotions();
    const weights: Record<string, number> = {};
    
    // Initialize all emotions to 0
    supportedEmotions.forEach(e => weights[e] = 0);

    const normalizedEmotion = EmotionMapping.mapToVRMEmotion(emotion);
    const normalizedIntensity = Math.max(0, Math.min(1, intensity));

    if (normalizedEmotion === 'neutral') {
      weights.neutral = 1;
    } else {
      weights[normalizedEmotion] = normalizedIntensity;
      weights.neutral = 1 - normalizedIntensity;
    }

    return weights;
  }

  /**
   * Create sample text with emotion tags for testing
   */
  static createSampleEmotionalText(language: 'ja' | 'en' = 'ja'): string {
    if (language === 'ja') {
      return '[happy]はじめまして！[neutral]今日はとても良い天気ですね。[relaxed]ところで、何かお手伝いできることはありますか？[/relaxed]';
    } else {
      return '[happy]Hello there! [neutral]It\'s such a beautiful day today. [relaxed]By the way, is there anything I can help you with?[/relaxed]';
    }
  }

  /**
   * Validate if emotion tag is supported
   */
  static isValidEmotion(emotion: string): boolean {
    return EmotionMapping.isSupportedEmotion(emotion);
  }

  /**
   * Get all supported emotions
   */
  static getSupportedEmotions(): string[] {
    return EmotionMapping.getAllEmotionAliases();
  }

  /**
   * Get mapped VRM expressions
   */
  static getVRMExpressions(): string[] {
    return EmotionMapping.getSupportedEmotions();
  }

  /**
   * Auto-add emotion tags to AI responses based on content analysis
   */
  static addEmotionTags(text: string, language: 'ja' | 'en' = 'ja'): string {
    // If text already has emotion tags, return as is
    if (text.includes('[') && text.includes(']')) {
      return text;
    }

    // Analyze text content to determine appropriate emotion
    const lowerText = text.toLowerCase();
    let emotion = 'neutral'; // default

    // Detection patterns for different emotions
    if (language === 'ja') {
      if (lowerText.includes('ようこそ') || lowerText.includes('はじめまして') || lowerText.includes('ありがとう') || lowerText.includes('素晴らしい')) {
        emotion = 'happy';
      } else if (lowerText.includes('申し訳') || lowerText.includes('すみません') || lowerText.includes('残念') || lowerText.includes('困り')) {
        emotion = 'sad';
      } else if (lowerText.includes('考え') || lowerText.includes('うーん') || lowerText.includes('どうしよう') || lowerText.includes('リラックス')) {
        emotion = 'relaxed';
      } else if (lowerText.includes('びっくり') || lowerText.includes('驚き') || lowerText.includes('すごい') || lowerText.includes('まさか')) {
        emotion = 'curious';
      } else if (lowerText.includes('問題') || lowerText.includes('怒り') || lowerText.includes('イライラ')) {
        emotion = 'angry';
      }
    } else {
      if (lowerText.includes('welcome') || lowerText.includes('hello') || lowerText.includes('great') || lowerText.includes('wonderful') || lowerText.includes('thank')) {
        emotion = 'happy';
      } else if (lowerText.includes('sorry') || lowerText.includes('apologize') || lowerText.includes('unfortunately') || lowerText.includes('problem')) {
        emotion = 'sad';
      } else if (lowerText.includes('think') || lowerText.includes('consider') || lowerText.includes('hmm') || lowerText.includes('relax')) {
        emotion = 'relaxed';
      } else if (lowerText.includes('wow') || lowerText.includes('amazing') || lowerText.includes('surprised') || lowerText.includes('incredible')) {
        emotion = 'curious';
      } else if (lowerText.includes('angry') || lowerText.includes('frustrated') || lowerText.includes('annoying')) {
        emotion = 'angry';
      }
    }

    return `[${emotion}]${text}[/${emotion}]`;
  }

  /**
   * Auto-enhance agent responses with appropriate emotion tags
   */
  static enhanceAgentResponse(response: string, context?: 'welcome' | 'qa' | 'error' | 'success', language: 'ja' | 'en' = 'ja'): string {
    // If response already has emotion tags, return as is
    if (response.includes('[') && response.includes(']')) {
      return response;
    }

    let emotion = 'neutral';

    // Context-based emotion selection
    switch (context) {
      case 'welcome':
        emotion = 'happy';
        break;
      case 'qa':
        emotion = 'neutral';
        break;
      case 'error':
        emotion = 'sad';
        break;
      case 'success':
        emotion = 'happy';
        break;
      default:
        // Use content-based detection
        return this.addEmotionTags(response, language);
    }

    return `[${emotion}]${response}[/${emotion}]`;
  }
}