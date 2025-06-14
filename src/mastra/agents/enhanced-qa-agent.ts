import { Agent } from '@mastra/core/agent';
import { EmotionTagParser } from '../../lib/emotion-tag-parser';
import { ragSearchTool } from '../tools/rag-search';
import { SupportedLanguage } from '../types/config';
import { SupabaseMemoryAdapter } from '@/lib/supabase-memory';

export class EnhancedQAAgent extends Agent {
  private memory: any;
  private supabaseMemory: SupabaseMemoryAdapter;
  private _tools: Map<string, any> = new Map();

  constructor(config: any) {
    super({
      name: 'EnhancedQAAgent',
      model: config.llm.model,
      instructions: `You are a knowledgeable Q&A agent for Engineer Cafe in Fukuoka. 
        Answer questions concisely and directly. Keep responses brief - typically 1-2 sentences.
        Only provide the specific information requested. Avoid unnecessary details.
        Use the RAG tools to search for accurate information.
        You can also search for company-related information and calendar events when relevant.`,
    });
    this.memory = config.memory || new Map();
    this.supabaseMemory = new SupabaseMemoryAdapter('realtime');
  }

  // Method to add tools to this agent
  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }

  async answerQuestion(question: string): Promise<string> {
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    // Check if the question is about calendar/events or facility information
    const category = await this.categorizeQuestion(question);
    console.log('[EnhancedQAAgent] Question:', question);
    console.log('[EnhancedQAAgent] Detected category:', category);
    
    let context = '';
    
    // Use appropriate tool based on category
    if (category === 'calendar' || category === 'events') {
      console.log('[EnhancedQAAgent] Using Calendar context');
      context = await this.getCalendarContext(question);
    } else if (category === 'facility-info') {
      console.log('[EnhancedQAAgent] Using Facility context');
      context = await this.getFacilityContext(question);
    } else {
      // Default to RAG search
      console.log('[EnhancedQAAgent] Using RAG search');
      context = await this.searchKnowledgeBase(question);
    }
    
    const prompt = language === 'en'
      ? `Answer ONLY the specific question asked: ${question}\nContext: ${context}\nProvide ONLY the requested information. Do not add extra details or explanations. Keep it to 1-2 sentences maximum.`
      : `聞かれたことだけに答えてください: ${question}\n参考情報: ${context}\n聞かれた情報のみを答え、余計な説明は不要です。最大1-2文で答えてください。`;
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    
    // Auto-enhance response with emotion tags
    return EmotionTagParser.enhanceAgentResponse(response.text, 'qa', language);
  }

  private async getCalendarContext(query: string): Promise<string> {
    console.log('[EnhancedQAAgent] Getting calendar context for query:', query);
    const calendarTool = this._tools.get('calendarService');
    console.log('[EnhancedQAAgent] Calendar tool available:', !!calendarTool);
    if (!calendarTool) {
      return 'Calendar service is not available.';
    }

    try {
      console.log('[EnhancedQAAgent] Calling calendar tool...');
      const result = await calendarTool.execute({
        daysAhead: 30,
        maxEvents: 10,
      });
      console.log('[EnhancedQAAgent] Calendar result:', result);

      if (result.success && result.events) {
        return result.events;
      } else {
        return 'Unable to fetch calendar events at this time.';
      }
    } catch (error) {
      console.error('[EnhancedQAAgent] Calendar fetch error:', error);
      return 'Error fetching calendar information.';
    }
  }

  private async getFacilityContext(query: string): Promise<string> {
    const webSearchTool = this._tools.get('engineerCafeWebSearch');
    if (!webSearchTool) {
      return 'Engineer Cafe web search service is not available.';
    }

    try {
      const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      
      // Get facility context from memory or knowledge base if available
      const facilityContext = await this.getFacilityKnowledgeBase();
      
      const result = await webSearchTool.execute({
        query: query,
        language: language,
        facilityContext: facilityContext,
      });

      if (result.success && result.text) {
        // Format the response with sources if available
        if (result.sources && result.sources.length > 0) {
          return webSearchTool.formatSearchResultsWithSources(result.text, result.sources, language);
        }
        return result.text;
      } else {
        return 'No facility information found for your query.';
      }
    } catch (error) {
      console.error('Engineer Cafe web search error:', error);
      return 'Error searching facility information.';
    }
  }

  private async getFacilityKnowledgeBase(): Promise<string> {
    // This method can be extended to fetch facility information from the knowledge base
    // For now, return basic facility information
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    if (language === 'ja') {
      return `
エンジニアカフェは福岡市が運営するITエンジニア向けの公共施設です。
営業時間: 9:00-22:00（年中無休）
設備: 高速インターネット、会議室、イベントスペース、コワーキングスペース
利用料金: 完全無料
所在地: 福岡市中央区天神
公式サイト: https://engineercafe.jp
公式X: https://x.com/EngineerCafeJP
`;
    } else {
      return `
Engineer Cafe is a public facility for IT engineers operated by Fukuoka City.
Operating hours: 9:00-22:00 (Open every day)
Facilities: High-speed internet, meeting rooms, event spaces, coworking space
Usage fee: Completely free
Location: Tenjin, Chuo-ku, Fukuoka City
Official website: https://engineercafe.jp
Official X/Twitter: https://x.com/EngineerCafeJP
`;
    }
  }

  private async searchKnowledgeBase(query: string): Promise<string> {
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    // Normalize query for better matching
    const normalizedQuery = query.toLowerCase()
      .replace(/coffee say no/g, 'saino cafe')
      .replace(/才能/g, 'saino')
      .replace(/say no/g, 'saino');
    
    const category = await this.categorizeQuestion(normalizedQuery);
    
    try {
      const ragTool = this._tools.get('ragSearch') || ragSearchTool;
      
      if (category === 'cafe-clarification-needed') {
        const clarificationMessage = language === 'en'
          ? "[curious]I'd be happy to help! Are you asking about:\n1. **Engineer Cafe** (the coworking space) - hours, facilities, usage\n2. **Saino Cafe** (the attached cafe & bar) - menu, hours, prices\n\nPlease let me know which one you're interested in![/curious]"
          : "[curious]お手伝いさせていただきます！どちらについてお聞きでしょうか：\n1. **エンジニアカフェ**（コワーキングスペース）- 営業時間、設備、利用方法\n2. **サイノカフェ**（併設のカフェ＆バー）- メニュー、営業時間、料金\n\nお聞かせください！[/curious]";
        
        return clarificationMessage;
      }
      
      if (category === 'saino-cafe') {
        const sainoInfo = language === 'en'
          ? "Saino Cafe is the attached cafe & bar inside Engineer Cafe.\nOperating hours: Monday-Saturday 11:00-22:00, Sunday & Holidays 11:00-20:00\nOffers coffee, light meals, and alcoholic beverages."
          : "サイノカフェは、エンジニアカフェに併設されているカフェ＆バーです。\n営業時間: 月曜～土曜 11:00-22:00、日曜・祝日 11:00-20:00\nコーヒー、軽食、アルコール類を提供しています。";
        
        console.log('[EnhancedQAAgent] Providing Saino Cafe information');
        return sainoInfo;
      }
      
      const context = await ragTool.searchKnowledgeBase(normalizedQuery, language);
      
      if (!context) {
        const defaultContext = {
          en: `I couldn't find specific information about that in my knowledge base. 
                Engineer Cafe is open from 9:00 to 22:00 daily, a coworking space in Fukuoka designed for IT engineers.`,
          ja: `申し訳ございませんが、その件について具体的な情報が見つかりませんでした。
                エンジニアカフェは福岡のITエンジニア向け9:00〜22:00営業のコワーキングスペースです。`
        };
        return defaultContext[language];
      }
      
      return context;
    } catch (error) {
      console.error('Knowledge base search error:', error);
      const sampleContext = {
        en: `Engineer Cafe is open from 9:00 to 22:00 daily, a coworking space in Fukuoka designed for IT engineers. 
              Features include high-speed internet, private meeting rooms, coffee service, 
              and event spaces. The facility is completely free to use.`,
        ja: `エンジニアカフェは福岡のITエンジニア向け9:00〜22:00営業のコワーキングスペースです。
              高速インターネット、プライベート会議室、コーヒーサービス、イベントスペースを完備。
              施設は完全無料でご利用いただけます。`
      };
      return sampleContext[language];
    }
  }

  async categorizeQuestion(question: string): Promise<string> {
    const lowerQuestion = question.toLowerCase();
    const normalizedQuestion = lowerQuestion
      .replace(/coffee say no/g, 'saino')
      .replace(/才能/g, 'saino')
      .replace(/say no/g, 'saino');
    
    // Calendar/Events
    if (normalizedQuestion.includes('カレンダー') || normalizedQuestion.includes('calendar') ||
        normalizedQuestion.includes('イベント') || normalizedQuestion.includes('event') ||
        normalizedQuestion.includes('予定') || normalizedQuestion.includes('schedule') ||
        normalizedQuestion.includes('今日') || normalizedQuestion.includes('today') ||
        normalizedQuestion.includes('明日') || normalizedQuestion.includes('tomorrow') ||
        normalizedQuestion.includes('今週') || normalizedQuestion.includes('this week') ||
        normalizedQuestion.includes('直近') || normalizedQuestion.includes('upcoming') ||
        normalizedQuestion.includes('何月') || normalizedQuestion.includes('何日')) {
      console.log('[EnhancedQAAgent] Detected calendar/event keywords');
      return 'calendar';
    }
    
    // Engineer Cafe specific (highest priority - check space variations)
    if (normalizedQuestion.includes('エンジニアカフェ') || 
        normalizedQuestion.includes('エンジニア カフェ') ||
        normalizedQuestion.includes('engineer cafe') || 
        normalizedQuestion.includes('engineer カフェ')) {
      console.log('[EnhancedQAAgent] Detected Engineer Cafe specific query');
      return 'facility-info';
    }
    
    // Saino Cafe specific (併設カフェも含む)
    if (normalizedQuestion.includes('サイノ') || normalizedQuestion.includes('saino') ||
        normalizedQuestion.includes('併設') || normalizedQuestion.includes('併設されてる')) {
      console.log('[EnhancedQAAgent] Detected Saino Cafe specific query');
      return 'saino-cafe';
    }
    
    // General facility information
    if (normalizedQuestion.includes('施設') || normalizedQuestion.includes('facility') ||
        normalizedQuestion.includes('福岡市') || normalizedQuestion.includes('fukuoka') ||
        normalizedQuestion.includes('公式') || normalizedQuestion.includes('official') ||
        normalizedQuestion.includes('twitter') || normalizedQuestion.includes('x.com')) {
      return 'facility-info';
    }
    
    // Ambiguous cafe queries (lower priority)
    if (normalizedQuestion.includes('カフェ') || normalizedQuestion.includes('cafe')) {
      // If it contains working/facility keywords, assume Engineer Cafe
      if (normalizedQuestion.includes('コワーキング') || normalizedQuestion.includes('作業') || 
          normalizedQuestion.includes('無料') || normalizedQuestion.includes('利用') ||
          normalizedQuestion.includes('営業時間') || normalizedQuestion.includes('時間')) {
        console.log('[EnhancedQAAgent] Cafe query with facility keywords, assuming Engineer Cafe');
        return 'facility-info';
      }
      // Otherwise ask for clarification
      console.log('[EnhancedQAAgent] Ambiguous cafe query, requesting clarification');
      return 'cafe-clarification-needed';
    }
    
    // Other categories
    if (lowerQuestion.includes('料金') || lowerQuestion.includes('price')) {
      return 'pricing';
    } else if (lowerQuestion.includes('設備') || lowerQuestion.includes('facility')) {
      return 'facilities';
    } else if (lowerQuestion.includes('アクセス') || lowerQuestion.includes('access')) {
      return 'access';
    } else if (lowerQuestion.includes('時間') || lowerQuestion.includes('営業') || 
               lowerQuestion.includes('hours') || lowerQuestion.includes('open')) {
      return 'hours';
    } else {
      return 'general';
    }
  }

  async provideFallbackResponse(): Promise<string> {
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    const fallback = language === 'en'
      ? "[sad]I don't have specific information about that. Would you like me to connect you with our staff for detailed assistance?[/sad]"
      : "[sad]その件について詳しい情報がございません。スタッフにお繋ぎしてより詳しくご案内させていただきましょうか？[/sad]";
    
    return fallback;
  }

  async escalateToStaff(_question: string): Promise<string> {
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    const message = language === 'en'
      ? "[happy]I've notified our staff about your inquiry. Someone will be with you shortly to provide detailed assistance.[/happy]"
      : "[happy]スタッフにご連絡いたしました。詳しいご案内のため、まもなくスタッフがお伺いいたします。[/happy]";
    
    return message;
  }
}