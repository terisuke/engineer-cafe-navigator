/**
 * STT (Speech-to-Text) correction system
 * Fixes common misrecognitions from Google Cloud Speech-to-Text
 */

interface CorrectionPattern {
  patterns: RegExp[];
  replacement: string;
  context?: string;
}

export class STTCorrection {
  private static corrections: CorrectionPattern[] = [
    // エンジニアカフェの誤認識パターン
    {
      patterns: [
        /エンジンカフェ/gi,
        /エンジニアカフ/gi,
        /エンジニアかふぇ/gi,
        /エンジニア壁/gi,
        /エンジニア加工/gi,
        /エンジニア課/gi,
        /エンジニアカベ/gi,
        /エンジニアかべ/gi,
        /engineer\s*cafe/gi,
        /engineer\s*coffee/gi,
        /engineer\s*wall/gi
      ],
      replacement: 'エンジニアカフェ'
    },
    
    // サイノカフェの誤認識パターン
    {
      patterns: [
        /カフェアンドバー[\s]*才能/gi,
        /カフェ[\s]*アンド[\s]*バー[\s]*才能/gi,
        /cafe[\s]*and[\s]*bar[\s]*才能/gi,
        /カフェアンドバー[\s]*サイノ/gi,
        /才能[\s]*カフェ/gi,
        /才能[\s]*cafe/gi,
        /再能[\s]*カフェ/gi,
        /最能[\s]*カフェ/gi,
        /採納[\s]*カフェ/gi,
        /彩野[\s]*カフェ/gi,
        /さいのう[\s]*カフェ/gi,
        /さいのう[\s]*cafe/gi,
        /サイノウ[\s]*カフェ/gi,
        /サイナ[\s]*カフェ/gi,
        /サイの[\s]*カフェ/gi,
        /さいの[\s]*カフェ/gi,
        /さいな[\s]*カフェ/gi,
        /才の[\s]*カフェ/gi,
        /才納[\s]*カフェ/gi,
        /才脳[\s]*カフェ/gi,
        /歳納[\s]*カフェ/gi,
        /財野[\s]*カフェ/gi,
        /財納[\s]*カフェ/gi,
        /saino[\s]*カフェ/gi,
        /saino[\s]*cafe/gi,
        /cyno[\s]*cafe/gi,
        /sino[\s]*cafe/gi,
        /saino\s*カフェ/gi,  // sainoカフェのパターンを追加
        /さいの\s*カフェ/gi,
        /サイノ\s*カフェ/gi
      ],
      replacement: 'サイノカフェ'
    },
    
    // 地下/階下の誤認識パターン
    {
      patterns: [
        /階下/g,
        /ちか/g,  // "地下"の誤認識
        /チカ/g
      ],
      replacement: '地下',
      context: 'スペース|会議室|MTG|ミーティング'
    },
    
    // MTGスペースの誤認識パターン
    {
      patterns: [
        /m[\s]*t[\s]*g[\s]*スペース/gi,
        /エムティージー[\s]*スペース/gi,
        /meeting[\s]*スペース/gi
      ],
      replacement: 'MTGスペース'
    },
    
    // Wi-Fiの誤認識パターン
    {
      patterns: [
        /ワイファイ/g,
        /わいふぁい/g,
        /ウィーフィー/g,
        /wife[\s]*i/gi,
        /why[\s]*fi/gi,
        /Y[\s]*fi/gi
      ],
      replacement: 'Wi-Fi'
    },
    
    // 営業時間の誤認識パターン
    {
      patterns: [
        /営業[\s]*時間/g,
        /開いてる[\s]*時間/g,
        /開店[\s]*時間/g
      ],
      replacement: '営業時間'
    },
    
    // カフェ自体の誤認識パターン（才能系を含む）
    {
      patterns: [
        /才能[\s]*カヘ/gi,
        /才能[\s]*カペ/gi,
        /才能[\s]*かへ/gi,
        /才能[\s]*かぺ/gi,
        /才能[\s]*カファ/gi,
        /才能[\s]*かふぁ/gi,
        /再能[\s]*カヘ/gi,
        /再能[\s]*カペ/gi,
        /最能[\s]*カヘ/gi,
        /最能[\s]*カペ/gi
      ],
      replacement: 'サイノカフェ'
    },
    
    // カフェ自体の誤認識パターン（通常）
    {
      patterns: [
        /カヘ/g,
        /カペ/g,
        /かへ/g,
        /かぺ/g,
        /カファ/g,
        /かふぁ/g,
        /cafe/gi
      ],
      replacement: 'カフェ',
      // エンジニアやサイノの後にある場合のみ変換
      context: 'エンジニア|サイノ|才能|engineer|saino'
    },
    
    // 会議室の誤認識パターン
    {
      patterns: [
        /会議質/g,
        /開議室/g,
        /階議室/g,
        /回議室/g,
        /かいぎしつ/g,
        /カイギシツ/g
      ],
      replacement: '会議室'
    },
    
    // 集中スペースの誤認識パターン
    {
      patterns: [
        /集中すぺーす/g,
        /集中スペース/g,
        /収集スペース/g,
        /終日スペース/g,
        /習中スペース/g
      ],
      replacement: '集中スペース'
    },
    
    // アンダースペースの誤認識パターン
    {
      patterns: [
        /アンダーすぺーす/g,
        /アンダすペース/g,
        /under[\s]*space/gi,
        /under[\s]*スペース/gi
      ],
      replacement: 'アンダースペース'
    },
    
    // Makersスペースの誤認識パターン  
    {
      patterns: [
        /メーカーズ[\s]*スペース/g,
        /メイカーズ[\s]*スペース/g,
        /makers[\s]*space/gi,
        /maker[\s]*space/gi,
        /メーカー[\s]*スペース/g
      ],
      replacement: 'Makersスペース'
    }
  ];
  
  /**
   * Apply STT corrections to the transcribed text
   */
  static correct(text: string): string {
    if (!text) return text;
    
    let correctedText = text;
    
    for (const correction of this.corrections) {
      // Check if context is required and present
      if (correction.context) {
        const contextRegex = new RegExp(correction.context, 'i');
        if (!contextRegex.test(correctedText)) {
          continue;
        }
      }
      
      // Apply all patterns for this correction
      for (const pattern of correction.patterns) {
        correctedText = correctedText.replace(pattern, correction.replacement);
      }
    }
    
    // 追加の正規化処理
    correctedText = this.normalizeSpaces(correctedText);
    correctedText = this.fixPunctuation(correctedText);
    
    // Log corrections for debugging
    if (correctedText !== text) {
      console.log('[STTCorrection] Applied corrections:', {
        original: text,
        corrected: correctedText
      });
    }
    
    return correctedText;
  }
  
  /**
   * Normalize spaces and remove unnecessary ones
   */
  private static normalizeSpaces(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\s+([。、！？])/g, '$1') // Remove spaces before punctuation
      .replace(/じゃ\s+/g, 'じゃ') // Remove space after じゃ
      .trim();
  }
  
  /**
   * Fix punctuation issues
   */
  private static fixPunctuation(text: string): string {
    return text
      .replace(/。+/g, '。') // Multiple periods to single
      .replace(/、+/g, '、') // Multiple commas to single
      .replace(/([^。！？])$/g, '$1。'); // Add period at end if missing
  }
  
  /**
   * Add custom correction pattern
   */
  static addCorrection(pattern: CorrectionPattern): void {
    this.corrections.push(pattern);
  }
  
  /**
   * Test correction system with sample inputs
   */
  static test(): void {
    const testCases = [
      'エンジンカフェの営業時間は？',
      '才能 cafeの方で。',
      'じゃカフェアンドバー 才能の？',
      'カフェアンドバー 才能の営業時間って知らないの？',
      '階下のMTGスペースについて',
      'ワイファイは使えますか？',
      'engineer cafeの場所はどこ？'
    ];
    
    console.log('[STTCorrection] Testing correction patterns:');
    for (const testCase of testCases) {
      const corrected = this.correct(testCase);
      console.log(`  "${testCase}" → "${corrected}"`);
    }
  }
}