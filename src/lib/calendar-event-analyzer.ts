/**
 * カレンダーイベント解析システム
 * イベントの参加可否判定、実用的な情報の抽出、推薦機能
 */

export interface EventAnalysis {
  canParticipate: boolean;
  participationMethod: string;
  requiresRegistration: boolean;
  registrationUrl?: string;
  eventType: 'public' | 'private' | 'rental' | 'community';
  relatedEvents: EventInfo[];
  practicalInfo: string;
}

export interface EventInfo {
  title: string;
  date: Date;
  time: string;
  description?: string;
  location?: string;
  isRecurring?: boolean;
}

export class CalendarEventAnalyzer {
  /**
   * イベント情報を解析して参加可否を判定
   */
  static analyzeEvent(event: any, language: 'ja' | 'en' = 'ja'): EventAnalysis {
    const title = event.summary || event.title || '';
    const description = event.description || '';
    const location = event.location || '';
    
    // イベントタイプの判定
    const eventType = this.determineEventType(title, description);
    
    // 参加可否の判定
    const canParticipate = this.canParticipate(eventType, title, description);
    
    // 参加方法の決定
    const participationMethod = this.getParticipationMethod(
      eventType, 
      title, 
      description, 
      canParticipate,
      language
    );
    
    // 登録要否の判定
    const requiresRegistration = this.requiresRegistration(title, description);
    
    // 登録URLの抽出
    const registrationUrl = this.extractRegistrationUrl(description);
    
    // 実用的な情報の生成
    const practicalInfo = this.generatePracticalInfo(
      event,
      eventType,
      canParticipate,
      language
    );
    
    return {
      canParticipate,
      participationMethod,
      requiresRegistration,
      registrationUrl,
      eventType,
      relatedEvents: [], // 後で実装
      practicalInfo
    };
  }

  /**
   * イベントタイプの判定
   */
  private static determineEventType(title: string, description: string): 'public' | 'private' | 'rental' | 'community' {
    const combined = (title + ' ' + description).toLowerCase();
    
    if (combined.includes('貸切') || combined.includes('private') || combined.includes('closed')) {
      return 'private';
    }
    
    if (combined.includes('rental') || combined.includes('レンタル')) {
      return 'rental';
    }
    
    if (combined.includes('meetup') || combined.includes('勉強会') || 
        combined.includes('workshop') || combined.includes('ワークショップ')) {
      return 'community';
    }
    
    return 'public';
  }

  /**
   * 参加可否の判定
   */
  private static canParticipate(eventType: string, title: string, description: string): boolean {
    if (eventType === 'private' || eventType === 'rental') {
      return false;
    }
    
    // 満席や締切の確認
    const combined = (title + ' ' + description).toLowerCase();
    if (combined.includes('満席') || combined.includes('締切') || 
        combined.includes('full') || combined.includes('closed')) {
      return false;
    }
    
    return true;
  }

  /**
   * 参加方法の取得
   */
  private static getParticipationMethod(
    eventType: string,
    title: string,
    description: string,
    canParticipate: boolean,
    language: 'ja' | 'en'
  ): string {
    if (!canParticipate) {
      if (eventType === 'private') {
        return language === 'ja' 
          ? '貸切イベントのため一般参加はできません。'
          : 'This is a private event and not open to public.';
      }
      if (eventType === 'rental') {
        return language === 'ja'
          ? 'レンタル利用のため一般参加はできません。'
          : 'This is a rental event and not open to public.';
      }
      return language === 'ja'
        ? '現在、参加受付は終了しています。'
        : 'Registration is currently closed.';
    }
    
    // 参加可能な場合
    if (this.requiresRegistration(title, description)) {
      return language === 'ja'
        ? '事前登録が必要です。イベント詳細ページから申し込みください。'
        : 'Pre-registration required. Please apply from the event details page.';
    }
    
    return language === 'ja'
      ? '直接会場にお越しください。参加費等はイベント詳細をご確認ください。'
      : 'Please come directly to the venue. Check event details for any fees.';
  }

  /**
   * 登録要否の判定
   */
  private static requiresRegistration(title: string, description: string): boolean {
    const combined = (title + ' ' + description).toLowerCase();
    const registrationKeywords = [
      '要申込', '要登録', '事前登録', '申込必要',
      'registration required', 'rsvp', 'sign up', 'register'
    ];
    
    return registrationKeywords.some(keyword => combined.includes(keyword));
  }

  /**
   * 登録URLの抽出
   */
  private static extractRegistrationUrl(description: string): string | undefined {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = description.match(urlRegex);
    
    if (urls && urls.length > 0) {
      // Connpass, Doorkeeper, Peatixなどのイベントサイトを優先
      const eventSites = ['connpass', 'doorkeeper', 'peatix', 'eventbrite'];
      const eventUrl = urls.find(url => 
        eventSites.some(site => url.includes(site))
      );
      
      return eventUrl || urls[0];
    }
    
    return undefined;
  }

  /**
   * 実用的な情報の生成
   */
  private static generatePracticalInfo(
    event: any,
    eventType: string,
    canParticipate: boolean,
    language: 'ja' | 'en'
  ): string {
    const info: string[] = [];
    
    // 開催時刻の情報
    if (event.start) {
      const startTime = new Date(event.start.dateTime || event.start.date);
      const endTime = event.end ? new Date(event.end.dateTime || event.end.date) : null;
      
      if (language === 'ja') {
        info.push(`開催時間: ${this.formatTime(startTime)}${endTime ? '〜' + this.formatTime(endTime) : ''}`);
      } else {
        info.push(`Time: ${this.formatTime(startTime)}${endTime ? '-' + this.formatTime(endTime) : ''}`);
      }
    }
    
    // 場所の情報
    if (event.location) {
      if (language === 'ja') {
        info.push(`場所: ${event.location}`);
      } else {
        info.push(`Location: ${event.location}`);
      }
    }
    
    // 参加に関する注意事項
    if (eventType === 'community' && canParticipate) {
      if (language === 'ja') {
        info.push('※コミュニティイベントは参加者同士の交流を大切にしています。');
      } else {
        info.push('*Community events value participant interaction.');
      }
    }
    
    return info.join('\n');
  }

  /**
   * 時刻のフォーマット
   */
  private static formatTime(date: Date): string {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  /**
   * 休館日の判定
   */
  static isClosedDay(date: Date): { isClosed: boolean; reason?: string } {
    // 年末年始の確認 (12/29 - 1/3)
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    if ((month === 12 && day >= 29) || (month === 1 && day <= 3)) {
      return {
        isClosed: true,
        reason: '年末年始休館（12/29〜1/3）'
      };
    }
    
    // 最終月曜日の確認
    if (date.getDay() === 1) { // 月曜日
      const lastMonday = this.getLastMondayOfMonth(date);
      if (date.getDate() === lastMonday.getDate()) {
        return {
          isClosed: true,
          reason: '定期休館日（毎月最終月曜日）'
        };
      }
    }
    
    return { isClosed: false };
  }

  /**
   * 月の最終月曜日を取得
   */
  private static getLastMondayOfMonth(date: Date): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    
    let lastMonday = new Date(lastDay);
    while (lastMonday.getDay() !== 1) {
      lastMonday.setDate(lastMonday.getDate() - 1);
    }
    
    return lastMonday;
  }

  /**
   * 関連イベントの推薦
   */
  static recommendRelatedEvents(
    currentEvent: any,
    allEvents: any[],
    userInterests: string[],
    language: 'ja' | 'en'
  ): EventInfo[] {
    // イベントのキーワード抽出
    const eventKeywords = this.extractKeywords(currentEvent);
    
    // 関連イベントのスコアリング
    const scoredEvents = allEvents
      .filter(e => e.summary !== currentEvent.summary) // 現在のイベントを除外
      .map(event => {
        const score = this.calculateRelevanceScore(event, eventKeywords, userInterests);
        return { event, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3
    
    // EventInfo形式に変換
    return scoredEvents.map(({ event }) => ({
      title: event.summary || '',
      date: new Date(event.start.dateTime || event.start.date),
      time: this.formatTime(new Date(event.start.dateTime || event.start.date)),
      description: event.description,
      location: event.location
    }));
  }

  /**
   * キーワード抽出
   */
  private static extractKeywords(event: any): string[] {
    const text = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
    const techKeywords = [
      'python', 'javascript', 'react', 'ai', 'machine learning',
      'web', 'mobile', 'cloud', 'aws', 'docker', 'kubernetes'
    ];
    
    return techKeywords.filter(keyword => text.includes(keyword));
  }

  /**
   * 関連性スコアの計算
   */
  private static calculateRelevanceScore(
    event: any,
    targetKeywords: string[],
    userInterests: string[]
  ): number {
    const eventText = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
    
    // キーワードマッチスコア
    const keywordScore = targetKeywords.filter(keyword => 
      eventText.includes(keyword)
    ).length / targetKeywords.length;
    
    // ユーザー興味マッチスコア
    const interestScore = userInterests.filter(interest => 
      eventText.includes(interest.toLowerCase())
    ).length / userInterests.length;
    
    // 時間的近さスコア（1週間以内なら高スコア）
    const eventDate = new Date(event.start.dateTime || event.start.date);
    const daysDiff = Math.abs(eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const timeScore = Math.max(0, 1 - daysDiff / 7);
    
    return keywordScore * 0.4 + interestScore * 0.4 + timeScore * 0.2;
  }
}