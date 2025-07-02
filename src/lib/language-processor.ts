/**
 * LanguageProcessor - 言語処理専用クラス
 * 言語の検出、応答言語の決定、翻訳処理などを担当
 */

import { SupportedLanguage } from '../mastra/types/config';

export interface LanguageDetectionResult {
  detectedLanguage: SupportedLanguage;
  confidence: number;
  isMixed: boolean;
  languages?: {
    primary: SupportedLanguage;
    secondary?: SupportedLanguage;
  };
}

export interface LanguageProcessingOptions {
  forceLanguage?: SupportedLanguage;
  preferredLanguage?: SupportedLanguage;
  allowMixed?: boolean;
}

export class LanguageProcessor {
  private debugMode: boolean;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
  }

  /**
   * クエリの言語を検出する
   */
  public detectLanguage(text: string): LanguageDetectionResult {
    const normalizedText = text.toLowerCase();
    
    // 日本語文字のパターン
    const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
    const hasJapanese = japanesePattern.test(text);
    
    // 英語の一般的な単語パターン
    const englishWords = [
      'what', 'where', 'when', 'how', 'why', 'is', 'are', 'the', 'a', 'an',
      'engineer', 'cafe', 'about', 'tell', 'me', 'please', 'hours', 'location'
    ];
    const englishWordCount = englishWords.filter(word => 
      normalizedText.includes(word)
    ).length;
    
    // 日本語の助詞・文末表現
    const japaneseParticles = ['は', 'が', 'を', 'に', 'で', 'の', 'か', 'です', 'ます', 'ください'];
    const hasJapaneseParticles = japaneseParticles.some(particle => 
      text.includes(particle)
    );
    
    // 混合言語の検出
    const hasLatinChars = /[a-zA-Z]/.test(text);
    const isMixed = hasJapanese && hasLatinChars;
    
    // 言語判定ロジック
    if (hasJapanese && (hasJapaneseParticles || !hasLatinChars)) {
      // 日本語優位
      return {
        detectedLanguage: 'ja',
        confidence: hasJapaneseParticles ? 0.9 : 0.7,
        isMixed: isMixed,
        languages: isMixed ? {
          primary: 'ja',
          secondary: 'en'
        } : { primary: 'ja' }
      };
    } else if (!hasJapanese && englishWordCount >= 2) {
      // 純粋な英語
      return {
        detectedLanguage: 'en',
        confidence: 0.9,
        isMixed: false,
        languages: { primary: 'en' }
      };
    } else if (isMixed) {
      // 混合言語 - コンテキストから判断
      const primaryLang = hasJapaneseParticles || 
                         (text.match(japanesePattern) || []).length > 
                         (text.match(/[a-zA-Z]+/g) || []).join('').length
                         ? 'ja' : 'en';
      
      return {
        detectedLanguage: primaryLang,
        confidence: 0.6,
        isMixed: true,
        languages: {
          primary: primaryLang,
          secondary: primaryLang === 'ja' ? 'en' : 'ja'
        }
      };
    }
    
    // デフォルト
    return {
      detectedLanguage: 'ja',
      confidence: 0.5,
      isMixed: false,
      languages: { primary: 'ja' }
    };
  }

  /**
   * 応答言語を決定する
   */
  public determineResponseLanguage(
    queryLanguage: LanguageDetectionResult,
    options: LanguageProcessingOptions = {}
  ): SupportedLanguage {
    // 強制言語指定がある場合
    if (options.forceLanguage) {
      if (this.debugMode) {
        console.log('[LanguageProcessor] Using forced language:', options.forceLanguage);
      }
      return options.forceLanguage;
    }
    
    // 明確な言語検出の場合
    if (queryLanguage.confidence >= 0.8 && !queryLanguage.isMixed) {
      if (this.debugMode) {
        console.log('[LanguageProcessor] Using detected language with high confidence:', queryLanguage.detectedLanguage);
      }
      return queryLanguage.detectedLanguage;
    }
    
    // 混合言語の場合
    if (queryLanguage.isMixed) {
      // 優先言語が設定されている場合
      if (options.preferredLanguage) {
        if (this.debugMode) {
          console.log('[LanguageProcessor] Mixed query, using preferred language:', options.preferredLanguage);
        }
        return options.preferredLanguage;
      }
      
      // プライマリ言語を使用
      if (this.debugMode) {
        console.log('[LanguageProcessor] Mixed query, using primary language:', queryLanguage.languages?.primary);
      }
      return queryLanguage.languages?.primary || 'ja';
    }
    
    // デフォルト
    return queryLanguage.detectedLanguage;
  }

  /**
   * 言語タグを応答に適用する
   * 既存のemotionタグと併用可能
   */
  public applyLanguageTag(response: string, language: SupportedLanguage): string {
    // 既存のemotionタグを保持しつつ、言語情報を追加
    // 現在の実装では特に変更なし（将来の拡張用）
    return response;
  }

  /**
   * 応答言語が質問言語と一致しているかチェック
   */
  public isLanguageMatched(
    query: string,
    response: string,
    expectedLanguage: SupportedLanguage
  ): boolean {
    const responseDetection = this.detectLanguage(response);
    
    if (this.debugMode) {
      console.log('[LanguageProcessor] Language match check:');
      console.log(`  Expected: ${expectedLanguage}`);
      console.log(`  Detected in response: ${responseDetection.detectedLanguage}`);
      console.log(`  Match: ${responseDetection.detectedLanguage === expectedLanguage}`);
    }
    
    return responseDetection.detectedLanguage === expectedLanguage;
  }

  /**
   * デバッグ情報を出力
   */
  public logDetection(text: string, result: LanguageDetectionResult): void {
    if (this.debugMode) {
      console.log('[LanguageProcessor] Language detection:');
      console.log(`  Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      console.log(`  Detected: ${result.detectedLanguage}`);
      console.log(`  Confidence: ${result.confidence}`);
      console.log(`  Mixed: ${result.isMixed}`);
      if (result.languages) {
        console.log(`  Languages:`, result.languages);
      }
    }
  }
}