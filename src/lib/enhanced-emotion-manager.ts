export interface EmotionState {
  primary: string;
  intensity: number;
  secondary?: string;
  secondaryIntensity?: number;
  duration: number;
  timestamp: number;
}

export interface EmotionTransition {
  from: string;
  to: string;
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface VoiceEmotionMapping {
  emotion: string;
  voiceParameters: {
    pitch: number;
    speed: number;
    volume: number;
    emphasis: number;
  };
  expressions: {
    [key: string]: number;
  };
}

export class EnhancedEmotionManager {
  private currentEmotion: EmotionState;
  private emotionHistory: EmotionState[] = [];
  private transitionCallbacks: ((emotion: EmotionState) => void)[] = [];
  private maxHistoryLength = 10;

  // 詳細な感情マッピング
  private static readonly EMOTION_MAPPINGS: Record<string, VoiceEmotionMapping> = {
    // 基本感情
    happy: {
      emotion: 'happy',
      voiceParameters: { pitch: 1.1, speed: 1.05, volume: 1.0, emphasis: 1.2 },
      expressions: { happy: 0.9, smile: 0.8, relaxed: 0.3 }
    },
    excited: {
      emotion: 'excited',
      voiceParameters: { pitch: 1.2, speed: 1.1, volume: 1.1, emphasis: 1.4 },
      expressions: { happy: 1.0, surprised: 0.6, energetic: 0.9 }
    },
    gentle: {
      emotion: 'gentle',
      voiceParameters: { pitch: 0.95, speed: 0.9, volume: 0.8, emphasis: 0.7 },
      expressions: { relaxed: 0.8, calm: 0.9, smile: 0.4 }
    },
    confident: {
      emotion: 'confident',
      voiceParameters: { pitch: 1.0, speed: 1.0, volume: 1.0, emphasis: 1.3 },
      expressions: { confident: 0.9, determined: 0.7, smile: 0.5 }
    },
    supportive: {
      emotion: 'supportive',
      voiceParameters: { pitch: 0.98, speed: 0.95, volume: 0.9, emphasis: 1.1 },
      expressions: { caring: 0.8, gentle: 0.7, warm: 0.9 }
    },
    
    // 知的・分析的感情
    knowledgeable: {
      emotion: 'knowledgeable',
      voiceParameters: { pitch: 0.95, speed: 0.9, volume: 0.95, emphasis: 1.0 },
      expressions: { thoughtful: 0.8, focused: 0.9, confident: 0.6 }
    },
    analytical: {
      emotion: 'analytical',
      voiceParameters: { pitch: 0.9, speed: 0.85, volume: 0.9, emphasis: 0.9 },
      expressions: { concentrated: 0.9, thoughtful: 0.8, serious: 0.6 }
    },
    curious: {
      emotion: 'curious',
      voiceParameters: { pitch: 1.05, speed: 1.0, volume: 1.0, emphasis: 1.1 },
      expressions: { interested: 0.9, alert: 0.8, surprised: 0.4 }
    },
    thoughtful: {
      emotion: 'thoughtful',
      voiceParameters: { pitch: 0.92, speed: 0.85, volume: 0.85, emphasis: 0.8 },
      expressions: { pensive: 0.9, concentrated: 0.7, calm: 0.6 }
    },

    // ネガティブ感情
    confused: {
      emotion: 'confused',
      voiceParameters: { pitch: 1.02, speed: 0.9, volume: 0.8, emphasis: 0.7 },
      expressions: { confused: 0.8, uncertain: 0.7, concerned: 0.5 }
    },
    apologetic: {
      emotion: 'apologetic',
      voiceParameters: { pitch: 0.9, speed: 0.85, volume: 0.7, emphasis: 0.6 },
      expressions: { sorry: 0.9, sad: 0.6, gentle: 0.7 }
    },
    concerned: {
      emotion: 'concerned',
      voiceParameters: { pitch: 0.95, speed: 0.9, volume: 0.85, emphasis: 0.8 },
      expressions: { worried: 0.8, serious: 0.7, caring: 0.6 }
    },

    // エネルギッシュな感情
    energetic: {
      emotion: 'energetic',
      voiceParameters: { pitch: 1.15, speed: 1.1, volume: 1.1, emphasis: 1.3 },
      expressions: { excited: 0.9, dynamic: 0.8, happy: 0.7 }
    },
    enthusiastic: {
      emotion: 'enthusiastic',
      voiceParameters: { pitch: 1.1, speed: 1.05, volume: 1.05, emphasis: 1.25 },
      expressions: { passionate: 0.9, excited: 0.8, confident: 0.6 }
    },

    // 温かい感情
    warm: {
      emotion: 'warm',
      voiceParameters: { pitch: 0.98, speed: 0.95, volume: 0.9, emphasis: 1.0 },
      expressions: { warm: 0.9, caring: 0.8, smile: 0.7 }
    },
    grateful: {
      emotion: 'grateful',
      voiceParameters: { pitch: 0.96, speed: 0.9, volume: 0.85, emphasis: 1.1 },
      expressions: { thankful: 0.9, warm: 0.8, happy: 0.6 }
    }
  };

  // 感情の互換性マトリクス（どの感情からどの感情に自然に移行できるか）
  private static readonly EMOTION_COMPATIBILITY: Record<string, string[]> = {
    happy: ['excited', 'confident', 'warm', 'grateful'],
    excited: ['happy', 'enthusiastic', 'energetic'],
    gentle: ['warm', 'supportive', 'calm'],
    confident: ['knowledgeable', 'analytical', 'determined'],
    supportive: ['caring', 'warm', 'gentle'],
    knowledgeable: ['analytical', 'thoughtful', 'confident'],
    analytical: ['thoughtful', 'focused', 'knowledgeable'],
    curious: ['interested', 'excited', 'surprised'],
    confused: ['uncertain', 'concerned', 'thoughtful'],
    apologetic: ['sorry', 'gentle', 'concerned'],
    energetic: ['excited', 'enthusiastic', 'dynamic'],
    warm: ['caring', 'gentle', 'grateful']
  };

  constructor(initialEmotion: string = 'gentle') {
    this.currentEmotion = {
      primary: initialEmotion,
      intensity: 0.7,
      duration: 5000,
      timestamp: Date.now()
    };
  }

  getCurrentEmotion(): EmotionState {
    return { ...this.currentEmotion };
  }

  getEmotionMapping(emotion: string): VoiceEmotionMapping | null {
    return EnhancedEmotionManager.EMOTION_MAPPINGS[emotion] || null;
  }

  setEmotion(
    emotion: string, 
    intensity: number = 0.8, 
    duration: number = 5000,
    secondary?: string,
    secondaryIntensity?: number
  ): void {
    const previousEmotion = { ...this.currentEmotion };
    
    this.currentEmotion = {
      primary: emotion,
      intensity: Math.max(0, Math.min(1, intensity)),
      secondary,
      secondaryIntensity: secondary ? Math.max(0, Math.min(1, secondaryIntensity || 0.5)) : undefined,
      duration,
      timestamp: Date.now()
    };

    // 履歴に追加
    this.emotionHistory.push(previousEmotion);
    if (this.emotionHistory.length > this.maxHistoryLength) {
      this.emotionHistory.shift();
    }

    // コールバック実行
    this.transitionCallbacks.forEach(callback => {
      try {
        callback(this.currentEmotion);
      } catch (error) {
        console.error('Error in emotion transition callback:', error);
      }
    });
  }

  // テキスト内容から適切な感情を推定
  analyzeTextEmotion(text: string, language: 'ja' | 'en' = 'ja'): {
    emotion: string;
    intensity: number;
    confidence: number;
  } {
    const patterns = {
      ja: {
        excited: ['！！', '素晴らしい', 'すごい', 'やった', '最高'],
        happy: ['♪', '嬉しい', '楽しい', 'ありがとう', '良い'],
        supportive: ['大丈夫', '一緒に', '頑張', 'できます', 'きっと'],
        gentle: ['ゆっくり', 'そっと', 'やさしく', '穏やか'],
        confused: ['わからない', '困った', 'うーん', '？'],
        apologetic: ['すみません', 'ごめん', '申し訳'],
        knowledgeable: ['なるほど', '確かに', '理解', '分析'],
        enthusiastic: ['頑張ろう', 'やりましょう', 'チャレンジ'],
        grateful: ['ありがとう', '感謝', 'おかげで']
      },
      en: {
        excited: ['!!', 'amazing', 'awesome', 'fantastic', 'wonderful'],
        happy: ['great', 'good', 'nice', 'pleased', 'glad'],
        supportive: ['together', 'help', 'support', 'believe', 'can do'],
        gentle: ['gently', 'softly', 'calm', 'peaceful'],
        confused: ['confused', 'unclear', 'hmm', '?'],
        apologetic: ['sorry', 'apologize', 'my fault'],
        knowledgeable: ['understand', 'analyze', 'indeed', 'exactly'],
        enthusiastic: ['let\'s go', 'challenge', 'excited'],
        grateful: ['thank', 'grateful', 'appreciate']
      }
    };

    const textLower = text.toLowerCase();
    const emotionScores: Record<string, number> = {};

    // パターンマッチングで感情スコアを計算
    Object.entries(patterns[language]).forEach(([emotion, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        // Use simple string search instead of regex to avoid special character issues
        const keywordLower = keyword.toLowerCase();
        let startIndex = 0;
        let matches = 0;
        
        while ((startIndex = textLower.indexOf(keywordLower, startIndex)) !== -1) {
          matches++;
          startIndex += keywordLower.length;
        }
        
        score += matches;
      });
      emotionScores[emotion] = score;
    });

    // 最も高いスコアの感情を選択
    const topEmotion = Object.entries(emotionScores)
      .filter(([_, score]) => score > 0)
      .sort(([_, a], [__, b]) => b - a)[0];

    if (!topEmotion) {
      return { emotion: 'gentle', intensity: 0.6, confidence: 0.3 };
    }

    const [emotion, score] = topEmotion;
    const intensity = Math.min(0.9, 0.5 + (score * 0.2));
    const confidence = Math.min(0.9, score * 0.3);

    return { emotion, intensity, confidence };
  }

  // 感情の自然な遷移を提案
  suggestEmotionTransition(targetEmotion: string): {
    canTransition: boolean;
    suggestedPath: string[];
    reason: string;
  } {
    const currentEmotion = this.currentEmotion.primary;
    
    if (currentEmotion === targetEmotion) {
      return {
        canTransition: true,
        suggestedPath: [currentEmotion],
        reason: 'Already in target emotion'
      };
    }

    // 直接遷移可能か確認
    const compatibleEmotions = EnhancedEmotionManager.EMOTION_COMPATIBILITY[currentEmotion] || [];
    if (compatibleEmotions.includes(targetEmotion)) {
      return {
        canTransition: true,
        suggestedPath: [currentEmotion, targetEmotion],
        reason: 'Direct transition available'
      };
    }

    // 中間感情を通じた遷移パスを探索
    for (const intermediateEmotion of compatibleEmotions) {
      const nextCompatible = EnhancedEmotionManager.EMOTION_COMPATIBILITY[intermediateEmotion] || [];
      if (nextCompatible.includes(targetEmotion)) {
        return {
          canTransition: true,
          suggestedPath: [currentEmotion, intermediateEmotion, targetEmotion],
          reason: `Transition via ${intermediateEmotion}`
        };
      }
    }

    return {
      canTransition: false,
      suggestedPath: [currentEmotion, targetEmotion],
      reason: 'No natural transition path found'
    };
  }

  // 感情に基づく表情の重みを計算
  getExpressionWeights(): Record<string, number> {
    const mapping = this.getEmotionMapping(this.currentEmotion.primary);
    if (!mapping) return {};

    const weights = { ...mapping.expressions };
    
    // 強度を適用
    Object.keys(weights).forEach(key => {
      weights[key] *= this.currentEmotion.intensity;
    });

    // セカンダリ感情があれば混合
    if (this.currentEmotion.secondary) {
      const secondaryMapping = this.getEmotionMapping(this.currentEmotion.secondary);
      if (secondaryMapping && this.currentEmotion.secondaryIntensity) {
        Object.entries(secondaryMapping.expressions).forEach(([key, value]) => {
          weights[key] = (weights[key] || 0) + (value * this.currentEmotion.secondaryIntensity!);
        });
      }
    }

    return weights;
  }

  // 音声パラメータを取得
  getVoiceParameters(): {
    pitch: number;
    speed: number;
    volume: number;
    emphasis: number;
  } {
    const mapping = this.getEmotionMapping(this.currentEmotion.primary);
    if (!mapping) {
      return { pitch: 1.0, speed: 1.0, volume: 1.0, emphasis: 1.0 };
    }

    const params = { ...mapping.voiceParameters };
    
    // 強度に基づいてパラメータを調整
    const intensity = this.currentEmotion.intensity;
    params.pitch = 1.0 + (params.pitch - 1.0) * intensity;
    params.speed = 1.0 + (params.speed - 1.0) * intensity;
    params.volume = 1.0 + (params.volume - 1.0) * intensity;
    params.emphasis = 1.0 + (params.emphasis - 1.0) * intensity;

    return params;
  }

  // 感情変化のコールバックを登録
  onEmotionChange(callback: (emotion: EmotionState) => void): void {
    this.transitionCallbacks.push(callback);
  }

  // 感情履歴を取得
  getEmotionHistory(): EmotionState[] {
    return [...this.emotionHistory];
  }

  // 感情の持続時間をチェック
  isEmotionExpired(): boolean {
    return Date.now() - this.currentEmotion.timestamp > this.currentEmotion.duration;
  }

  // 自然な感情減衰
  naturalDecay(): void {
    if (this.isEmotionExpired()) {
      const newIntensity = Math.max(0.3, this.currentEmotion.intensity * 0.8);
      this.setEmotion(
        this.currentEmotion.primary,
        newIntensity,
        this.currentEmotion.duration
      );
    }
  }

  // デバッグ情報を取得
  getDebugInfo(): any {
    return {
      current: this.currentEmotion,
      history: this.emotionHistory,
      expressions: this.getExpressionWeights(),
      voiceParams: this.getVoiceParameters(),
      isExpired: this.isEmotionExpired()
    };
  }
}