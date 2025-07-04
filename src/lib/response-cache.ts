export interface CachedResponse {
  id: string;
  text: string;
  audioBase64?: string;
  emotion: string;
  language: 'ja' | 'en';
  timestamp: number;
  useCount: number;
  category: 'greeting' | 'common' | 'technical' | 'emotion' | 'question';
}

export interface EmotionalVariation {
  emotion: string;
  text: string;
  audioBase64?: string;
  intensity: number;
}

export class ResponseCache {
  private static readonly CACHE_PREFIX = 'engineer_cafe_response_';
  private static readonly MAX_CACHE_SIZE = 50; // Reduced from 100
  private static readonly CACHE_EXPIRY_DAYS = 3; // Reduced from 7
  private static readonly MAX_TEXT_LENGTH = 200; // Limit text length for caching

  // 定型文のテンプレート（感情バリエーション付き）
  private static readonly PREDEFINED_RESPONSES: Record<string, {
    ja: EmotionalVariation[];
    en: EmotionalVariation[];
  }> = {
    greeting: {
      ja: [
        { emotion: 'happy', text: 'こんにちは！今日も素晴らしい一日ですね♪', intensity: 0.8 },
        { emotion: 'excited', text: 'いらっしゃいませ！エンジニアカフェへようこそ！！', intensity: 0.9 },
        { emotion: 'gentle', text: 'こんにちは。ゆっくりしていってくださいね。', intensity: 0.6 },
        { emotion: 'energetic', text: 'よっ！今日もプログラミング頑張ろうね！', intensity: 0.85 }
      ],
      en: [
        { emotion: 'happy', text: 'Hello! What a wonderful day it is♪', intensity: 0.8 },
        { emotion: 'excited', text: 'Welcome to Engineer Cafe!!', intensity: 0.9 },
        { emotion: 'gentle', text: 'Hello. Please take your time and relax.', intensity: 0.6 },
        { emotion: 'energetic', text: 'Hey! Let\'s code hard today!', intensity: 0.85 }
      ]
    },
    encouragement: {
      ja: [
        { emotion: 'supportive', text: 'きっとできますよ！一緒に頑張りましょう！', intensity: 0.7 },
        { emotion: 'excited', text: 'その調子です！もうちょっとで解決しそうですね！', intensity: 0.8 },
        { emotion: 'confident', text: '大丈夫、あなたなら絶対にできます！', intensity: 0.9 },
        { emotion: 'gentle', text: 'ゆっくりでも大丈夫。焦らずいきましょう。', intensity: 0.6 }
      ],
      en: [
        { emotion: 'supportive', text: 'You can definitely do it! Let\'s work together!', intensity: 0.7 },
        { emotion: 'excited', text: 'That\'s the spirit! You\'re almost there!', intensity: 0.8 },
        { emotion: 'confident', text: 'Don\'t worry, I believe in you!', intensity: 0.9 },
        { emotion: 'gentle', text: 'Take your time. No need to rush.', intensity: 0.6 }
      ]
    },
    programming_help: {
      ja: [
        { emotion: 'knowledgeable', text: 'プログラミングの質問ですね！詳しく聞かせてください。', intensity: 0.7 },
        { emotion: 'excited', text: 'コーディングの話、大好きです！何を作ってるんですか？', intensity: 0.8 },
        { emotion: 'supportive', text: 'エラーで困ってるんですね。一緒に解決しましょう！', intensity: 0.75 },
        { emotion: 'analytical', text: 'なるほど、そのアプローチは興味深いですね。', intensity: 0.6 }
      ],
      en: [
        { emotion: 'knowledgeable', text: 'A programming question! Please tell me more details.', intensity: 0.7 },
        { emotion: 'excited', text: 'I love talking about coding! What are you building?', intensity: 0.8 },
        { emotion: 'supportive', text: 'Having trouble with an error? Let\'s solve it together!', intensity: 0.75 },
        { emotion: 'analytical', text: 'I see, that\'s an interesting approach.', intensity: 0.6 }
      ]
    },
    confusion: {
      ja: [
        { emotion: 'confused', text: 'すみません、もう少し詳しく教えてもらえますか？', intensity: 0.6 },
        { emotion: 'apologetic', text: 'ごめんなさい、理解が追いつきませんでした。', intensity: 0.7 },
        { emotion: 'curious', text: 'おもしろい！もっと詳しく聞きたいです。', intensity: 0.75 },
        { emotion: 'thoughtful', text: 'うーん、複雑な問題ですね。整理してみましょう。', intensity: 0.6 }
      ],
      en: [
        { emotion: 'confused', text: 'Sorry, could you explain a bit more?', intensity: 0.6 },
        { emotion: 'apologetic', text: 'I apologize, I couldn\'t quite follow that.', intensity: 0.7 },
        { emotion: 'curious', text: 'That\'s interesting! I\'d love to hear more.', intensity: 0.75 },
        { emotion: 'thoughtful', text: 'Hmm, that\'s a complex problem. Let\'s organize our thoughts.', intensity: 0.6 }
      ]
    },
    goodbye: {
      ja: [
        { emotion: 'warm', text: 'また来てくださいね！お疲れさまでした♪', intensity: 0.8 },
        { emotion: 'grateful', text: 'ありがとうございました！良い一日を！', intensity: 0.7 },
        { emotion: 'excited', text: 'また一緒にプログラミングしましょう！', intensity: 0.8 },
        { emotion: 'gentle', text: 'お疲れさまでした。ゆっくり休んでくださいね。', intensity: 0.6 }
      ],
      en: [
        { emotion: 'warm', text: 'Please come back again! Great job today♪', intensity: 0.8 },
        { emotion: 'grateful', text: 'Thank you so much! Have a wonderful day!', intensity: 0.7 },
        { emotion: 'excited', text: 'Let\'s code together again soon!', intensity: 0.8 },
        { emotion: 'gentle', text: 'Well done today. Please get some rest.', intensity: 0.6 }
      ]
    }
  };

  static getCacheKey(text: string, language: 'ja' | 'en'): string {
    const normalizedText = text.toLowerCase().trim();
    
    // Don't cache very long texts to prevent storage overflow
    if (normalizedText.length > this.MAX_TEXT_LENGTH) {
      return '';
    }
    
    // Create a hash-based cache key instead of encoding the full text
    const hash = this.hashString(normalizedText);
    return `${this.CACHE_PREFIX}${language}_${hash}`;
  }

  private static hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36); // Base36 for shorter strings
  }

  static async cacheResponse(response: Omit<CachedResponse, 'timestamp' | 'useCount'>): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(response.text, response.language);
      
      // Skip caching if text is too long or cache key is empty
      if (!cacheKey || response.text.length > this.MAX_TEXT_LENGTH) {
        console.log('[ResponseCache] Skipping cache - text too long or invalid key');
        return;
      }

      // Check storage space before caching
      if (!this.hasStorageSpace()) {
        console.log('[ResponseCache] Storage space low, cleaning up...');
        this.aggressiveCleanup();
        
        // Check again after cleanup
        if (!this.hasStorageSpace()) {
          console.warn('[ResponseCache] Storage still full after cleanup, skipping cache');
          return;
        }
      }

      const cachedResponse: CachedResponse = {
        ...response,
        timestamp: Date.now(),
        useCount: 0
      };

      // Store original text for hash collision detection
      const responseWithOriginal = {
        ...cachedResponse,
        originalText: response.text
      };

      localStorage.setItem(cacheKey, JSON.stringify(responseWithOriginal));
      this.cleanupOldCache();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[ResponseCache] Storage quota exceeded, clearing cache...');
        this.clearAllCache();
      } else {
        console.error('Failed to cache response:', error);
      }
    }
  }

  static getCachedResponse(text: string, language: 'ja' | 'en'): CachedResponse | null {
    try {
      const cacheKey = this.getCacheKey(text, language);
      if (!cacheKey) return null;
      
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const response: any = JSON.parse(cached);
      
      // Verify hash collision by checking original text if available
      if (response.originalText && response.originalText !== text) {
        console.log('[ResponseCache] Hash collision detected, removing invalid cache entry');
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      // Check if cache is expired
      const daysSinceCache = (Date.now() - response.timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceCache > this.CACHE_EXPIRY_DAYS) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Increment use count and update cache
      response.useCount = (response.useCount || 0) + 1;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(response));
      } catch (error) {
        // If we can't update the cache, still return the response
        console.warn('[ResponseCache] Could not update use count:', error);
      }

      // Return response without the originalText field
      const { originalText, ...cleanResponse } = response;
      return cleanResponse as CachedResponse;
    } catch (error) {
      console.error('Failed to get cached response:', error);
      return null;
    }
  }

  static getPredefinedResponse(
    category: keyof typeof ResponseCache.PREDEFINED_RESPONSES,
    language: 'ja' | 'en',
    preferredEmotion?: string
  ): EmotionalVariation | null {
    const responses = this.PREDEFINED_RESPONSES[category]?.[language];
    if (!responses || responses.length === 0) return null;

    // If preferred emotion is specified, try to find it
    if (preferredEmotion) {
      const emotionMatch = responses.find(r => r.emotion === preferredEmotion);
      if (emotionMatch) return emotionMatch;
    }

    // Otherwise, return a random variation
    return responses[Math.floor(Math.random() * responses.length)];
  }

  static getResponseByKeywords(
    text: string, 
    language: 'ja' | 'en'
  ): { category: string; response: EmotionalVariation } | null {
    const normalizedText = text.toLowerCase();
    
    // Keyword patterns for different categories
    const patterns = {
      greeting: {
        ja: ['こんにちは', 'おはよう', 'こんばんは', 'はじめまして', 'よろしく'],
        en: ['hello', 'hi', 'good morning', 'good evening', 'nice to meet']
      },
      encouragement: {
        ja: ['困った', '難しい', 'わからない', '悩んで', '疲れた', 'できない'],
        en: ['stuck', 'difficult', 'confused', 'tired', 'frustrated', 'help']
      },
      programming_help: {
        ja: ['プログラム', 'コード', 'エラー', 'バグ', 'デバッグ', '開発', 'アルゴリズム'],
        en: ['program', 'code', 'error', 'bug', 'debug', 'develop', 'algorithm']
      },
      goodbye: {
        ja: ['さようなら', 'また', 'ありがとう', 'おつかれ', 'バイバイ'],
        en: ['goodbye', 'bye', 'thank you', 'thanks', 'see you']
      }
    };

    for (const [category, keywords] of Object.entries(patterns)) {
      const keywordList = keywords[language] || [];
      const hasKeyword = keywordList.some(keyword => normalizedText.includes(keyword));
      
      if (hasKeyword) {
        const response = this.getPredefinedResponse(
          category as keyof typeof ResponseCache.PREDEFINED_RESPONSES,
          language
        );
        if (response) {
          return { category, response };
        }
      }
    }

    return null;
  }

  static async getQuickResponse(
    text: string,
    language: 'ja' | 'en',
    preferredEmotion?: string
  ): Promise<{ text: string; emotion: string; audioBase64?: string; cached: boolean } | null> {
    // First check local cache
    const cached = this.getCachedResponse(text, language);
    if (cached && cached.audioBase64) {
      return {
        text: cached.text,
        emotion: cached.emotion,
        audioBase64: cached.audioBase64,
        cached: true
      };
    }

    // Then check predefined responses
    const predefined = this.getResponseByKeywords(text, language);
    if (predefined) {
      return {
        text: predefined.response.text,
        emotion: predefined.response.emotion,
        audioBase64: predefined.response.audioBase64,
        cached: false
      };
    }

    return null;
  }

  static hasStorageSpace(): boolean {
    try {
      // Try to estimate available space by attempting a small write
      const testKey = 'storage_test_key';
      const testValue = 'test';
      localStorage.setItem(testKey, testValue);
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  static aggressiveCleanup(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.CACHE_PREFIX));
      
      if (keys.length === 0) return;

      // Get all cache items with metadata
      const cacheItems = keys.map(key => {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '');
          return { 
            key, 
            timestamp: item.timestamp || 0,
            useCount: item.useCount || 0,
            size: (localStorage.getItem(key) || '').length
          };
        } catch {
          return { key, timestamp: 0, useCount: 0, size: 0 };
        }
      });

      // Sort by priority: least used first, then oldest first
      cacheItems.sort((a, b) => {
        if (a.useCount !== b.useCount) {
          return a.useCount - b.useCount; // Less used first
        }
        return a.timestamp - b.timestamp; // Older first
      });

      // Remove half of the cache items
      const itemsToRemove = cacheItems.slice(0, Math.ceil(cacheItems.length / 2));
      itemsToRemove.forEach(item => {
        try {
          localStorage.removeItem(item.key);
        } catch (error) {
          console.warn(`Failed to remove cache item ${item.key}:`, error);
        }
      });

      console.log(`[ResponseCache] Aggressive cleanup completed: removed ${itemsToRemove.length} items`);
    } catch (error) {
      console.error('Failed to perform aggressive cleanup:', error);
    }
  }

  static cleanupOldCache(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.CACHE_PREFIX));
      
      // If we have too many cached items, remove the oldest ones
      if (keys.length > this.MAX_CACHE_SIZE) {
        const cacheItems = keys.map(key => {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '');
            return { key, timestamp: item.timestamp || 0, useCount: item.useCount || 0 };
          } catch {
            return { key, timestamp: 0, useCount: 0 };
          }
        }).sort((a, b) => {
          // Prioritize keeping frequently used items
          if (a.useCount !== b.useCount) {
            return a.useCount - b.useCount; // Remove least used first
          }
          return a.timestamp - b.timestamp; // Then oldest first
        });

        // Remove excess items
        const itemsToRemove = cacheItems.slice(0, keys.length - this.MAX_CACHE_SIZE);
        itemsToRemove.forEach(item => localStorage.removeItem(item.key));
      }

      // Remove expired items
      keys.forEach(key => {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '');
          const daysSinceCache = (Date.now() - (item.timestamp || 0)) / (1000 * 60 * 60 * 24);
          if (daysSinceCache > this.CACHE_EXPIRY_DAYS) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }

  static clearAllCache(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.CACHE_PREFIX));
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  static getCacheStats(): { totalItems: number; totalSize: number; oldestItem?: Date } {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.CACHE_PREFIX));
      let totalSize = 0;
      let oldestTimestamp = Infinity;

      keys.forEach(key => {
        const value = localStorage.getItem(key) || '';
        totalSize += value.length;
        
        try {
          const item = JSON.parse(value);
          if (item.timestamp && item.timestamp < oldestTimestamp) {
            oldestTimestamp = item.timestamp;
          }
        } catch {}
      });

      return {
        totalItems: keys.length,
        totalSize,
        oldestItem: oldestTimestamp === Infinity ? undefined : new Date(oldestTimestamp)
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { totalItems: 0, totalSize: 0 };
    }
  }
}