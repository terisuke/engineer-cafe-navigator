import { z } from 'zod';
import { SupportedLanguage } from '../types/config';

export class LanguageSwitchTool {
  name = 'language-switch';
  description = 'Handle language switching and translation';

  schema = z.object({
    action: z.enum([
      'switchLanguage',
      'detectLanguage',
      'translateText',
      'getAvailableLanguages',
      'validateLanguage'
    ]),
    language: z.enum(['ja', 'en']).optional().describe('Target language'),
    text: z.string().optional().describe('Text to translate'),
    fromLanguage: z.string().optional().describe('Source language for translation'),
    audioInput: z.string().optional().describe('Audio input for language detection'),
  });

  private currentLanguage: SupportedLanguage = 'ja';
  private supportedLanguages: SupportedLanguage[] = ['ja', 'en'];

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const { action } = params;

      switch (action) {
        case 'switchLanguage':
          return await this.switchLanguage(params.language!);
        case 'detectLanguage':
          return await this.detectLanguage(params.text || params.audioInput!);
        case 'translateText':
          return await this.translateText(params.text!, params.fromLanguage, params.language);
        case 'getAvailableLanguages':
          return await this.getAvailableLanguages();
        case 'validateLanguage':
          return await this.validateLanguage(params.language!);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('Language switch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async switchLanguage(language: SupportedLanguage): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      if (!this.supportedLanguages.includes(language)) {
        return {
          success: false,
          error: `Unsupported language: ${language}. Supported languages: ${this.supportedLanguages.join(', ')}`,
        };
      }

      const previousLanguage = this.currentLanguage;
      this.currentLanguage = language;

      // Generate appropriate greeting/confirmation message
      const messages = {
        ja: {
          greeting: 'こんにちは！日本語でご案内いたします。',
          switched: '言語を日本語に変更しました。',
        },
        en: {
          greeting: 'Hello! I\'ll assist you in English.',
          switched: 'Language has been switched to English.',
        },
      };

      const isFirstTime = previousLanguage === language;
      const message = isFirstTime 
        ? messages[language].greeting 
        : messages[language].switched;

      return {
        success: true,
        result: {
          currentLanguage: language,
          previousLanguage,
          message,
          greeting: messages[language].greeting,
          voiceSettings: this.getVoiceSettingsForLanguage(language),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async detectLanguage(input: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // Simple language detection based on text patterns
      let detectedLanguage: SupportedLanguage = 'ja';
      let confidence = 0.5;

      if (input) {
        // Check for English patterns
        const englishPatterns = [
          /\b(the|and|or|but|in|on|at|to|for|with|by)\b/gi,
          /\b(hello|hi|yes|no|thank|please|welcome)\b/gi,
          /[a-zA-Z]/g,
        ];

        // Check for Japanese patterns
        const japanesePatterns = [
          /[\u3040-\u309F]/g, // Hiragana
          /[\u30A0-\u30FF]/g, // Katakana
          /[\u4E00-\u9FAF]/g, // Kanji
          /[。、]/g, // Japanese punctuation
        ];

        let englishScore = 0;
        let japaneseScore = 0;

        // Score for English
        englishPatterns.forEach(pattern => {
          const matches = input.match(pattern);
          if (matches) {
            englishScore += matches.length;
          }
        });

        // Score for Japanese
        japanesePatterns.forEach(pattern => {
          const matches = input.match(pattern);
          if (matches) {
            japaneseScore += matches.length;
          }
        });

        // Add debug logging
        console.log('[LanguageDetection] Input:', input);
        console.log('[LanguageDetection] English score:', englishScore);
        console.log('[LanguageDetection] Japanese score:', japaneseScore);

        // Determine language and confidence
        // Give Japanese higher priority - if there's ANY Japanese text, it's likely Japanese
        if (japaneseScore > 0) {
          detectedLanguage = 'ja';
          confidence = Math.min(0.95, 0.7 + (japaneseScore / (englishScore + japaneseScore)) * 0.25);
        } else if (englishScore > japaneseScore) {
          detectedLanguage = 'en';
          confidence = Math.min(0.95, 0.5 + (englishScore / (englishScore + japaneseScore)) * 0.45);
        } else if (japaneseScore > englishScore) {
          detectedLanguage = 'ja';
          confidence = Math.min(0.95, 0.5 + (japaneseScore / (englishScore + japaneseScore)) * 0.45);
        }

        // Special cases
        if (input.trim().toLowerCase() === 'english') {
          detectedLanguage = 'en';
          confidence = 0.99;
        } else if (input.trim() === '日本語' || input.trim() === 'にほんご') {
          detectedLanguage = 'ja';
          confidence = 0.99;
        }
      }

      return {
        success: true,
        result: {
          detectedLanguage,
          confidence,
          input,
          details: {
            inputLength: input.length,
            hasEnglish: /[a-zA-Z]/.test(input),
            hasJapanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(input),
          },
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async translateText(
    text: string, 
    fromLanguage?: string, 
    toLanguage?: SupportedLanguage
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // If no target language specified, use current language
      const targetLanguage = toLanguage || this.currentLanguage;
      
      // If no source language specified, detect it
      let sourceLanguage = fromLanguage;
      if (!sourceLanguage) {
        const detection = await this.detectLanguage(text);
        if (detection.success) {
          sourceLanguage = detection.result.detectedLanguage;
        } else {
          sourceLanguage = 'ja'; // Default fallback
        }
      }

      // Don't translate if source and target are the same
      if (sourceLanguage === targetLanguage) {
        return {
          success: true,
          result: {
            translatedText: text,
            sourceLanguage,
            targetLanguage,
            skipped: true,
            reason: 'Source and target languages are the same',
          },
        };
      }

      // TODO: Implement actual translation using Google Cloud Translation API
      // For now, provide some common phrase translations
      const translatedText = await this.performTranslation(text, sourceLanguage || 'auto', targetLanguage);

      return {
        success: true,
        result: {
          translatedText,
          originalText: text,
          sourceLanguage,
          targetLanguage,
          skipped: false,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async performTranslation(
    text: string, 
    from: string, 
    to: SupportedLanguage
  ): Promise<string> {
    // Simple phrase translations for common expressions
    const translations: Record<string, Record<string, string>> = {
      // English to Japanese
      'en->ja': {
        'hello': 'こんにちは',
        'hi': 'こんにちは',
        'thank you': 'ありがとうございます',
        'thank': 'ありがとう',
        'welcome': 'ようこそ',
        'goodbye': 'さようなら',
        'yes': 'はい',
        'no': 'いいえ',
        'please': 'お願いします',
        'excuse me': 'すみません',
        'i have a question': '質問があります',
        'question': '質問',
        'help': '助け',
        'next': '次',
        'previous': '前',
        'start': '開始',
        'stop': '停止',
      },
      // Japanese to English
      'ja->en': {
        'こんにちは': 'hello',
        'こんばんは': 'good evening',
        'おはようございます': 'good morning',
        'ありがとう': 'thank you',
        'ありがとうございます': 'thank you very much',
        'すみません': 'excuse me',
        'ようこそ': 'welcome',
        'さようなら': 'goodbye',
        'はい': 'yes',
        'いいえ': 'no',
        'お願いします': 'please',
        '質問': 'question',
        '質問があります': 'I have a question',
        '助けて': 'help',
        '次': 'next',
        '前': 'previous',
        '開始': 'start',
        '停止': 'stop',
      },
    };

    const translationKey = `${from}->${to}`;
    const translationMap = translations[translationKey] || {};
    
    // Check for exact phrase matches first
    const lowerText = text.toLowerCase().trim();
    if (translationMap[lowerText]) {
      return translationMap[lowerText];
    }

    // TODO: For production, use Google Cloud Translation API here
    // For now, return original text with a note
    return `[Translation needed: ${text}]`;
  }

  private async getAvailableLanguages(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const languageInfo = {
      ja: {
        name: '日本語',
        englishName: 'Japanese',
        code: 'ja',
        flag: '🇯🇵',
        voice: {
          male: 'ja-JP-Neural2-C',
          female: 'ja-JP-Neural2-B',
          default: 'ja-JP-Neural2-B',
        },
      },
      en: {
        name: 'English',
        englishName: 'English',
        code: 'en',
        flag: '🇺🇸',
        voice: {
          male: 'en-US-Neural2-D',
          female: 'en-US-Neural2-F',
          default: 'en-US-Neural2-F',
        },
      },
    };

    return {
      success: true,
      result: {
        supported: this.supportedLanguages,
        current: this.currentLanguage,
        details: languageInfo,
      },
    };
  }

  private async validateLanguage(language: SupportedLanguage): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const isValid = this.supportedLanguages.includes(language);

    return {
      success: true,
      result: {
        language,
        isValid,
        supported: this.supportedLanguages,
        message: isValid 
          ? `Language ${language} is supported` 
          : `Language ${language} is not supported`,
      },
    };
  }

  private getVoiceSettingsForLanguage(language: SupportedLanguage) {
    const voiceSettings = {
      ja: {
        speaker: 'ja-JP-Neural2-B',
        speed: 1.0,
        pitch: 0,
        volumeGainDb: 0,
      },
      en: {
        speaker: 'en-US-Neural2-F',
        speed: 1.0,
        pitch: 0,
        volumeGainDb: 0,
      },
    };

    return voiceSettings[language];
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return [...this.supportedLanguages];
  }

  async autoDetectAndSwitch(input: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const detection = await this.detectLanguage(input);
      
      if (!detection.success) {
        return detection;
      }

      const detectedLanguage = detection.result.detectedLanguage;
      const confidence = detection.result.confidence;

      // Only auto-switch if confidence is high enough
      if (confidence >= 0.8 && detectedLanguage !== this.currentLanguage) {
        const switchResult = await this.switchLanguage(detectedLanguage);
        
        return {
          success: true,
          result: {
            ...switchResult.result,
            autoSwitched: true,
            detection: detection.result,
          },
        };
      }

      return {
        success: true,
        result: {
          autoSwitched: false,
          reason: confidence < 0.8 ? 'Low confidence' : 'Already current language',
          detection: detection.result,
          currentLanguage: this.currentLanguage,
        },
      };
    } catch (error) {
      throw error;
    }
  }
}
