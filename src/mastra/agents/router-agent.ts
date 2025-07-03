import { Agent } from '@mastra/core/agent';
import { QueryClassifier } from '@/lib/query-classifier';
import { LanguageProcessor } from '@/lib/language-processor';
import { SupportedLanguage } from '@/mastra/types/config';

export interface RouterConfig {
  llm: {
    model: any;
  };
}

export interface RouteResult {
  agent: string;
  category: string;
  requestType: string | null;
  language: SupportedLanguage;
  confidence: number;
  debugInfo: {
    languageDetection: any;
    classification: any;
  };
}

export class RouterAgent extends Agent {
  private queryClassifier: QueryClassifier;
  private languageProcessor: LanguageProcessor;

  constructor(config: RouterConfig) {
    super({
      name: 'RouterAgent',
      model: config.llm.model,
      instructions: `You are a query router that analyzes user questions and determines:
        1. The appropriate agent to handle the query
        2. The query category and specific request type
        3. The language of the query and response
        Do not answer questions directly, only route them.`,
    });
    this.queryClassifier = new QueryClassifier();
    this.languageProcessor = new LanguageProcessor();
  }

  async routeQuery(query: string, sessionId: string): Promise<RouteResult> {
    // 言語検出
    const languageResult = this.languageProcessor.detectLanguage(query);
    const responseLanguage = this.languageProcessor.determineResponseLanguage(languageResult);
    
    // メモリー関連の質問を先にチェック
    if (this.isMemoryRelatedQuestion(query)) {
      return {
        agent: 'MemoryAgent',
        category: 'memory',
        requestType: null,
        language: responseLanguage,
        confidence: 1.0,
        debugInfo: {
          languageDetection: languageResult,
          classification: { reason: 'Memory-related question detected' }
        }
      };
    }
    
    // クエリ分類
    const classification = await this.queryClassifier.classifyWithDetails(query);
    
    // 特定リクエストタイプの抽出
    let requestType = this.extractRequestType(query);
    
    // 文脈依存クエリの場合、前回のrequestTypeを継承
    if (this.isContextDependentQuery(query) && !requestType) {
      try {
        const { SimplifiedMemorySystem } = await import('@/lib/simplified-memory');
        const memory = new SimplifiedMemorySystem('shared');
        const previousRequestType = await memory.getPreviousRequestType(sessionId);
        if (previousRequestType) {
          requestType = previousRequestType;
          console.log(`[RouterAgent] Context inheritance: ${query} -> ${requestType}`);
        }
      } catch (error) {
        console.error('[RouterAgent] Failed to get previous request type:', error);
      }
    }
    
    // エージェント選択
    const selectedAgent = this.selectAgent(classification.category, requestType, query);
    
    return {
      agent: selectedAgent,
      category: classification.category,
      requestType,
      language: responseLanguage,
      confidence: classification.confidence,
      debugInfo: {
        languageDetection: languageResult,
        classification: classification.debugInfo
      }
    };
  }

  private selectAgent(category: string, requestType: string | null, query?: string): string {
    // Context-dependent queries: try to route to appropriate agent instead of memory
    if (query && this.isContextDependentQuery(query)) {
      console.log(`[RouterAgent] Context-dependent query detected: ${query}`);
      
      // Check for specific entities/topics to determine agent
      const lowerQuery = query.toLowerCase();
      
      if (lowerQuery.includes('saino')) {
        return 'BusinessInfoAgent'; // saino-related queries
      }
      
      if (lowerQuery.includes('土曜') || lowerQuery.includes('日曜') || lowerQuery.includes('平日')) {
        return 'BusinessInfoAgent'; // hours-related queries
      }
    }
    
    // Check if clarification is needed first
    if (category === 'cafe-clarification-needed' || category === 'meeting-room-clarification-needed') {
      return 'ClarificationAgent';
    }
    
    // requestTypeに基づく特別なルーティング
    if (requestType) {
      // 料金に関する質問はBusinessInfoAgentへ
      if (requestType === 'price' || requestType === 'hours' || requestType === 'location') {
        return 'BusinessInfoAgent';
      }
      // Wi-Fi・設備に関する質問はFacilityAgentへ
      if (requestType === 'wifi' || requestType === 'facility' || requestType === 'basement') {
        return 'FacilityAgent';
      }
      // イベントに関する質問はEventAgentへ
      if (requestType === 'event') {
        return 'EventAgent';
      }
    }
    
    const agentMap: Record<string, string> = {
      'facility-info': requestType === 'wifi' ? 'FacilityAgent' : 'BusinessInfoAgent',
      'saino-cafe': 'BusinessInfoAgent',
      'calendar': 'EventAgent',
      'events': 'EventAgent',
      'current-time': 'TimeAgent',
      'general': 'GeneralKnowledgeAgent',
      'memory': 'MemoryAgent',
      'cafe-clarification-needed': 'ClarificationAgent',
      'meeting-room-clarification-needed': 'ClarificationAgent'
    };
    
    return agentMap[category] || 'GeneralKnowledgeAgent';
  }

  private extractRequestType(query: string): string | null {
    const lowerQuestion = query.toLowerCase();
    
    // Wi-Fi関連
    if (lowerQuestion.includes('wi-fi') || lowerQuestion.includes('wifi') || 
        lowerQuestion.includes('インターネット') || lowerQuestion.includes('ネット')) {
      return 'wifi';
    }
    
    // 営業時間関連
    if (lowerQuestion.includes('営業時間') || lowerQuestion.includes('hours') ||
        lowerQuestion.includes('何時まで') || lowerQuestion.includes('何時から') ||
        lowerQuestion.includes('開いて') || lowerQuestion.includes('閉まる') ||
        lowerQuestion.includes('open') || lowerQuestion.includes('close')) {
      return 'hours';
    }
    
    // 料金関連
    if (lowerQuestion.includes('料金') || lowerQuestion.includes('price') ||
        lowerQuestion.includes('いくら') || lowerQuestion.includes('値段') ||
        lowerQuestion.includes('cost') || lowerQuestion.includes('fee')) {
      return 'price';
    }
    
    // 場所関連
    if (lowerQuestion.includes('場所') || lowerQuestion.includes('location') ||
        lowerQuestion.includes('どこ') || lowerQuestion.includes('where') ||
        lowerQuestion.includes('アクセス') || lowerQuestion.includes('access') ||
        lowerQuestion.includes('住所') || lowerQuestion.includes('address')) {
      return 'location';
    }
    
    // 設備関連
    if (lowerQuestion.includes('設備') || lowerQuestion.includes('facility') ||
        lowerQuestion.includes('equipment') || lowerQuestion.includes('電源') ||
        lowerQuestion.includes('プリンター') || lowerQuestion.includes('printer')) {
      return 'facility';
    }
    
    // 地下施設関連 - Enhanced detection (prioritize over meeting-room)
    if (lowerQuestion.includes('地下') || lowerQuestion.includes('basement') ||
        lowerQuestion.includes('b1') || lowerQuestion.includes('階下') ||
        lowerQuestion.includes('ちか') || lowerQuestion.includes('チカ') ||  // Add speech recognition variations
        lowerQuestion.includes('underground') || lowerQuestion.includes('mtgスペース') ||
        lowerQuestion.includes('集中スペース') || lowerQuestion.includes('アンダースペース') ||
        lowerQuestion.includes('makersスペース') || lowerQuestion.includes('focus space') ||
        lowerQuestion.includes('meeting space') || lowerQuestion.includes('makers space') ||
        /地下.*スペース|地下.*施設|地下.*会議|ちか.*ミーティング|ちか.*スペース/.test(lowerQuestion)) {
      return 'basement';
    }
    
    // 会議室関連 (but not if already caught by basement above)
    if (lowerQuestion.includes('会議室') || lowerQuestion.includes('meeting room') ||
        lowerQuestion.includes('ミーティングルーム') || lowerQuestion.includes('会議スペース')) {
      return 'meeting-room';
    }
    
    // イベント関連
    if (lowerQuestion.includes('イベント') || lowerQuestion.includes('event') ||
        lowerQuestion.includes('勉強会') || lowerQuestion.includes('セミナー') ||
        lowerQuestion.includes('workshop') || lowerQuestion.includes('meetup')) {
      return 'event';
    }
    
    return null;
  }

  private isMemoryRelatedQuestion(question: string): boolean {
    const lowerQuestion = question.toLowerCase();
    
    // Exclude business-related questions even if they contain memory keywords like "どんな"
    if (lowerQuestion.includes('メニュー') || lowerQuestion.includes('menu') ||
        lowerQuestion.includes('料金') || lowerQuestion.includes('price') || lowerQuestion.includes('pricing') ||
        lowerQuestion.includes('営業時間') || lowerQuestion.includes('hours') ||
        lowerQuestion.includes('場所') || lowerQuestion.includes('location') ||
        lowerQuestion.includes('アクセス') || lowerQuestion.includes('access') ||
        lowerQuestion.includes('設備') || lowerQuestion.includes('facility') ||
        lowerQuestion.includes('サイノカフェ') || lowerQuestion.includes('saino') ||
        lowerQuestion.includes('エンジニアカフェ') || lowerQuestion.includes('engineer')) {
      return false;
    }
    
    // Exclude basement/facility-related questions even if they contain memory keywords
    if (lowerQuestion.includes('地下') || lowerQuestion.includes('basement') || 
        lowerQuestion.includes('スペース') || lowerQuestion.includes('space') ||
        lowerQuestion.includes('mtg') || lowerQuestion.includes('会議室') ||
        lowerQuestion.includes('施設') || lowerQuestion.includes('facility') ||
        lowerQuestion.includes('equipment') || lowerQuestion.includes('makers')) {
      return false;
    }
    
    // Check for "other one" patterns that refer to clarification options
    const otherOnePatterns = [
      // Japanese
      'もう一つ', 'もうひとつ', 'もう1つ', 'もう一方', 'もう片方',
      '他の方', 'ほかの方', '別の方', 'そっち', 'あっち',
      // English
      'the other', 'other one', 'other option', 'the alternative'
    ];
    
    if (otherOnePatterns.some(pattern => lowerQuestion.includes(pattern))) {
      return true;
    }
    
    // Memory-related keywords (from EnhancedQAAgent)
    const memoryKeywords = [
      // Japanese
      'さっき', '前に', '覚えて', '記憶', '質問', '聞いた', '話した', 
      'どんな', '何を', '言った', '会話', '履歴', '先ほど',
      // English
      'remember', 'recall', 'earlier', 'before', 'previous', 'asked', 
      'said', 'mentioned', 'conversation', 'history', 'what did i'
    ];
    
    return memoryKeywords.some(keyword => lowerQuestion.includes(keyword));
  }

  private isContextDependentQuery(question: string): boolean {
    const trimmed = question.trim();
    
    // Short questions that likely depend on context
    const contextPatterns = [
      /^土曜[日]?[はも].*/,        // 土曜日は... 土曜は... 土曜日も... 土曜も...
      /^日曜[日]?[はも].*/,        // 日曜日は... 日曜は... 日曜日も... 日曜も...
      /^平日[はも].*/,             // 平日は... 平日も...
      /^saino[のは方も]?.*/,       // sainoの方は... sainoは... sainoも...
      /^そっち[のはも]?.*/,        // そっちの方は... そっちは... そっちも...
      /^あっち[のはも]?.*/,        // あっちの方は... あっちは... あっちも...
      /^それ[のはも]?.*/,          // それの方は... それは... それも...
      /^そこ[のはも]?.*/,          // そこの方は... そこは... そこも...
      /^(じゃあ|それでは|では).*(エンジニア|engineer).*(カフェ|cafe)/i, // じゃあエンジニアカフェ！
      /^エンジニア.*(カフェ|cafe)[!！]?$/i,   // エンジニアカフェ！
      /^(エンジニア|engineer).*(の方|にして|で)[!！]?$/i, // エンジニアの方で！
      /^(じゃあ|それでは|では).*(saino|サイノ).*(カフェ|cafe|の方|方は)/i, // じゃあsainoカフェの方は？
    ];
    
    return contextPatterns.some(pattern => pattern.test(trimmed));
  }
}