import { Agent } from '@mastra/core/agent';
import { EmotionTagParser } from '../../lib/emotion-tag-parser';
import { ragSearchTool } from '../tools/rag-search';
import { GeneralWebSearchTool } from '../tools/general-web-search';
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
      console.log('[EnhancedQAAgent] Using RAG search for facility info');
      context = await this.searchKnowledgeBase(question);
      
      // Check if the result is a clarification message (starts with [curious])
      if (context.startsWith('[curious]')) {
        return context;
      }
    } else {
      // Check if query needs web search instead of RAG
      if (GeneralWebSearchTool.shouldUseWebSearch(question, category)) {
        console.log('[EnhancedQAAgent] Using web search for general query');
        context = await this.performWebSearch(question);
      } else {
        // Default to RAG search
        console.log('[EnhancedQAAgent] Using RAG search');
        context = await this.searchKnowledgeBase(question);
        
        // Check if the result is a clarification message (starts with [curious])
        if (context.startsWith('[curious]')) {
          return context;
        }
        
        // If RAG search returns irrelevant results, fallback to web search
        if (await this.isIrrelevantResult(context, question)) {
          console.log('[EnhancedQAAgent] RAG result irrelevant, falling back to web search');
          context = await this.performWebSearch(question);
        }
      }
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
営業時間: 9:00-22:00、休館日: 毎月最終月曜日（祝日の場合は翌平日）と年末年始（12/29-1/3）
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
    
    console.log('[EnhancedQAAgent] Starting RAG search for query:', query);
    
    // Normalize query for better matching
    const normalizedQuery = query.toLowerCase()
      .replace(/coffee say no/g, 'saino cafe')
      .replace(/才能/g, 'saino')
      .replace(/say no/g, 'saino')
      .replace(/才能カフェ/g, 'saino cafe')
      .replace(/才能 カフェ/g, 'saino cafe')
      .replace(/セイノ/g, 'saino')
      .replace(/サイノ/g, 'saino');
    
    console.log('[EnhancedQAAgent] Normalized query:', normalizedQuery);
    
    const category = await this.categorizeQuestion(normalizedQuery);
    console.log('[EnhancedQAAgent] Categorized as:', category);
    
    try {
      const ragTool = this._tools.get('ragSearch') || ragSearchTool;
      console.log('[EnhancedQAAgent] Using RAG tool:', !!ragTool);
      
      if (category === 'cafe-clarification-needed') {
        const clarificationMessage = language === 'en'
          ? "[curious]Are you asking about Engineer Cafe (the coworking space) or Saino Cafe (the attached cafe & bar)?[/curious]"
          : "[curious]コワーキングスペースのエンジニアカフェのことですか、それとも併設のカフェ＆バーのsainoカフェのことですか？[/curious]";
        
        console.log('[EnhancedQAAgent] Returning clarification message');
        return clarificationMessage;
      }
      
      if (category === 'meeting-room-clarification-needed') {
        const clarificationMessage = language === 'en'
          ? "[curious]Are you asking about the basement workspace (free, part of Engineer Cafe) or the 2F meeting rooms (paid, city-managed)?[/curious]"
          : "[curious]地下の無料ワークスペース（エンジニアカフェの一部）のことですか、それとも2階の有料会議室（市の管理）のことですか？[/curious]";
        
        console.log('[EnhancedQAAgent] Returning meeting room clarification message');
        return clarificationMessage;
      }
      
      // For saino-cafe queries, enhance search with language-appropriate terms
      let searchQuery = normalizedQuery;
      if (category === 'saino-cafe') {
        // Add saino-specific terms to improve RAG search accuracy based on language
        if (language === 'ja') {
          searchQuery = `saino ${normalizedQuery} 併設 カフェ バー`.replace(/\s+/g, ' ').trim();
        } else {
          searchQuery = `saino ${normalizedQuery} adjoining cafe bar attached`.replace(/\s+/g, ' ').trim();
        }
        console.log('[EnhancedQAAgent] Enhanced search query for Saino:', searchQuery);
      }
      
      // Also enhance if query contains saino-related terms but wasn't categorized as saino-cafe
      if (normalizedQuery.includes('saino') || normalizedQuery.includes('カフェ&バー') || normalizedQuery.includes('併設') || 
          normalizedQuery.includes('cafe&bar') || normalizedQuery.includes('adjoining')) {
        if (category !== 'saino-cafe') {
          if (language === 'ja') {
            searchQuery = `saino ${normalizedQuery} 併設 カフェ バー`.replace(/\s+/g, ' ').trim();
          } else {
            searchQuery = `saino ${normalizedQuery} adjoining cafe bar attached`.replace(/\s+/g, ' ').trim();
          }
          console.log('[EnhancedQAAgent] Enhanced search query for potential Saino query:', searchQuery);
        }
      }
      
      // Enhance basement/underground space queries
      const basementKeywords = ['地下', 'basement', 'under space', 'underスペース', 'under スペース', 'b1'];
      const hasBasementKeyword = basementKeywords.some(keyword => normalizedQuery.includes(keyword));
      
      // Specific basement space keywords
      const specificBasementSpaces = {
        'mtg': 'MTGスペース 会議室 ミーティング 予約 2時間',
        'ミーティング': 'MTGスペース 会議室 ミーティング 予約 2時間',
        '会議室': 'MTGスペース 会議室 ミーティング 予約 2時間',
        '集中': '集中スペース ブース おしゃべり禁止 予約不要',
        'focus': '集中スペース focus ブース おしゃべり禁止 予約不要',
        'アンダー': 'アンダースペース フリーアドレス 拡張画面 防音室',
        'under': 'アンダースペース under フリーアドレス 拡張画面 防音室',
        'makers': 'Makersスペース 3Dプリンタ レーザーカッター 講習',
        'メーカー': 'Makersスペース makers 3Dプリンタ レーザーカッター 講習',
        '3d': 'Makersスペース 3Dプリンタ レーザーカッター 講習',
        'レーザー': 'Makersスペース 3Dプリンタ レーザーカッター 講習'
      };
      
      if (hasBasementKeyword) {
        let spaceSpecificTerms = '';
        for (const [keyword, terms] of Object.entries(specificBasementSpaces)) {
          if (normalizedQuery.includes(keyword)) {
            spaceSpecificTerms = terms;
            break;
          }
        }
        
        // Add language-appropriate basement terms
        if (language === 'ja') {
          searchQuery = `地下 ${spaceSpecificTerms} ${normalizedQuery}`.replace(/\s+/g, ' ').trim();
        } else {
          searchQuery = `basement ${spaceSpecificTerms} ${normalizedQuery}`.replace(/\s+/g, ' ').trim();
        }
        console.log('[EnhancedQAAgent] Enhanced search query for basement space:', searchQuery);
      }
      
      console.log('[EnhancedQAAgent] Calling RAG search with query:', searchQuery);
      
      // Use multi-language search to get the best results regardless of language
      const context = await ragTool.searchKnowledgeBaseMultiLang(searchQuery, language);
      console.log('[EnhancedQAAgent] Multi-language RAG search result length:', context ? context.length : 0);
      
      if (!context) {
        console.log('[EnhancedQAAgent] No context found, returning default');
        const defaultContext = {
          en: `I couldn't find specific information about that in my knowledge base. 
                Engineer Cafe is open from 9:00 to 22:00 daily, a coworking space in Fukuoka designed for IT engineers.`,
          ja: `申し訳ございませんが、その件について具体的な情報が見つかりませんでした。
                エンジニアカフェは福岡のITエンジニア向け9:00〜22:00営業のコワーキングスペースです。`
        };
        return defaultContext[language];
      }
      
      console.log('[EnhancedQAAgent] Returning RAG context:', context.substring(0, 100) + '...');
      return context;
    } catch (error) {
      console.error('[EnhancedQAAgent] Knowledge base search error:', error);
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
    
    // Meeting room ambiguity check (before general facility-info)
    const meetingRoomKeywords = ['会議室', 'meeting room', 'ミーティング', 'mtg'];
    const hasMeetingRoom = meetingRoomKeywords.some(keyword => normalizedQuestion.includes(keyword));
    const hasSpecificFloor = normalizedQuestion.includes('2階') || normalizedQuestion.includes('2f') || 
                            normalizedQuestion.includes('地下') || normalizedQuestion.includes('basement') ||
                            normalizedQuestion.includes('under');
    
    // Check for basement/underground space queries specifically
    const basementKeywords = ['地下', 'basement', 'under space', 'underスペース', 'under スペース', 'b1'];
    const hasBasementKeyword = basementKeywords.some(keyword => normalizedQuestion.includes(keyword));
    
    if (hasBasementKeyword) {
      console.log('[EnhancedQAAgent] Detected basement space query');
      return 'facility-info'; // Handle as facility info with basement context
    }
    
    if (hasMeetingRoom && !hasSpecificFloor) {
      console.log('[EnhancedQAAgent] Detected ambiguous meeting room query - needs clarification');
      return 'meeting-room-clarification-needed';
    }

    // Saino Cafe specific (併設カフェも含む)
    // More specific Saino Cafe detection to reduce false positives
    if ((normalizedQuestion.includes('サイノ') || normalizedQuestion.includes('saino')) ||
        ((normalizedQuestion.includes('併設') || normalizedQuestion.includes('併設されてる')) &&
         (normalizedQuestion.includes('カフェ') || normalizedQuestion.includes('cafe') || normalizedQuestion.includes('bar')))) {
      console.log('[EnhancedQAAgent] Detected Saino Cafe specific query');
      return 'saino-cafe';
    }
    
    // General facility information
    if (normalizedQuestion.includes('施設') || normalizedQuestion.includes('facility') ||
        normalizedQuestion.includes('福岡市') || normalizedQuestion.includes('fukuoka') ||
        normalizedQuestion.includes('公式') || normalizedQuestion.includes('official') ||
        normalizedQuestion.includes('twitter') || normalizedQuestion.includes('x.com') ||
        normalizedQuestion.includes('会議室') || normalizedQuestion.includes('meeting room') ||
        normalizedQuestion.includes('受付') || normalizedQuestion.includes('reception') ||
        normalizedQuestion.includes('フロア') || normalizedQuestion.includes('floor') ||
        normalizedQuestion.includes('どこ') || normalizedQuestion.includes('where') ||
        normalizedQuestion.includes('場所') || normalizedQuestion.includes('location') ||
        normalizedQuestion.includes('階') || normalizedQuestion.includes('回') ||
        normalizedQuestion.includes('部屋') || normalizedQuestion.includes('room')) {
      console.log('[EnhancedQAAgent] Detected facility/location query');
      return 'facility-info';
    }
    
    // Ambiguous cafe queries - ask for clarification when unclear
    if (normalizedQuestion.includes('カフェ') || normalizedQuestion.includes('cafe')) {
      // If it contains working/facility keywords (but not saino-specific), assume Engineer Cafe
      if (normalizedQuestion.includes('コワーキング') || normalizedQuestion.includes('作業') || 
          normalizedQuestion.includes('無料') || normalizedQuestion.includes('利用')) {
        console.log('[EnhancedQAAgent] Cafe query with facility keywords, assuming Engineer Cafe');
        return 'facility-info';
      }
      // For time-related queries without specific context, ask for clarification
      if (normalizedQuestion.includes('営業時間') || normalizedQuestion.includes('時間')) {
        console.log('[EnhancedQAAgent] Ambiguous time query for cafe, requesting clarification');
        return 'cafe-clarification-needed';
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

  private async isIrrelevantResult(context: string, question: string): Promise<boolean> {
    // Skip relevance check for clarification messages
    if (context.startsWith('[curious]')) {
      return false;
    }

    // If context is too short or generic, consider it irrelevant
    if (context.length < 50) {
      console.log('[EnhancedQAAgent] Context too short, considering irrelevant');
      return true;
    }

    try {
      const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      
      const relevancePrompt = language === 'en'
        ? `Based ONLY on the following information, can you clearly answer this question: "${question}"?

Information:
${context}

Answer with only "YES" or "NO". If the information is about Engineer Cafe facilities but the question is about sports, news, or unrelated topics, answer "NO".`
        : `以下の情報のみを使用して、この質問「${question}」に明確に回答できますか？

情報:
${context}

「はい」または「いいえ」でのみ答えてください。情報がエンジニアカフェの施設に関するものでも、質問がスポーツ、ニュース、または無関係な話題の場合は「いいえ」と答えてください。`;

      const relevanceCheck = await this.generate([
        { role: 'user', content: relevancePrompt }
      ]);

      const isRelevant = relevanceCheck.text.toLowerCase().includes('yes') || 
                        relevanceCheck.text.toLowerCase().includes('はい');
      
      console.log('[EnhancedQAAgent] Relevance check result:', isRelevant ? 'RELEVANT' : 'IRRELEVANT');
      return !isRelevant;
      
    } catch (error) {
      console.error('[EnhancedQAAgent] Error in relevance check:', error);
      // If relevance check fails, assume relevant to avoid unnecessary web search
      return false;
    }
  }

  private async performWebSearch(query: string): Promise<string> {
    const webSearchTool = this._tools.get('generalWebSearch');
    if (!webSearchTool) {
      console.log('[EnhancedQAAgent] General web search tool not available');
      return 'Web search service is not available.';
    }

    try {
      const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      
      console.log('[EnhancedQAAgent] Calling general web search with query:', query);
      const result = await webSearchTool.execute({
        query: query,
        language: language,
      });

      if (result.success && result.text) {
        // Format the response with sources if available
        if (result.sources && result.sources.length > 0) {
          return webSearchTool.formatSearchResultsWithSources(result.text, result.sources, language);
        }
        return result.text;
      } else {
        console.log('[EnhancedQAAgent] Web search failed:', result.error);
        return language === 'ja' 
          ? 'インターネット検索で情報を見つけることができませんでした。'
          : 'Unable to find information through web search.';
      }
    } catch (error) {
      console.error('[EnhancedQAAgent] Web search error:', error);
      const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
      return language === 'ja' 
        ? 'インターネット検索でエラーが発生しました。'
        : 'Error occurred during web search.';
    }
  }

}