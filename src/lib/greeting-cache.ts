/**
 * Greeting Cache System
 * Pre-generated greetings and TTS audio for faster initial responses
 */

export interface CachedGreeting {
  text: string;
  audioBase64?: string;
  language: 'ja' | 'en';
  emotion: string;
  timestamp: number;
}

export class GreetingCache {
  private static readonly CACHE_KEY = 'engineer_cafe_greetings';
  private static readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  // Pre-defined greeting templates
  private static readonly GREETING_TEMPLATES = {
    ja: [
      {
        text: '[greeting]はじめまして！[happy]エンジニアカフェナビゲーターです。[thinking]何かお手伝いできることはありますか？',
        emotion: 'greeting',
        contexts: ['initial', 'first_visit']
      },
      {
        text: '[happy]こんにちは！[greeting]お疲れさまです。[listening]今日はどのようなことでお越しでしょうか？',
        emotion: 'greeting',
        contexts: ['return_visit', 'daytime']
      },
      {
        text: '[greeting]ようこそエンジニアカフェへ！[happy]素敵な一日ですね。[thinking]何かご質問はありますか？',
        emotion: 'happy',
        contexts: ['welcome', 'general']
      }
    ],
    en: [
      {
        text: '[greeting]Hello there! [happy]I\'m the Engineer Cafe Navigator. [thinking]How can I help you today?',
        emotion: 'greeting',
        contexts: ['initial', 'first_visit']
      },
      {
        text: '[happy]Good to see you! [greeting]Welcome back. [listening]What brings you here today?',
        emotion: 'greeting',
        contexts: ['return_visit', 'daytime']
      },
      {
        text: '[greeting]Welcome to Engineer Cafe! [happy]It\'s a beautiful day. [thinking]Is there anything you\'d like to know?',
        emotion: 'happy',
        contexts: ['welcome', 'general']
      }
    ]
  };

  /**
   * Get a cached greeting or fallback to template
   */
  static getGreeting(language: 'ja' | 'en', context: string = 'initial'): CachedGreeting {
    const cached = this.getCachedGreetings();
    
    // Try to find a cached greeting for this language and context
    const cachedGreeting = cached.find(g => 
      g.language === language && 
      g.text.includes(context) &&
      !this.isExpired(g.timestamp)
    );
    
    if (cachedGreeting) {
      console.log('[GreetingCache] Using cached greeting');
      return cachedGreeting;
    }

    // Fallback to template
    const templates = this.GREETING_TEMPLATES[language];
    const template = templates.find(t => t.contexts.includes(context)) || templates[0];
    
    console.log('[GreetingCache] Using template greeting');
    return {
      text: template.text,
      language,
      emotion: template.emotion,
      timestamp: Date.now()
    };
  }

  /**
   * Cache a greeting with TTS audio
   */
  static cacheGreeting(greeting: CachedGreeting): void {
    try {
      const cached = this.getCachedGreetings();
      
      // Remove expired greetings
      const validGreetings = cached.filter(g => !this.isExpired(g.timestamp));
      
      // Add new greeting
      validGreetings.push(greeting);
      
      // Keep only the most recent 20 greetings per language
      const jaGreetings = validGreetings.filter(g => g.language === 'ja').slice(-10);
      const enGreetings = validGreetings.filter(g => g.language === 'en').slice(-10);
      
      const finalGreetings = [...jaGreetings, ...enGreetings];
      
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(finalGreetings));
      console.log('[GreetingCache] Cached greeting:', greeting.text.substring(0, 50) + '...');
    } catch (error) {
      console.warn('[GreetingCache] Failed to cache greeting:', error);
    }
  }

  /**
   * Get all cached greetings
   */
  private static getCachedGreetings(): CachedGreeting[] {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.warn('[GreetingCache] Failed to load cached greetings:', error);
      return [];
    }
  }

  /**
   * Check if a greeting is expired
   */
  private static isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.CACHE_EXPIRY;
  }

  /**
   * Clear all cached greetings
   */
  static clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      console.log('[GreetingCache] Cache cleared');
    } catch (error) {
      console.warn('[GreetingCache] Failed to clear cache:', error);
    }
  }

  /**
   * Pre-generate greetings for both languages
   */
  static async preGenerateGreetings(): Promise<void> {
    console.log('[GreetingCache] Pre-generating greetings...');
    
    for (const language of ['ja', 'en'] as const) {
      for (const template of this.GREETING_TEMPLATES[language]) {
        try {
          // Generate TTS for this greeting
          const response = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'text_to_speech',
              text: this.removeEmotionTags(template.text),
              language: language,
              sessionId: `cache_${Date.now()}`
            })
          });

          const result = await response.json();
          
          if (result.success && result.audioResponse) {
            // Cache the greeting with audio
            this.cacheGreeting({
              text: template.text,
              audioBase64: result.audioResponse,
              language,
              emotion: template.emotion,
              timestamp: Date.now()
            });
            
            console.log(`[GreetingCache] Pre-generated ${language} greeting`);
          }
        } catch (error) {
          console.warn(`[GreetingCache] Failed to pre-generate ${language} greeting:`, error);
        }
      }
    }
  }

  /**
   * Remove emotion tags from text for TTS
   */
  private static removeEmotionTags(text: string): string {
    return text.replace(/\[([a-zA-Z_]+)(?::([\d.]+))?\]/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    totalCached: number;
    japaneseGreetings: number;
    englishGreetings: number;
    withAudio: number;
  } {
    const cached = this.getCachedGreetings();
    
    return {
      totalCached: cached.length,
      japaneseGreetings: cached.filter(g => g.language === 'ja').length,
      englishGreetings: cached.filter(g => g.language === 'en').length,
      withAudio: cached.filter(g => g.audioBase64).length
    };
  }
}