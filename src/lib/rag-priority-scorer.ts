/**
 * RAG検索結果の優先度スコアリングシステム
 * 
 * 質問の文脈に応じて検索結果を適切に優先順位付けし、
 * より実用的で正確な応答を生成するためのシステム
 */

export interface ScoredSearchResult {
  title: string;
  content: string;
  category: string;
  language: string;
  originalSimilarity: number;
  priorityScore: number;
  entity: 'engineer-cafe' | 'saino' | 'meeting-room' | 'general';
  relevanceFactors: {
    entityMatch: number;
    contextMatch: number;
    practicalValue: number;
    specificityScore: number;
  };
}

export class RAGPriorityScorer {
  /**
   * 検索結果に優先度スコアを付与
   */
  static scoreResults(
    results: any[],
    question: string,
    category: string,
    language: 'ja' | 'en'
  ): ScoredSearchResult[] {
    return results.map(result => {
      const entity = this.detectEntity(result);
      const relevanceFactors = this.calculateRelevanceFactors(
        result,
        question,
        category,
        entity,
        language
      );
      
      // 総合優先度スコアの計算
      const priorityScore = this.calculatePriorityScore(
        result.similarity,
        relevanceFactors,
        entity,
        category
      );
      
      return {
        ...result,
        entity,
        originalSimilarity: result.similarity,
        priorityScore,
        relevanceFactors
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * エンティティの検出
   */
  private static detectEntity(result: any): 'engineer-cafe' | 'saino' | 'meeting-room' | 'general' {
    const content = (result.title + ' ' + result.content).toLowerCase();
    const category = result.category?.toLowerCase() || '';
    
    // Sainoカフェの判定
    if (content.includes('saino') || category.includes('saino')) {
      return 'saino';
    }
    
    // 会議室の判定
    if (category.includes('meeting-room') || 
        (content.includes('会議室') && (content.includes('有料') || content.includes('料金')))) {
      return 'meeting-room';
    }
    
    // エンジニアカフェ本体の判定
    if (category.includes('engineer-cafe') || 
        content.includes('無料') || 
        content.includes('コワーキング') ||
        content.includes('9:00〜22:00')) {
      return 'engineer-cafe';
    }
    
    return 'general';
  }

  /**
   * 関連性要因の計算
   */
  private static calculateRelevanceFactors(
    result: any,
    question: string,
    category: string,
    entity: string,
    language: 'ja' | 'en'
  ): any {
    const content = result.content.toLowerCase();
    const normalizedQuestion = question.toLowerCase();
    
    // エンティティマッチスコア
    let entityMatch = 0.5; // デフォルト
    
    // 料金質問の場合
    if (category === 'pricing' || normalizedQuestion.includes('料金') || normalizedQuestion.includes('price')) {
      if (entity === 'engineer-cafe' && content.includes('無料')) {
        entityMatch = 1.0; // エンジニアカフェ無料情報を最優先
      } else if (entity === 'meeting-room') {
        entityMatch = 0.2; // 会議室料金は低優先度
      } else if (entity === 'saino') {
        entityMatch = 0.4; // Sainoの料金は中程度
      }
    }
    
    // 営業時間質問の場合
    if (category === 'hours' || normalizedQuestion.includes('営業時間') || normalizedQuestion.includes('hours')) {
      if (entity === 'engineer-cafe' && content.includes('9:00〜22:00')) {
        entityMatch = 0.9;
      } else if (entity === 'saino' && content.includes('ランチ') && content.includes('ディナー')) {
        entityMatch = 0.8;
      }
    }
    
    // 施設情報質問の場合（Wi-Fi、設備など）
    if (category === 'facility-info') {
      // Wi-Fi関連の質問
      if (normalizedQuestion.includes('wi-fi') || normalizedQuestion.includes('wifi') || 
          normalizedQuestion.includes('インターネット') || normalizedQuestion.includes('ネット')) {
        if (content.includes('wi-fi') || content.includes('wifi') || 
            content.includes('インターネット') || content.includes('ネット')) {
          entityMatch = 1.0; // Wi-Fi情報を含むコンテンツを最優先
        } else if (content.includes('無料') && content.includes('利用')) {
          entityMatch = 0.3; // 一般的な無料利用情報は低優先度
        }
      }
      // その他の設備関連
      else if (normalizedQuestion.includes('設備') || normalizedQuestion.includes('facility')) {
        if (content.includes('設備') || content.includes('facility')) {
          entityMatch = 0.9;
        }
      }
    }
    
    // コンテキストマッチスコア（改善版）
    const contextMatch = this.calculateEnhancedContextMatch(content, normalizedQuestion, category);
    
    // 実用価値スコア
    const practicalValue = this.calculatePracticalValue(content, category);
    
    // 具体性スコア
    const specificityScore = this.calculateSpecificityScore(content);
    
    return {
      entityMatch,
      contextMatch,
      practicalValue,
      specificityScore
    };
  }

  /**
   * コンテキストマッチの計算
   */
  private static calculateContextMatch(content: string, question: string): number {
    // 質問に含まれるキーワードがコンテンツにどれだけ含まれているか
    const keywords = question.split(/[\s、。,.\n]/).filter(k => k.length > 1);
    const matchCount = keywords.filter(keyword => 
      content.includes(keyword)
    ).length;
    
    return Math.min(matchCount / keywords.length, 1.0);
  }

  /**
   * 強化されたコンテキストマッチの計算
   */
  private static calculateEnhancedContextMatch(content: string, question: string, category: string): number {
    const normalizedContent = content.toLowerCase();
    const normalizedQuestion = question.toLowerCase();
    
    // 特定のトピックに対する専門的なキーワードマッチング
    if (category === 'facility-info') {
      // Wi-Fi関連
      if (normalizedQuestion.includes('wi-fi') || normalizedQuestion.includes('wifi')) {
        const wifiKeywords = ['wi-fi', 'wifi', '無線', 'インターネット', 'ネット', '接続', 'wireless', 'internet'];
        const matchCount = wifiKeywords.filter(keyword => normalizedContent.includes(keyword)).length;
        if (matchCount > 0) {
          return Math.min(0.8 + (matchCount * 0.05), 1.0);
        }
      }
      
      // 設備関連
      if (normalizedQuestion.includes('設備') || normalizedQuestion.includes('facility')) {
        const facilityKeywords = ['設備', '施設', 'スペース', '部屋', 'facility', 'equipment', 'room', 'space'];
        const matchCount = facilityKeywords.filter(keyword => normalizedContent.includes(keyword)).length;
        if (matchCount > 0) {
          return Math.min(0.7 + (matchCount * 0.05), 1.0);
        }
      }
    }
    
    // デフォルトのコンテキストマッチ計算
    return this.calculateContextMatch(normalizedContent, normalizedQuestion);
  }

  /**
   * 実用価値スコアの計算
   */
  private static calculatePracticalValue(content: string, category: string): number {
    let score = 0.5;
    
    // 実用的な情報を含むパターン
    const practicalPatterns = {
      ja: [
        '受付', 'スタッフ', '方法', '手順', 'お尋ねください',
        '利用できます', '必要です', '不要です', '〜してください'
      ],
      en: [
        'reception', 'staff', 'how to', 'method', 'please ask',
        'available', 'required', 'not required', 'please'
      ]
    };
    
    const patterns = [...practicalPatterns.ja, ...practicalPatterns.en];
    const matchCount = patterns.filter(pattern => 
      content.toLowerCase().includes(pattern)
    ).length;
    
    score += matchCount * 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * 具体性スコアの計算
   */
  private static calculateSpecificityScore(content: string): number {
    let score = 0.5;
    
    // 具体的な情報のパターン
    if (/\d{1,2}:\d{2}/.test(content)) score += 0.2; // 時刻
    if (/\d+円/.test(content) || /¥\d+/.test(content)) score += 0.2; // 金額
    if (/\d+名/.test(content) || /\d+人/.test(content)) score += 0.1; // 人数
    if (/\d+階/.test(content) || /地下/.test(content)) score += 0.1; // 場所
    
    return Math.min(score, 1.0);
  }

  /**
   * 総合優先度スコアの計算
   */
  private static calculatePriorityScore(
    similarity: number,
    relevanceFactors: any,
    entity: string,
    category: string
  ): number {
    // 重み付け
    const weights = {
      similarity: 0.3,
      entityMatch: 0.3,
      contextMatch: 0.2,
      practicalValue: 0.1,
      specificityScore: 0.1
    };
    
    // カテゴリ別の重み調整
    if (category === 'pricing') {
      weights.entityMatch = 0.4; // 料金質問ではエンティティマッチを重視
      weights.similarity = 0.2;
    } else if (category === 'hours') {
      weights.specificityScore = 0.2; // 営業時間では具体性を重視
    } else if (category === 'facility-info') {
      weights.contextMatch = 0.35; // 施設情報ではコンテキストマッチを重視
      weights.entityMatch = 0.35; // エンティティマッチも重視
      weights.similarity = 0.2;
      weights.practicalValue = 0.05;
      weights.specificityScore = 0.05;
    }
    
    const score = 
      similarity * weights.similarity +
      relevanceFactors.entityMatch * weights.entityMatch +
      relevanceFactors.contextMatch * weights.contextMatch +
      relevanceFactors.practicalValue * weights.practicalValue +
      relevanceFactors.specificityScore * weights.specificityScore;
    
    return score;
  }

  /**
   * 実用的な追加情報の生成
   */
  static generatePracticalAdvice(
    results: ScoredSearchResult[],
    question: string,
    category: string,
    language: 'ja' | 'en'
  ): string {
    const advice: string[] = [];
    
    // カテゴリ別の実用的アドバイス
    const practicalAdviceMap = {
      ja: {
        wifi: {
          trigger: ['wifi', 'wi-fi', 'パスワード'],
          advice: 'WiFiパスワードは受付でお尋ねください。'
        },
        crowded: {
          trigger: ['混雑', '空いて', '込んで'],
          advice: '土日の午後は混雑しやすいため、平日や朝の時間帯がおすすめです。'
        },
        firstTime: {
          trigger: ['初めて', 'はじめて', '初回'],
          advice: '初回利用時は受付で簡単な登録（お名前とメールアドレス）があります。'
        },
        event: {
          trigger: ['イベント', '参加', '勉強会'],
          advice: 'イベント情報は公式サイトやDiscordコミュニティでも確認できます。'
        }
      },
      en: {
        wifi: {
          trigger: ['wifi', 'password'],
          advice: 'Please ask the reception staff for the WiFi password.'
        },
        crowded: {
          trigger: ['crowded', 'busy', 'empty'],
          advice: 'Weekends tend to be crowded. Weekday mornings are recommended.'
        },
        firstTime: {
          trigger: ['first time', 'new'],
          advice: 'First-time visitors need to register at reception (name and email).'
        },
        event: {
          trigger: ['event', 'join', 'meetup'],
          advice: 'Event information is also available on the official website and Discord.'
        }
      }
    };
    
    const adviceSet = practicalAdviceMap[language];
    const normalizedQuestion = question.toLowerCase();
    
    Object.values(adviceSet).forEach(item => {
      if (item.trigger.some(trigger => normalizedQuestion.includes(trigger))) {
        advice.push(item.advice);
      }
    });
    
    // カテゴリ別の追加アドバイス
    if (category === 'facility-info' && advice.length === 0) {
      if (language === 'ja') {
        advice.push('詳しい設備の利用方法は現地スタッフにお気軽にお尋ねください。');
      } else {
        advice.push('Please feel free to ask the staff for detailed facility usage.');
      }
    }
    
    return advice.join(' ');
  }
}