/**
 * STT (Speech-to-Text) Correction Utilities
 * 
 * This module handles common misrecognitions from Google Cloud Speech-to-Text,
 * particularly for Japanese language processing where certain words are frequently
 * misheard due to similar phonetics.
 */

interface CorrectionRule {
  pattern: RegExp;
  replacement: string;
  context?: RegExp; // Optional context to check before applying correction
  description: string;
}

// Define correction rules for common STT misrecognitions
export const CORRECTION_RULES: CorrectionRule[] = [
  // Cafe/Wall confusion - Most common issue
  {
    pattern: /エンジニア壁/g,
    replacement: 'エンジニアカフェ',
    description: 'Engineer Cafe misheard as Engineer Wall'
  },
  {
    pattern: /壁の/g,
    replacement: 'カフェの',
    context: /(?:エンジニア|営業|利用|場所|時間|料金|設備|サービス)/,
    description: 'Cafe misheard as wall in context'
  },
  {
    pattern: /壁は/g,
    replacement: 'カフェは',
    context: /(?:エンジニア|営業|利用|場所|時間|料金|設備|サービス)/,
    description: 'Cafe misheard as wall with は particle'
  },
  {
    pattern: /壁で/g,
    replacement: 'カフェで',
    context: /(?:エンジニア|営業|利用|場所|時間|料金|設備|サービス|働|作業|勉強)/,
    description: 'Cafe misheard as wall with で particle'
  },
  {
    pattern: /壁に/g,
    replacement: 'カフェに',
    context: /(?:エンジニア|行|来|ある|入|営業|利用)/,
    description: 'Cafe misheard as wall with に particle'
  },
  
  // Common business/technical terms
  {
    pattern: /engineer confess/gi,
    replacement: 'Engineer Cafe',
    description: 'English: Engineer Cafe misheard as confess'
  },
  {
    pattern: /engineer conference/gi,
    replacement: 'Engineer Cafe',
    description: 'English: Engineer Cafe misheard as conference'
  },
  {
    pattern: /engineer campus/gi,
    replacement: 'Engineer Cafe',
    description: 'English: Engineer Cafe misheard as campus'
  },
  
  // Other common Japanese misrecognitions
  {
    pattern: /会議室/g,
    replacement: '会議室',
    context: /壁/,
    description: 'Prevent over-correction when actually talking about walls in meeting rooms'
  }
];

/**
 * Apply STT corrections to the transcribed text
 * @param transcript The raw transcript from STT
 * @param language The language of the transcript
 * @param confidence Optional confidence score from STT
 * @returns The corrected transcript
 */
export function applySttCorrections(transcript: string, language: string = 'ja', confidence?: number): string {
  if (!transcript || typeof transcript !== 'string') {
    return transcript;
  }

  let corrected = transcript;
  const corrections: string[] = [];

  // Apply each correction rule
  for (const rule of CORRECTION_RULES) {
    // Check if context is required and matches
    if (rule.context) {
      if (!rule.context.test(corrected)) {
        continue; // Skip this rule if context doesn't match
      }
    }

    // Check if the pattern matches
    if (rule.pattern.test(corrected)) {
      const before = corrected;
      corrected = corrected.replace(rule.pattern, rule.replacement);
      
      if (before !== corrected) {
        corrections.push(rule.description);
      }
    }
  }

  // Log corrections if any were made
  if (corrections.length > 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[STT Corrections] Original:', transcript);
      console.log('[STT Corrections] Corrected:', corrected);
      console.log('[STT Corrections] Rules applied:', corrections);
    }

    // Log to monitoring system (lazy import to avoid circular dependencies)
    try {
      const { SttCorrectionMonitor } = require('../lib/stt-correction-monitor');
      SttCorrectionMonitor.logCorrection(transcript, corrected, language, confidence, corrections);
    } catch (error) {
      // Ignore monitoring errors
    }
  }

  return corrected;
}

/**
 * Check if a transcript likely contains misrecognized words
 * @param transcript The transcript to check
 * @returns True if likely contains misrecognitions
 */
export function likelyContainsMisrecognition(transcript: string): boolean {
  if (!transcript) return false;
  
  // Check for common misrecognition patterns
  const suspiciousPatterns = [
    /壁(?=の|は|で|に|を)/, // Wall followed by particles
    /エンジニア壁/,
    /engineer conf/i,
    /engineer camp/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(transcript));
}

/**
 * Get confidence adjustment based on whether corrections were applied
 * If significant corrections were made, we might want to slightly reduce confidence
 * @param originalTranscript The original transcript
 * @param correctedTranscript The corrected transcript
 * @param originalConfidence The original confidence score
 * @returns Adjusted confidence score
 */
export function adjustConfidenceAfterCorrection(
  originalTranscript: string,
  correctedTranscript: string,
  originalConfidence: number
): number {
  if (originalTranscript === correctedTranscript) {
    return originalConfidence;
  }

  // If corrections were made, slightly reduce confidence
  // but not by too much as our corrections are based on common patterns
  const reductionFactor = 0.95; // Reduce by 5%
  return originalConfidence * reductionFactor;
}

/**
 * Analyze and report STT quality metrics
 * Useful for monitoring and improving the correction rules
 */
export function analyzeSttQuality(transcripts: Array<{ original: string; corrected: string }>) {
  const stats = {
    total: transcripts.length,
    corrected: 0,
    correctionTypes: new Map<string, number>(),
  };

  for (const { original, corrected } of transcripts) {
    if (original !== corrected) {
      stats.corrected++;
      
      // Track which rules were applied
      for (const rule of CORRECTION_RULES) {
        if (rule.pattern.test(original)) {
          const count = stats.correctionTypes.get(rule.description) || 0;
          stats.correctionTypes.set(rule.description, count + 1);
        }
      }
    }
  }

  return {
    ...stats,
    correctionRate: stats.total > 0 ? stats.corrected / stats.total : 0,
    mostCommonCorrections: Array.from(stats.correctionTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  };
}