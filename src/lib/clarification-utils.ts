/**
 * Utility functions for detecting and handling clarification messages
 * Centralized logic to avoid duplication across agents
 */

export interface ClarificationPattern {
  japanese: string[];
  english: string[];
}

export class ClarificationUtils {
  private static readonly CLARIFICATION_PATTERNS: ClarificationPattern = {
    japanese: [
      'のことですか、それとも',
      'どちらのことですか',
      'どれのことですか',
      'どちらを',
      'どれを',
      'どちらか',
      'どれか',
      'どちらについて',
      'お聞かせください',
      'お知りになりたいですか'
    ],
    english: [
      'are you asking about',
      'do you mean',
      'are you referring to',
      'which one',
      'which do you mean',
      'or'
    ]
  };

  /**
   * Check if the text contains clarification patterns
   */
  static isClarificationMessage(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    const lowerText = text.toLowerCase();
    
    // Check Japanese patterns
    const hasJapanesePattern = this.CLARIFICATION_PATTERNS.japanese.some(
      pattern => lowerText.includes(pattern)
    );

    // Check English patterns
    const hasEnglishPattern = this.CLARIFICATION_PATTERNS.english.some(
      pattern => lowerText.includes(pattern)
    );

    return hasJapanesePattern || hasEnglishPattern;
  }

  /**
   * Check if text contains "or" pattern suggesting multiple options
   */
  static hasOrPattern(text: string): boolean {
    const lowerText = text.toLowerCase();
    return lowerText.includes(' or ') || lowerText.includes('、それとも') || lowerText.includes('それとも');
  }

  /**
   * Extract clarification options from text
   */
  static extractClarificationOptions(text: string): string[] {
    const options: string[] = [];
    
    // Japanese pattern: "AのことですかBのことですか"
    const japaneseMatch = text.match(/(.+?)のことですか[、,]?\s*それとも\s*(.+?)のことですか/);
    if (japaneseMatch) {
      options.push(japaneseMatch[1].trim(), japaneseMatch[2].trim());
    }

    // English pattern: "A or B"
    const englishMatch = text.match(/asking about (.+?) or (.+?)\?/);
    if (englishMatch) {
      options.push(englishMatch[1].trim(), englishMatch[2].trim());
    }

    return options;
  }

  /**
   * Validate clarification message structure
   */
  static isValidClarification(text: string): boolean {
    return (
      this.isClarificationMessage(text) &&
      this.hasOrPattern(text) &&
      this.extractClarificationOptions(text).length >= 2
    );
  }

  /**
   * Get all clarification patterns for debugging
   */
  static getAllPatterns(): ClarificationPattern {
    return { ...this.CLARIFICATION_PATTERNS };
  }
}