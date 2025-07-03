/**
 * QueryClassifier - クエリ分類専用クラス
 * EnhancedQAAgentから分離して、テスト可能でメンテナンスしやすい構造にする
 */

import { SupportedLanguage } from '../mastra/types/config';

export interface QueryClassificationResult {
  category: string;
  confidence: number;
  debugInfo?: {
    matchedKeywords?: string[];
    reason?: string;
  };
}

export class QueryClassifier {
  private debugMode: boolean;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
  }

  /**
   * クエリを分類する - 既存のcategorizeQuestionメソッドと互換性を保つ
   */
  public async classify(
    question: string, 
    conversationContext?: any
  ): Promise<string> {
    const result = await this.classifyWithDetails(question, conversationContext);
    return result.category;
  }

  /**
   * STT補正を適用（既存のロジックを維持）
   */
  private applySttCorrections(query: string): string {
    // TODO: applySttCorrectionsを適切にインポートまたは実装
    return query;
  }

  /**
   * 詳細情報付きでクエリを分類する（新規メソッド）
   */
  public async classifyWithDetails(
    question: string,
    conversationContext?: any
  ): Promise<QueryClassificationResult> {
    const normalizedQuestion = this.normalizeQuery(question);
    const lowerQuestion = normalizedQuestion.toLowerCase();
    
    // 現在時刻のチェック（最優先）
    if (this.isCurrentTimeQuery(normalizedQuestion)) {
      return {
        category: 'current-time',
        confidence: 1.0,
        debugInfo: { reason: 'Current time keywords detected' }
      };
    }

    // カレンダー/イベント（より具体的なカテゴリを先にチェック）
    if (this.isCalendarQuery(normalizedQuestion)) {
      return {
        category: 'calendar',
        confidence: 0.9,
        debugInfo: { reason: 'Calendar/event keywords detected' }
      };
    }

    // エンジニアカフェ特定のクエリ（カフェ曖昧性チェックより前に移動）
    if (this.isEngineerCafeSpecific(normalizedQuestion)) {
      return {
        category: 'facility-info',
        confidence: 1.0,
        debugInfo: { reason: 'Engineer Cafe specific' }
      };
    }

    // Sainoカフェの明示的なクエリ（カフェ曖昧性チェックより前に）
    if (this.isSainoCafeQuery(normalizedQuestion)) {
      return {
        category: 'saino-cafe',
        confidence: 0.9,
        debugInfo: { reason: 'Saino cafe detected' }
      };
    }

    // カフェの曖昧性チェック（既存ロジックを維持）
    const cafeCheck = this.checkCafeAmbiguity(normalizedQuestion, conversationContext);
    if (cafeCheck.needsClarification) {
      return {
        category: cafeCheck.category,
        confidence: cafeCheck.confidence,
        debugInfo: cafeCheck.debugInfo
      };
    }
    if (cafeCheck.category) {
      return {
        category: cafeCheck.category,
        confidence: cafeCheck.confidence,
        debugInfo: cafeCheck.debugInfo
      };
    }

    // 休館日/休業日
    if (this.isClosedDaysQuery(normalizedQuestion)) {
      return {
        category: 'facility-info',
        confidence: 0.9,
        debugInfo: { reason: 'Closed days query' }
      };
    }

    // 歴史関連
    if (this.isHistoryQuery(normalizedQuestion)) {
      return {
        category: 'facility-info',
        confidence: 0.8,
        debugInfo: { reason: 'History query' }
      };
    }

    // 会議室の曖昧性チェック
    const meetingRoomCheck = this.checkMeetingRoomAmbiguity(normalizedQuestion);
    if (meetingRoomCheck) {
      return meetingRoomCheck;
    }

    // 施設情報
    if (this.isFacilityQuery(normalizedQuestion)) {
      return {
        category: 'facility-info',
        confidence: 0.8,
        debugInfo: { reason: 'Facility keywords detected' }
      };
    }

    // その他のカテゴリ判定（料金、設備、アクセス、営業時間）
    const specificCategory = this.detectSpecificCategory(normalizedQuestion);
    if (specificCategory) {
      return specificCategory;
    }

    // デフォルト
    return {
      category: 'general',
      confidence: 0.5,
      debugInfo: { reason: 'No specific category matched' }
    };
  }

  /**
   * クエリを正規化する
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase()
      .replace(/coffee say no/g, 'saino cafe')
      .replace(/才能/g, 'saino')
      .replace(/say no/g, 'saino')
      .replace(/才能カフェ/g, 'saino cafe')
      .replace(/才能 カフェ/g, 'saino cafe')
      .replace(/セイノ/g, 'saino')
      .replace(/サイノ/g, 'saino')
      .replace(/^(じゃあ|じゃ|では|それでは|えっと|えーと|あの|その)\s*/g, '')
      .replace(/^(well|then|so|um|uh)\s*/i, '')
      .trim();
  }

  /**
   * 現在時刻クエリかどうかをチェック
   */
  private isCurrentTimeQuery(normalizedQuestion: string): boolean {
    const timeKeywords = [
      '現在時刻', '現在の時刻', '今の時間', '今何時',
      'currenttime', 'whattime', 'timenow', '今時刻',
      '時刻を教えて', 'whattimeisitnow'
    ];

    // 特殊な条件: "時間を教えて" は営業時間などを含まない場合のみ
    if (normalizedQuestion.includes('時間を教えて') && 
        !normalizedQuestion.includes('営業時間') && 
        !normalizedQuestion.includes('開店') &&
        !normalizedQuestion.includes('閉店') && 
        !normalizedQuestion.includes('hours') &&
        !normalizedQuestion.includes('カフェ') && 
        !normalizedQuestion.includes('店') &&
        (normalizedQuestion.includes('今') || normalizedQuestion.includes('現在'))) {
      return true;
    }

    return timeKeywords.some(keyword => normalizedQuestion.includes(keyword));
  }

  /**
   * カフェの曖昧性をチェック（既存ロジックを保持）
   */
  private checkCafeAmbiguity(
    normalizedQuestion: string, 
    conversationContext?: any
  ): { needsClarification: boolean; category: string; confidence: number; debugInfo?: any } {
    
    // "カフェ" が含まれているかチェック
    if (normalizedQuestion.includes('カフェ') || normalizedQuestion.includes('cafe')) {
      // 既にエンジニアカフェと明示されている場合
      if (normalizedQuestion.includes('エンジニアカフェ') || normalizedQuestion.includes('engineercafe')) {
        if (this.debugMode) {
          console.log('[QueryClassifier] Explicit Engineer Cafe query, treating as facility');
        }
        return {
          needsClarification: false,
          category: 'facility-info',
          confidence: 1.0
        };
      }
      
      // Sainoカフェと明示されている場合
      if (normalizedQuestion.includes('saino') || normalizedQuestion.includes('サイノ')) {
        if (this.debugMode) {
          console.log('[QueryClassifier] Explicit Saino Cafe query, treating as saino-cafe');
        }
        return {
          needsClarification: false,
          category: 'saino-cafe',
          confidence: 1.0
        };
      }

      // enhanced featuresが有効で、clarificationが不要な場合
      if (conversationContext && !conversationContext.needsClarification) {
        if (conversationContext.userProfile === 'first-timer' || conversationContext.userProfile === 'engineer') {
          return {
            needsClarification: false,
            category: 'facility-info',
            confidence: 0.8
          };
        }
      }

      // 作業関連のキーワードがある場合はエンジニアカフェと判断
      if (normalizedQuestion.includes('コワーキング') || 
          normalizedQuestion.includes('作業') ||
          normalizedQuestion.includes('無料') || 
          normalizedQuestion.includes('利用')) {
        return {
          needsClarification: false,
          category: 'facility-info',
          confidence: 0.9
        };
      }

      // 曖昧な場合は確認が必要
      if (!normalizedQuestion.includes('エンジニアカフェ') && 
          !normalizedQuestion.includes('engineercafe')) {
        return {
          needsClarification: true,
          category: 'cafe-clarification-needed',
          confidence: 0.7,
          debugInfo: { reason: 'Ambiguous cafe query' }
        };
      }
    }

    return { needsClarification: false, category: '', confidence: 0 };
  }

  /**
   * カレンダー/イベントクエリかどうかをチェック
   */
  private isCalendarQuery(normalizedQuestion: string): boolean {
    const calendarKeywords = [
      'カレンダー', 'calendar', 'イベント', 'event',
      '予定', 'schedule', '今日', 'today',
      '明日', 'tomorrow', '今週', 'this week',
      '直近', 'upcoming', '何月', '何日'
    ];

    return calendarKeywords.some(keyword => normalizedQuestion.includes(keyword));
  }

  /**
   * 施設情報クエリかどうかをチェック
   */
  private isFacilityQuery(normalizedQuestion: string): boolean {
    // エンジニアカフェの明示的な言及
    if (normalizedQuestion.includes('エンジニアカフェ') || 
        normalizedQuestion.includes('エンジニア カフェ') ||
        normalizedQuestion.includes('engineer cafe') || 
        normalizedQuestion.includes('engineer カフェ')) {
      return true;
    }

    // 休館日関連
    if (normalizedQuestion.includes('休業日') || normalizedQuestion.includes('定休日') ||
        normalizedQuestion.includes('休み') || normalizedQuestion.includes('閉まって') ||
        normalizedQuestion.includes('closed') || normalizedQuestion.includes('holiday') ||
        normalizedQuestion.includes('day off') || normalizedQuestion.includes('close')) {
      return true;
    }

    // 地下/地階関連
    const basementKeywords = ['地下', 'basement', 'under space', 'underスペース', 'under スペース', 'b1'];
    if (basementKeywords.some(keyword => normalizedQuestion.includes(keyword))) {
      return true;
    }

    // その他の施設関連キーワード
    const facilityKeywords = [
      '施設', 'facility', '福岡市', 'fukuoka',
      '公式', 'official', 'twitter', 'x.com',
      '会議室', 'meeting room', '受付', 'reception',
      'フロア', 'floor', 'どこ', 'where',
      '場所', 'location', '階', '部屋', 'room'
    ];

    return facilityKeywords.some(keyword => normalizedQuestion.includes(keyword));
  }

  /**
   * 特定のカテゴリを検出
   */
  private detectSpecificCategory(normalizedQuestion: string): QueryClassificationResult | null {
    // 料金
    if (normalizedQuestion.includes('料金') || normalizedQuestion.includes('price')) {
      return {
        category: 'pricing',
        confidence: 0.9,
        debugInfo: { reason: 'Pricing keywords detected' }
      };
    }

    // 設備
    if (normalizedQuestion.includes('設備') || normalizedQuestion.includes('facility')) {
      return {
        category: 'facilities',
        confidence: 0.8,
        debugInfo: { reason: 'Facilities keywords detected' }
      };
    }

    // アクセス
    if (normalizedQuestion.includes('アクセス') || normalizedQuestion.includes('access')) {
      return {
        category: 'access',
        confidence: 0.9,
        debugInfo: { reason: 'Access keywords detected' }
      };
    }

    // 営業時間
    if (normalizedQuestion.includes('時間') || normalizedQuestion.includes('営業') || 
        normalizedQuestion.includes('hours') || normalizedQuestion.includes('open')) {
      return {
        category: 'hours',
        confidence: 0.8,
        debugInfo: { reason: 'Hours keywords detected' }
      };
    }

    // 会議室の曖昧性
    const meetingRoomKeywords = ['会議室', 'meeting room', 'ミーティング', 'mtg'];
    const hasMeetingRoom = meetingRoomKeywords.some(keyword => normalizedQuestion.includes(keyword));
    const hasSpecificFloor = normalizedQuestion.includes('2階') || normalizedQuestion.includes('2f') || 
                            normalizedQuestion.includes('地下') || normalizedQuestion.includes('basement') ||
                            normalizedQuestion.includes('under');
    
    if (hasMeetingRoom && !hasSpecificFloor) {
      return {
        category: 'meeting-room-clarification-needed',
        confidence: 0.7,
        debugInfo: { reason: 'Ambiguous meeting room query' }
      };
    }

    return null;
  }

  /**
   * Sainoカフェクエリかどうかをチェック
   */
  private isSainoCafeQuery(normalizedQuestion: string): boolean {
    return (normalizedQuestion.includes('サイノ') || normalizedQuestion.includes('saino')) ||
           ((normalizedQuestion.includes('併設') || normalizedQuestion.includes('併設されてる')) &&
            (normalizedQuestion.includes('カフェ') || normalizedQuestion.includes('cafe') || normalizedQuestion.includes('bar')));
  }

  /**
   * 休館日/休業日クエリかどうかをチェック
   */
  private isClosedDaysQuery(normalizedQuestion: string): boolean {
    return normalizedQuestion.includes('休業日') || normalizedQuestion.includes('定休日') ||
           normalizedQuestion.includes('休み') || normalizedQuestion.includes('閉まって') ||
           normalizedQuestion.includes('closed') || normalizedQuestion.includes('holiday') ||
           normalizedQuestion.includes('day off') || normalizedQuestion.includes('close') ||
           normalizedQuestion.includes('休館日');
  }

  /**
   * エンジニアカフェ特定のクエリかどうかをチェック
   */
  private isEngineerCafeSpecific(normalizedQuestion: string): boolean {
    return normalizedQuestion.includes('エンジニアカフェ') || 
           normalizedQuestion.includes('エンジニア カフェ') ||
           normalizedQuestion.includes('engineer cafe') || 
           normalizedQuestion.includes('engineer カフェ') ||
           normalizedQuestion.includes('engineercafe');
  }

  /**
   * 歴史関連のクエリかどうかをチェック
   */
  private isHistoryQuery(normalizedQuestion: string): boolean {
    return normalizedQuestion.includes('history') || normalizedQuestion.includes('歴史') ||
           normalizedQuestion.includes('background') || normalizedQuestion.includes('started') ||
           normalizedQuestion.includes('founded') || normalizedQuestion.includes('established') ||
           normalizedQuestion.includes('開設') || normalizedQuestion.includes('設立') ||
           normalizedQuestion.includes('始まり') || normalizedQuestion.includes('創立');
  }

  /**
   * 会議室の曖昧性をチェック
   */
  private checkMeetingRoomAmbiguity(normalizedQuestion: string): QueryClassificationResult | null {
    const meetingRoomKeywords = ['会議室', 'meeting room', 'ミーティング', 'mtg'];
    const hasMeetingRoom = meetingRoomKeywords.some(keyword => normalizedQuestion.includes(keyword));
    const hasSpecificFloor = normalizedQuestion.includes('2階') || normalizedQuestion.includes('2f') || 
                            normalizedQuestion.includes('地下') || normalizedQuestion.includes('basement') ||
                            normalizedQuestion.includes('under');
    
    if (hasMeetingRoom && !hasSpecificFloor) {
      return {
        category: 'meeting-room-clarification-needed',
        confidence: 0.7,
        debugInfo: { reason: 'Ambiguous meeting room query' }
      };
    }

    return null;
  }

  /**
   * デバッグ情報を含めてログ出力
   */
  public logClassification(result: QueryClassificationResult, query: string): void {
    if (this.debugMode) {
      console.log('[QueryClassifier] Classification result:');
      console.log(`  Query: ${query}`);
      console.log(`  Category: ${result.category}`);
      console.log(`  Confidence: ${result.confidence}`);
      if (result.debugInfo) {
        console.log(`  Debug Info:`, result.debugInfo);
      }
    }
  }
}