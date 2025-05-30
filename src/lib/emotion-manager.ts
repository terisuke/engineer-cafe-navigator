/**
 * Emotion Manager for VRM Character Expressions
 * Based on aituber-kit patterns and VRM expression system
 */

export interface EmotionData {
  emotion: string;
  intensity: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  duration?: number; // milliseconds
}

export interface VRMExpressionMapping {
  primary: string; // Primary VRM expression
  secondary?: string; // Optional secondary expression for blending
  weight: number; // Expression weight (0.0 to 1.0)
  blinkOverride?: number; // Override for blink (0.0 to 1.0)
  lookAtOverride?: number; // Override for lookAt (0.0 to 1.0)
  mouthOverride?: number; // Override for mouth movements (0.0 to 1.0)
}

export class EmotionManager {
  // aituber-kit standardized emotions: neutral, happy, sad, angry, relaxed, surprised
  private static readonly EMOTION_KEYWORDS = {
    neutral: ['です', 'is', 'ます', 'polite ending', 'について', 'about', '普通', 'normal', '通常', 'usual', '説明', 'explain', '教える', 'teach'],
    happy: ['嬉しい', 'happy', '楽しい', 'fun', '笑い', 'laugh', '喜び', 'joy', 'ありがとう', 'thank', '素晴らしい', 'wonderful', 'great', 'こんにちは', 'hello', 'はじめまして', 'nice to meet'],
    sad: ['悲しい', 'sad', '残念', 'sorry', '寂しい', 'lonely', '困った', 'trouble', 'がっかり', 'disappointed', '申し訳', 'apologize'],
    angry: ['怒り', 'angry', '腹立つ', 'mad', 'イライラ', 'irritated', '許せない', 'unforgivable', 'ムカつく', 'annoying', '問題', 'problem'],
    relaxed: ['リラックス', 'relax', '落ち着く', 'calm', 'ゆっくり', 'slowly', '平和', 'peaceful', 'のんびり', 'leisurely', '考える', 'think', 'うーん', 'hmm'],
    surprised: ['驚き', 'surprised', 'びっくり', 'shocked', '信じられない', 'unbelievable', 'まさか', 'no way', 'えっ', 'what', 'すごい', 'amazing']
  };

  private static readonly VRM_EXPRESSION_MAP: Record<string, VRMExpressionMapping> = {
    neutral: {
      primary: 'neutral',
      weight: 1.0,
    },
    happy: {
      primary: 'happy',
      weight: 0.8,
      blinkOverride: 0.2,
    },
    sad: {
      primary: 'sad',
      weight: 0.9,
      blinkOverride: 0.4,
      lookAtOverride: 0.3,
    },
    angry: {
      primary: 'angry',
      weight: 0.85,
      blinkOverride: 0.6,
      lookAtOverride: 0.2,
    },
    relaxed: {
      primary: 'relaxed',
      weight: 0.7,
      blinkOverride: 0.3,
      lookAtOverride: 0.4,
    },
    surprised: {
      primary: 'surprised',
      weight: 1.0,
      blinkOverride: 0.8,
    },
  };

  /**
   * Detect emotion from text content using keyword analysis
   */
  static detectEmotion(text: string, language: 'ja' | 'en' = 'ja'): EmotionData {
    const lowercaseText = text.toLowerCase();
    const emotionScores: Record<string, number> = {};

    // Initialize scores
    Object.keys(this.EMOTION_KEYWORDS).forEach(emotion => {
      emotionScores[emotion] = 0;
    });

    // Calculate scores based on keyword matches
    Object.entries(this.EMOTION_KEYWORDS).forEach(([emotion, keywords]) => {
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (lowercaseText.includes(keywordLower)) {
          emotionScores[emotion] += 1;
          
          // Boost score for exact matches at word boundaries
          const wordBoundaryRegex = new RegExp(`\\b${keywordLower}\\b`, 'gi');
          const exactMatches = (lowercaseText.match(wordBoundaryRegex) || []).length;
          emotionScores[emotion] += exactMatches * 0.5;
        }
      });
    });

    // Find the emotion with the highest score
    let topEmotion = 'neutral';
    let maxScore = 0;
    let totalScore = 0;

    Object.entries(emotionScores).forEach(([emotion, score]) => {
      totalScore += score;
      if (score > maxScore) {
        maxScore = score;
        topEmotion = emotion;
      }
    });

    // Calculate confidence based on score distribution
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.3;
    
    // Calculate intensity based on absolute score and text length
    const intensity = Math.min(1.0, Math.max(0.1, maxScore / Math.max(1, text.length / 10)));

    return {
      emotion: topEmotion,
      intensity,
      confidence,
      duration: this.calculateDuration(topEmotion, text.length),
    };
  }

  /**
   * Map emotion to VRM expression parameters
   */
  static mapEmotionToVRM(emotionData: EmotionData): VRMExpressionMapping {
    const baseMapping = this.VRM_EXPRESSION_MAP[emotionData.emotion] || this.VRM_EXPRESSION_MAP.neutral;
    
    // Adjust weights based on intensity and confidence
    const adjustedWeight = baseMapping.weight * emotionData.intensity * emotionData.confidence;
    
    return {
      ...baseMapping,
      weight: Math.max(0.1, Math.min(1.0, adjustedWeight)),
    };
  }

  /**
   * Detect emotion specifically for conversation context
   */
  static detectConversationEmotion(
    userInput: string, 
    aiResponse: string, 
    conversationContext?: string[]
  ): EmotionData {
    // Combine input and response for context-aware detection
    const combinedText = `${userInput} ${aiResponse}`;
    
    // Get base emotion from combined text
    const baseEmotion = this.detectEmotion(combinedText);
    
    // Apply conversation context modifiers
    if (conversationContext && conversationContext.length > 0) {
      const contextText = conversationContext.slice(-3).join(' '); // Last 3 messages
      const contextEmotion = this.detectEmotion(contextText);
      
      // Blend base emotion with context (70% base, 30% context)
      const blendedIntensity = baseEmotion.intensity * 0.7 + contextEmotion.intensity * 0.3;
      const blendedConfidence = Math.max(baseEmotion.confidence, contextEmotion.confidence * 0.5);
      
      return {
        emotion: baseEmotion.emotion,
        intensity: blendedIntensity,
        confidence: blendedConfidence,
        duration: this.calculateDuration(baseEmotion.emotion, combinedText.length),
      };
    }
    
    return baseEmotion;
  }

  /**
   * Get emotion for specific interaction types
   */
  static getEmotionForInteraction(
    interactionType: 'welcome' | 'question' | 'explanation' | 'goodbye' | 'error' | 'thinking',
    intensity: number = 0.8
  ): EmotionData {
    const emotionMap = {
      welcome: 'happy',
      question: 'neutral',
      explanation: 'neutral',
      goodbye: 'happy',
      error: 'sad',
      thinking: 'relaxed',
    };

    return {
      emotion: emotionMap[interactionType],
      intensity,
      confidence: 0.9,
      duration: this.calculateDuration(emotionMap[interactionType], 0),
    };
  }

  /**
   * Create smooth transition between emotions
   */
  static createEmotionTransition(
    fromEmotion: EmotionData,
    toEmotion: EmotionData,
    progress: number // 0.0 to 1.0
  ): VRMExpressionMapping {
    const fromMapping = this.mapEmotionToVRM(fromEmotion);
    const toMapping = this.mapEmotionToVRM(toEmotion);
    
    // Linear interpolation between expressions
    const weight = fromMapping.weight * (1 - progress) + toMapping.weight * progress;
    
    return {
      primary: progress < 0.5 ? fromMapping.primary : toMapping.primary,
      secondary: progress < 0.5 ? toMapping.primary : fromMapping.primary,
      weight,
      blinkOverride: this.interpolate(fromMapping.blinkOverride, toMapping.blinkOverride, progress),
      lookAtOverride: this.interpolate(fromMapping.lookAtOverride, toMapping.lookAtOverride, progress),
      mouthOverride: this.interpolate(fromMapping.mouthOverride, toMapping.mouthOverride, progress),
    };
  }

  /**
   * Apply emotion to VRM expression manager
   */
  static applyEmotionToVRM(
    vrm: any, // VRM instance
    emotionData: EmotionData,
    transitionDuration: number = 500
  ): void {
    if (!vrm?.expressionManager) {
      console.warn('VRM or expressionManager not available');
      return;
    }

    const mapping = this.mapEmotionToVRM(emotionData);
    const expressionManager = vrm.expressionManager;

    try {
      // Reset all expressions gradually
      Object.keys(expressionManager.expressionMap).forEach(name => {
        const currentValue = expressionManager.getValue(name) || 0;
        if (currentValue > 0) {
          this.animateExpressionValue(expressionManager, name, currentValue, 0, transitionDuration / 2);
        }
      });

      // Apply primary expression
      setTimeout(() => {
        if (expressionManager.expressionMap[mapping.primary]) {
          this.animateExpressionValue(
            expressionManager, 
            mapping.primary, 
            0, 
            mapping.weight, 
            transitionDuration
          );
        }

        // Apply secondary expression if specified
        if (mapping.secondary && expressionManager.expressionMap[mapping.secondary]) {
          this.animateExpressionValue(
            expressionManager, 
            mapping.secondary, 
            0, 
            mapping.weight * 0.5, 
            transitionDuration
          );
        }
      }, transitionDuration / 2);

    } catch (error) {
      console.error('Error applying emotion to VRM:', error);
    }
  }

  /**
   * Animate expression value change
   */
  private static animateExpressionValue(
    expressionManager: any,
    expressionName: string,
    fromValue: number,
    toValue: number,
    duration: number
  ): void {
    const startTime = Date.now();
    const valueDiff = toValue - fromValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      
      // Ease-out animation
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = fromValue + valueDiff * easedProgress;
      
      try {
        expressionManager.setValue(expressionName, currentValue);
      } catch (error) {
        console.error(`Error setting expression ${expressionName}:`, error);
        return;
      }

      if (progress < 1.0) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Calculate appropriate duration for emotion based on type and context
   */
  private static calculateDuration(emotion: string, textLength: number): number {
    const baseDurations = {
      neutral: 1000,
      happy: 2000,
      sad: 3000,
      angry: 2500,
      relaxed: 2500,
      surprised: 1500,
    };

    const baseDuration = baseDurations[emotion as keyof typeof baseDurations] || 1500;
    
    // Adjust duration based on text length (longer text = longer emotion)
    const lengthFactor = Math.max(0.5, Math.min(2.0, textLength / 50));
    
    return Math.round(baseDuration * lengthFactor);
  }

  /**
   * Linear interpolation helper
   */
  private static interpolate(from: number | undefined, to: number | undefined, progress: number): number | undefined {
    if (from === undefined && to === undefined) return undefined;
    if (from === undefined) return to;
    if (to === undefined) return from;
    
    return from * (1 - progress) + to * progress;
  }

  /**
   * Get available VRM expressions for the current model
   */
  static getAvailableExpressions(): string[] {
    return Object.keys(this.VRM_EXPRESSION_MAP);
  }

  /**
   * Validate if an emotion is supported
   */
  static isEmotionSupported(emotion: string): boolean {
    return emotion in this.VRM_EXPRESSION_MAP;
  }
}