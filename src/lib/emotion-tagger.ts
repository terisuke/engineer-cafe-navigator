/**
 * Unified Emotion Tagging System
 * Ensures consistent emotion tags across all agents
 * 
 * Supported emotions: happy, angry, sad, relaxed, surprised
 */

export type UnifiedEmotion = 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised';

interface EmotionRule {
  patterns: string[];
  emotion: UnifiedEmotion;
  priority: number; // Higher priority rules override lower ones
}

export class EmotionTagger {
  private static readonly EMOTION_RULES: EmotionRule[] = [
    // Happy patterns (priority: 8)
    {
      patterns: ['はじめまして', 'ようこそ', 'いらっしゃい', 'こんにちは', 'hello', 'welcome', 'nice to meet'],
      emotion: 'happy',
      priority: 8
    },
    {
      patterns: ['！', '!', 'ありがとう', 'thank', '嬉しい', 'happy', '楽しい', 'fun', '素晴らしい', 'wonderful'],
      emotion: 'happy',
      priority: 7
    },
    {
      patterns: ['お手伝い', 'help', 'どうぞ', 'please', 'ご利用', 'サービス', 'service'],
      emotion: 'happy',
      priority: 6
    },
    
    // Sad patterns (priority: 9 - highest for apologies)
    {
      patterns: ['申し訳', 'すみません', 'ごめん', 'sorry', 'apologize', '残念', 'unfortunately'],
      emotion: 'sad',
      priority: 9
    },
    {
      patterns: ['できません', 'できない', 'cannot', "can't", '無理', 'impossible'],
      emotion: 'sad',
      priority: 7
    },
    
    // Angry patterns (priority: 5)
    {
      patterns: ['だめ', '禁止', 'forbidden', 'prohibited', '違反', 'violation'],
      emotion: 'angry',
      priority: 5
    },
    
    // Surprised patterns (priority: 7)
    {
      patterns: ['どちら', 'どれ', 'which', '選んで', 'choose', '？', '?', 'それとも', 'or'],
      emotion: 'surprised',
      priority: 7
    },
    {
      patterns: ['えっ', 'え？', 'what', 'really', '本当', 'まさか', 'びっくり'],
      emotion: 'surprised',
      priority: 8
    },
    
    // Relaxed patterns (priority: 4)
    {
      patterns: ['説明', 'について', 'とは', 'explain', 'about', '詳細', 'details'],
      emotion: 'relaxed',
      priority: 4
    },
    {
      patterns: ['営業時間', '料金', '場所', 'hours', 'price', 'location', '設備', 'facility'],
      emotion: 'relaxed',
      priority: 3
    },
  ];

  /**
   * Add emotion tags to response text
   * 
   * @param text - The response text
   * @param forceEmotion - Optional emotion to force (overrides detection)
   * @returns Text with emotion tag prepended
   */
  static addEmotionTag(text: string, forceEmotion?: UnifiedEmotion): string {
    if (!text || text.trim().length === 0) {
      return text;
    }

    // Check if emotion tag already exists
    const hasEmotionTag = /^\[[a-zA-Z_]+(?::\d*\.?\d+)?\]/.test(text.trim());
    if (hasEmotionTag) {
      return text;
    }

    // Use forced emotion if provided
    const emotion = forceEmotion || this.detectEmotion(text);
    return `[${emotion}]${text}`;
  }

  /**
   * Detect emotion from text content
   * 
   * @param text - The text to analyze
   * @returns Detected emotion
   */
  static detectEmotion(text: string): UnifiedEmotion {
    const lowerText = text.toLowerCase();
    let detectedEmotion: UnifiedEmotion = 'neutral' as UnifiedEmotion;
    let highestPriority = -1;

    // Check all rules and use the highest priority match
    for (const rule of this.EMOTION_RULES) {
      if (rule.priority > highestPriority) {
        for (const pattern of rule.patterns) {
          if (lowerText.includes(pattern.toLowerCase())) {
            detectedEmotion = rule.emotion;
            highestPriority = rule.priority;
            break;
          }
        }
      }
    }

    // Default fallback
    if (highestPriority === -1) {
      // For informational content, use relaxed
      if (text.length > 100) {
        return 'relaxed';
      }
      // For short responses, default to neutral (which maps to happy)
      return 'happy';
    }

    return detectedEmotion;
  }

  /**
   * Update emotion mapping to use 5 standard emotions
   * Maps neutral to happy for more positive interactions
   */
  static normalizeEmotion(emotion: string): UnifiedEmotion {
    const emotionMap: Record<string, UnifiedEmotion> = {
      // Direct mappings
      'happy': 'happy',
      'angry': 'angry',
      'sad': 'sad',
      'relaxed': 'relaxed',
      'surprised': 'surprised',
      
      // Common aliases
      'neutral': 'happy', // Make neutral more positive
      'curious': 'surprised',
      'excited': 'happy',
      'helpful': 'happy',
      'apologetic': 'sad',
      'thoughtful': 'relaxed',
      'explaining': 'relaxed',
      'confused': 'surprised',
      'welcoming': 'happy',
      'greeting': 'happy',
    };

    return emotionMap[emotion.toLowerCase()] || 'happy';
  }

  /**
   * Extract existing emotion from tagged text
   * 
   * @param text - Text that may contain emotion tags
   * @returns Extracted emotion or null
   */
  static extractEmotion(text: string): UnifiedEmotion | null {
    const match = text.match(/^\[([a-zA-Z_]+)(?::\d*\.?\d+)?\]/);
    if (match) {
      return this.normalizeEmotion(match[1]);
    }
    return null;
  }

  /**
   * Remove emotion tags from text
   * 
   * @param text - Text with emotion tags
   * @returns Clean text without tags
   */
  static removeEmotionTags(text: string): string {
    return text.replace(/\[\/?\w+(?::\d*\.?\d+)?\]/g, '').trim();
  }

  /**
   * Get emotion for specific agent contexts
   * 
   * @param agentName - Name of the agent
   * @param category - Response category
   * @returns Appropriate emotion
   */
  static getEmotionForContext(agentName: string, category?: string): UnifiedEmotion {
    // Agent-specific emotions
    const contextMap: Record<string, UnifiedEmotion> = {
      // ClarificationAgent - always curious/surprised
      'ClarificationAgent': 'surprised',
      
      // WelcomeAgent - always happy
      'WelcomeAgent': 'happy',
      
      // MemoryAgent contexts
      'memory-found': 'happy',
      'memory-not-found': 'sad',
      
      // EventAgent contexts
      'events-found': 'happy',
      'no-events': 'relaxed',
      
      // FacilityAgent contexts
      'facility-available': 'happy',
      'facility-unavailable': 'sad',
      
      // Error contexts
      'error': 'sad',
      'not-found': 'sad',
    };

    const key = category ? `${agentName}-${category}` : agentName;
    return contextMap[key] || contextMap[agentName] || 'relaxed';
  }
}