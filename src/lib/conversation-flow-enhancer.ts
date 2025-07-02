/**
 * 会話フロー強化システム
 * スマートな推論、共感的応答、自然な会話の実現
 */

import { SimplifiedMemorySystem } from './simplified-memory';

export interface ConversationContext {
  userIntent: 'information' | 'help' | 'exploration' | 'complaint' | 'casual';
  emotionalState: 'neutral' | 'frustrated' | 'confused' | 'excited' | 'urgent';
  userProfile: 'first-timer' | 'regular' | 'engineer' | 'tourist' | 'business';
  needsClarification: boolean;
  clarificationReason?: string;
  suggestedResponse: string;
}

export class ConversationFlowEnhancer {
  private memory: SimplifiedMemorySystem;
  
  constructor(agentName: string) {
    this.memory = new SimplifiedMemorySystem(agentName);
  }

  /**
   * 会話コンテキストの分析と応答戦略の決定
   */
  async analyzeConversation(
    question: string,
    previousMessages: any[],
    language: 'ja' | 'en'
  ): Promise<ConversationContext> {
    // ユーザーの意図を推測
    const userIntent = this.inferUserIntent(question, previousMessages);
    
    // 感情状態の検出
    const emotionalState = this.detectEmotionalState(question, previousMessages);
    
    // ユーザープロファイルの推定
    const userProfile = await this.inferUserProfile(question, previousMessages);
    
    // 明確化の必要性判定
    const clarificationAnalysis = this.analyzeClarificationNeed(
      question,
      userIntent,
      userProfile,
      previousMessages
    );
    
    // 推奨応答の生成
    const suggestedResponse = this.generateSuggestedResponse(
      question,
      userIntent,
      emotionalState,
      userProfile,
      language
    );
    
    return {
      userIntent,
      emotionalState,
      userProfile,
      needsClarification: clarificationAnalysis.needed,
      clarificationReason: clarificationAnalysis.reason,
      suggestedResponse
    };
  }

  /**
   * ユーザー意図の推測
   */
  private inferUserIntent(question: string, previousMessages: any[]): ConversationContext['userIntent'] {
    const normalized = question.toLowerCase();
    
    // ヘルプ・困り事
    if (normalized.includes('助けて') || normalized.includes('help') ||
        normalized.includes('どうしたら') || normalized.includes('困った')) {
      return 'help';
    }
    
    // 不満・苦情
    if (normalized.includes('違う') || normalized.includes('おかしい') ||
        normalized.includes('話が違う') || normalized.includes('wrong')) {
      return 'complaint';
    }
    
    // 探索的な質問
    if (normalized.includes('どんな') || normalized.includes('what kind') ||
        normalized.includes('ありますか') || normalized.includes('できますか')) {
      return 'exploration';
    }
    
    // カジュアルな会話
    if (normalized.length < 10 || 
        normalized.includes('ちょっと') || normalized.includes('なんか')) {
      return 'casual';
    }
    
    return 'information';
  }

  /**
   * 感情状態の検出
   */
  private detectEmotionalState(question: string, previousMessages: any[]): ConversationContext['emotionalState'] {
    const normalized = question.toLowerCase();
    
    // 緊急性
    if (normalized.includes('今すぐ') || normalized.includes('緊急') ||
        normalized.includes('urgent') || normalized.includes('asap')) {
      return 'urgent';
    }
    
    // フラストレーション
    if (normalized.includes('！') || normalized.includes('...') ||
        previousMessages.some(m => m.role === 'user' && m.content.includes('違う'))) {
      return 'frustrated';
    }
    
    // 混乱
    if (normalized.includes('？？') || normalized.includes('えーっと') ||
        normalized.includes('よくわからない')) {
      return 'confused';
    }
    
    // 興奮・期待
    if (normalized.includes('楽しみ') || normalized.includes('excited') ||
        normalized.includes('すごい')) {
      return 'excited';
    }
    
    return 'neutral';
  }

  /**
   * ユーザープロファイルの推定
   */
  private async inferUserProfile(
    question: string,
    previousMessages: any[]
  ): Promise<ConversationContext['userProfile']> {
    const normalized = question.toLowerCase();
    
    // 初回利用者の特徴
    if (normalized.includes('初めて') || normalized.includes('first time') ||
        normalized.includes('何を持って') || normalized.includes('登録')) {
      return 'first-timer';
    }
    
    // エンジニアの特徴
    if (normalized.includes('プログラミング') || normalized.includes('開発') ||
        normalized.includes('ハッカソン') || normalized.includes('github')) {
      return 'engineer';
    }
    
    // 観光客の特徴
    if (normalized.includes('博多') || normalized.includes('天神') ||
        normalized.includes('観光') || normalized.includes('tourist')) {
      return 'tourist';
    }
    
    // ビジネス利用者の特徴
    if (normalized.includes('会議') || normalized.includes('クライアント') ||
        normalized.includes('打ち合わせ') || normalized.includes('business')) {
      return 'business';
    }
    
    // 過去の会話から判断
    if (previousMessages.length > 3) {
      return 'regular';
    }
    
    return 'first-timer';
  }

  /**
   * 明確化の必要性分析
   */
  private analyzeClarificationNeed(
    question: string,
    userIntent: ConversationContext['userIntent'],
    userProfile: ConversationContext['userProfile'],
    previousMessages: any[]
  ): { needed: boolean; reason?: string } {
    const normalized = question.toLowerCase();
    
    // 短すぎる質問でも文脈から推測可能な場合は明確化不要
    if (normalized.length < 5) {
      // カジュアルな挨拶や相槌なら明確化不要
      if (['はい', 'うん', 'ok', 'そう'].includes(normalized)) {
        return { needed: false };
      }
      
      // 前の会話から文脈が明確な場合
      if (previousMessages.length > 0) {
        const lastAssistantMessage = previousMessages
          .filter(m => m.role === 'assistant')
          .pop();
        
        if (lastAssistantMessage?.content.includes('他に')) {
          return { needed: false }; // 追加質問として処理
        }
      }
    }
    
    // 「カフェ」だけの質問でも、新規ユーザーなら施設案内として処理
    if ((normalized === 'カフェ' || normalized === 'cafe') && userProfile === 'first-timer') {
      return { needed: false };
    }
    
    // 本当に曖昧な場合のみ明確化
    if (normalized.includes('それ') || normalized.includes('あれ') ||
        normalized.includes('さっきの')) {
      if (!this.canInferFromContext(question, previousMessages)) {
        return {
          needed: true,
          reason: 'reference_unclear'
        };
      }
    }
    
    return { needed: false };
  }

  /**
   * 文脈からの推測可能性チェック
   */
  private canInferFromContext(question: string, previousMessages: any[]): boolean {
    if (previousMessages.length === 0) return false;
    
    // 直前の話題を確認
    const recentTopics = previousMessages
      .slice(-3)
      .map(m => m.content.toLowerCase());
    
    // 話題の継続性があれば推測可能
    const topicKeywords = ['カフェ', '会議室', '営業時間', '料金', 'wifi'];
    return topicKeywords.some(keyword => 
      recentTopics.some(topic => topic.includes(keyword))
    );
  }

  /**
   * 推奨応答の生成
   */
  private generateSuggestedResponse(
    question: string,
    userIntent: ConversationContext['userIntent'],
    emotionalState: ConversationContext['emotionalState'],
    userProfile: ConversationContext['userProfile'],
    language: 'ja' | 'en'
  ): string {
    const templates = this.getResponseTemplates(language);
    
    // 感情状態に応じた前置き
    let prefix = '';
    if (emotionalState === 'frustrated') {
      prefix = templates.empathy.frustrated;
    } else if (emotionalState === 'confused') {
      prefix = templates.empathy.confused;
    } else if (emotionalState === 'urgent') {
      prefix = templates.empathy.urgent;
    }
    
    // 意図に応じた応答スタイル
    let style = '';
    switch (userIntent) {
      case 'help':
        style = templates.helpful;
        break;
      case 'exploration':
        style = templates.suggestive;
        break;
      case 'casual':
        style = templates.friendly;
        break;
      case 'complaint':
        style = templates.apologetic;
        break;
      default:
        style = templates.informative;
    }
    
    return prefix + style;
  }

  /**
   * 応答テンプレートの取得
   */
  private getResponseTemplates(language: 'ja' | 'en') {
    if (language === 'ja') {
      return {
        empathy: {
          frustrated: 'お困りのようですね。',
          confused: 'ご不明な点があるようですね。',
          urgent: 'お急ぎのようですね。'
        },
        helpful: 'お手伝いさせていただきます。',
        suggestive: 'いくつかご提案があります。',
        friendly: 'はい、もちろんです！',
        apologetic: '申し訳ございません。',
        informative: ''
      };
    } else {
      return {
        empathy: {
          frustrated: 'I understand your frustration. ',
          confused: 'Let me clarify that for you. ',
          urgent: 'I understand this is urgent. '
        },
        helpful: 'I\'d be happy to help you with that. ',
        suggestive: 'Here are some suggestions. ',
        friendly: 'Of course! ',
        apologetic: 'I apologize for the confusion. ',
        informative: ''
      };
    }
  }

  /**
   * 自然な追加情報の生成
   */
  static generateNaturalFollowUp(
    mainResponse: string,
    context: ConversationContext,
    language: 'ja' | 'en'
  ): string {
    const followUps: string[] = [];
    
    // プロファイル別の追加情報
    if (context.userProfile === 'first-timer') {
      if (language === 'ja') {
        followUps.push('初めての方は受付で簡単な登録をお願いしています。');
      } else {
        followUps.push('First-time visitors need to register at reception.');
      }
    }
    
    // 意図別の追加提案
    if (context.userIntent === 'exploration') {
      if (language === 'ja') {
        followUps.push('他にもご質問があればお気軽にどうぞ。');
      } else {
        followUps.push('Feel free to ask if you have any other questions.');
      }
    }
    
    // 感情状態別のフォロー
    if (context.emotionalState === 'confused') {
      if (language === 'ja') {
        followUps.push('もし分かりにくい点があれば、具体的にお聞きください。');
      } else {
        followUps.push('Please let me know if you need more specific information.');
      }
    }
    
    return followUps.length > 0 ? '\n\n' + followUps.join(' ') : '';
  }
}