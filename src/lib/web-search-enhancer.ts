/**
 * Web検索エンハンサー
 * 最新情報、臨時情報、競合比較などの実用的な情報取得
 */

export interface EnhancedWebSearchResult {
  type: 'news' | 'emergency' | 'comparison' | 'general';
  relevance: 'high' | 'medium' | 'low';
  summary: string;
  source: string;
  url?: string;
  publishedDate?: Date;
  practicalValue: number;
}

export class WebSearchEnhancer {
  /**
   * 質問のタイプに応じた戦略的Web検索
   */
  static async performStrategicSearch(
    question: string,
    category: string,
    language: 'ja' | 'en'
  ): Promise<{ query: string; searchType: string; filters: any }> {
    const searchType = this.determineSearchType(question, category);
    
    switch (searchType) {
      case 'latest-news':
        return this.buildNewsSearchQuery(question, language);
      
      case 'emergency-info':
        return this.buildEmergencySearchQuery(question, language);
      
      case 'comparison':
        return this.buildComparisonSearchQuery(question, language);
      
      case 'real-time-status':
        return this.buildRealTimeSearchQuery(question, language);
      
      default:
        return this.buildGeneralSearchQuery(question, language);
    }
  }

  /**
   * 検索タイプの判定
   */
  private static determineSearchType(question: string, category: string): string {
    const normalized = question.toLowerCase();
    
    // 最新ニュース
    if (normalized.includes('最新') || normalized.includes('ニュース') || 
        normalized.includes('news') || normalized.includes('recent')) {
      return 'latest-news';
    }
    
    // 緊急・臨時情報
    if (normalized.includes('臨時') || normalized.includes('休館') || 
        normalized.includes('台風') || normalized.includes('緊急') ||
        normalized.includes('closed') || normalized.includes('emergency')) {
      return 'emergency-info';
    }
    
    // 比較情報
    if (normalized.includes('比較') || normalized.includes('違い') ||
        normalized.includes('compare') || normalized.includes('versus') ||
        normalized.includes('他の')) {
      return 'comparison';
    }
    
    // リアルタイム状況
    if (normalized.includes('混雑') || normalized.includes('空いて') ||
        normalized.includes('crowded') || normalized.includes('busy')) {
      return 'real-time-status';
    }
    
    return 'general';
  }

  /**
   * ニュース検索クエリの構築
   */
  private static buildNewsSearchQuery(question: string, language: 'ja' | 'en'): any {
    const baseQuery = language === 'ja' 
      ? 'エンジニアカフェ福岡 最新情報'
      : 'Engineer Cafe Fukuoka latest news';
    
    return {
      query: `${baseQuery} ${new Date().getFullYear()}`,
      searchType: 'news',
      filters: {
        dateRange: 'past_month',
        sortBy: 'date',
        domains: ['engineer-cafe.com', 'fukuoka.lg.jp', 'connpass.com']
      }
    };
  }

  /**
   * 緊急情報検索クエリの構築
   */
  private static buildEmergencySearchQuery(question: string, language: 'ja' | 'en'): any {
    const today = new Date().toISOString().split('T')[0];
    const query = language === 'ja'
      ? `エンジニアカフェ福岡 臨時休館 お知らせ ${today}`
      : `Engineer Cafe Fukuoka closed notice ${today}`;
    
    return {
      query,
      searchType: 'emergency',
      filters: {
        dateRange: 'past_week',
        priority: 'official_sources',
        domains: ['engineer-cafe.com', 'twitter.com', 'x.com']
      }
    };
  }

  /**
   * 比較検索クエリの構築
   */
  private static buildComparisonSearchQuery(question: string, language: 'ja' | 'en'): any {
    const query = language === 'ja'
      ? '福岡 コワーキングスペース 比較 エンジニアカフェ'
      : 'Fukuoka coworking space comparison Engineer Cafe';
    
    return {
      query,
      searchType: 'comparison',
      filters: {
        includeTerms: ['料金', '設備', '特徴', 'price', 'facilities', 'features'],
        excludeDomains: ['engineer-cafe.com'] // 公式サイト以外から情報収集
      }
    };
  }

  /**
   * リアルタイム状況検索クエリの構築
   */
  private static buildRealTimeSearchQuery(question: string, language: 'ja' | 'en'): any {
    const query = language === 'ja'
      ? 'エンジニアカフェ福岡 混雑 空席 現在'
      : 'Engineer Cafe Fukuoka crowded availability now';
    
    return {
      query,
      searchType: 'real-time',
      filters: {
        dateRange: 'past_day',
        sources: ['twitter', 'instagram', 'google_maps']
      }
    };
  }

  /**
   * 一般検索クエリの構築
   */
  private static buildGeneralSearchQuery(question: string, language: 'ja' | 'en'): any {
    return {
      query: `エンジニアカフェ福岡 ${question}`,
      searchType: 'general',
      filters: {
        dateRange: 'past_year',
        language: language
      }
    };
  }

  /**
   * 検索結果の解析と実用的な情報の抽出
   */
  static analyzeSearchResults(
    results: any[],
    searchType: string,
    language: 'ja' | 'en'
  ): EnhancedWebSearchResult[] {
    return results.map(result => {
      const analysis = this.analyzeResult(result, searchType);
      
      return {
        type: this.determineResultType(result, searchType),
        relevance: analysis.relevance,
        summary: this.generateSummary(result, analysis, language),
        source: result.source || result.displayLink || 'Unknown',
        url: result.link,
        publishedDate: this.extractPublishedDate(result),
        practicalValue: analysis.practicalValue
      };
    }).sort((a, b) => {
      // 関連性と実用価値でソート
      const relevanceScore: Record<string, number> = { high: 3, medium: 2, low: 1 };
      return (relevanceScore[b.relevance] + b.practicalValue) - 
             (relevanceScore[a.relevance] + a.practicalValue);
    });
  }

  /**
   * 結果の解析
   */
  private static analyzeResult(result: any, searchType: string): any {
    let relevance: 'high' | 'medium' | 'low' = 'medium';
    let practicalValue = 0.5;
    
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const combined = title + ' ' + snippet;
    
    // 公式サイトからの情報は高評価
    if (result.displayLink?.includes('engineer-cafe.com')) {
      relevance = 'high';
      practicalValue += 0.3;
    }
    
    // 検索タイプ別の評価
    switch (searchType) {
      case 'emergency':
        if (combined.includes('臨時') || combined.includes('休館') || 
            combined.includes('お知らせ')) {
          relevance = 'high';
          practicalValue = 1.0;
        }
        break;
      
      case 'news':
        // 日付が新しいほど価値が高い
        const publishedDate = this.extractPublishedDate(result);
        if (publishedDate) {
          const daysAgo = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysAgo < 7) {
            relevance = 'high';
            practicalValue = 0.9;
          } else if (daysAgo < 30) {
            relevance = 'medium';
            practicalValue = 0.7;
          }
        }
        break;
      
      case 'comparison':
        if (combined.includes('比較') || combined.includes('違い') ||
            combined.includes('メリット')) {
          relevance = 'high';
          practicalValue = 0.8;
        }
        break;
    }
    
    return { relevance, practicalValue };
  }

  /**
   * 結果タイプの判定
   */
  private static determineResultType(result: any, searchType: string): 'news' | 'emergency' | 'comparison' | 'general' {
    const typeMap: Record<string, any> = {
      'news': 'news',
      'emergency': 'emergency',
      'comparison': 'comparison',
      'real-time': 'general',
      'general': 'general'
    };
    
    return typeMap[searchType] || 'general';
  }

  /**
   * サマリーの生成
   */
  private static generateSummary(result: any, analysis: any, language: 'ja' | 'en'): string {
    let summary = result.snippet || '';
    
    // HTMLタグの除去
    summary = summary.replace(/<[^>]*>/g, '');
    
    // 日付情報の追加
    const publishedDate = this.extractPublishedDate(result);
    if (publishedDate) {
      const dateStr = publishedDate.toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US');
      summary = `[${dateStr}] ${summary}`;
    }
    
    // 文字数制限
    if (summary.length > 200) {
      summary = summary.substring(0, 197) + '...';
    }
    
    return summary;
  }

  /**
   * 公開日の抽出
   */
  private static extractPublishedDate(result: any): Date | undefined {
    // メタデータから日付を探す
    if (result.pagemap?.metatags?.[0]?.['article:published_time']) {
      return new Date(result.pagemap.metatags[0]['article:published_time']);
    }
    
    // スニペットから日付パターンを探す
    const snippet = result.snippet || '';
    const datePattern = /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/;
    const match = snippet.match(datePattern);
    
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    
    return undefined;
  }

  /**
   * 実用的な情報への変換
   */
  static convertToPracticalInfo(
    searchResults: EnhancedWebSearchResult[],
    originalQuestion: string,
    language: 'ja' | 'en'
  ): string {
    if (searchResults.length === 0) {
      return language === 'ja' 
        ? '関連する最新情報は見つかりませんでした。'
        : 'No relevant recent information found.';
    }
    
    const highRelevanceResults = searchResults.filter(r => r.relevance === 'high');
    
    let info = '';
    
    // 緊急情報があれば最優先
    const emergencyInfo = searchResults.find(r => r.type === 'emergency' && r.relevance === 'high');
    if (emergencyInfo) {
      info += language === 'ja'
        ? `【重要】${emergencyInfo.summary}\n\n`
        : `[IMPORTANT] ${emergencyInfo.summary}\n\n`;
    }
    
    // その他の高関連性情報
    highRelevanceResults.forEach((result, index) => {
      if (result !== emergencyInfo && index < 3) {
        info += `${result.summary}\n`;
        if (result.url) {
          info += `詳細: ${result.url}\n\n`;
        }
      }
    });
    
    // 追加のアドバイス
    if (originalQuestion.includes('混雑') || originalQuestion.includes('crowded')) {
      info += language === 'ja'
        ? '\n※リアルタイムの混雑状況は現地でご確認いただくか、公式SNSをチェックすることをお勧めします。'
        : '\n*For real-time crowd information, please check on-site or follow official social media.';
    }
    
    return info.trim();
  }
}