import { Agent } from '@mastra/core/agent';
import { EmotionTagParser } from '../../lib/emotion-tag-parser';
import { ragSearchTool } from '../tools/rag-search';
import { SupportedLanguage } from '../types/config';
import { SupabaseMemoryAdapter } from '@/lib/supabase-memory';

export class QAAgent extends Agent {
  private memory: any;
  private supabaseMemory: SupabaseMemoryAdapter;
  private _tools: Map<string, any> = new Map();

  constructor(config: any) {
    super({
      name: 'QAAgent',
      model: config.llm.model,
      instructions: `You are a knowledgeable Q&A agent for Engineer Cafe in Fukuoka.
        Your role is to:
        1. Answer questions about Engineer Cafe services, facilities, and policies
        2. Provide information about pricing, membership, and access
        3. Help with technical and operational inquiries
        4. Direct users to appropriate staff if needed
        5. Maintain consistency with the information in your knowledge base
        
        Use the RAG tools to search for accurate, up-to-date information.
        If you don't have specific information, politely say so and offer alternatives.
        Always be helpful and professional.`,
    });
    this.memory = config.memory || new Map();
    // Use 'realtime' namespace to share memory with RealtimeAgent
    this.supabaseMemory = new SupabaseMemoryAdapter('realtime');
  }

  // Method to add tools to this agent
  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }

  async answerQuestion(question: string): Promise<string> {
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    // Get context from RAG
    const context = await this.searchKnowledgeBase(question);
    
    const prompt = language === 'en'
      ? `Based on the following context about Engineer Cafe, answer this question: ${question}\n\nContext: ${context}`
      : `エンジニアカフェについて以下の情報を参考に、この質問に答えてください: ${question}\n\n参考情報: ${context}`;
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    
    // Auto-enhance response with emotion tags
    return EmotionTagParser.enhanceAgentResponse(response.text, 'qa', language);
  }

  private async searchKnowledgeBase(query: string): Promise<string> {
    const language = await this.supabaseMemory.get('language') as SupportedLanguage || 'ja';
    
    // Try to categorize the question to improve search precision
    const category = await this.categorizeQuestion(query);
    
    try {
      // Use the RAG search tool to find relevant information
      const ragTool = this._tools.get('ragSearch') || ragSearchTool;
      console.log('[QAAgent] Searching knowledge base for:', query, 'in language:', language, 'category:', category);
      
      // Handle ambiguous cafe queries with clarification
      if (category === 'cafe-clarification-needed') {
        const clarificationMessage = language === 'en'
          ? "[curious]I'd be happy to help! Are you asking about:\n1. **Engineer Cafe** (the coworking space) - hours, facilities, usage\n2. **Saino Cafe** (the attached cafe & bar) - menu, hours, prices\n\nPlease let me know which one you're interested in![/curious]"
          : "[curious]お手伝いさせていただきます！どちらについてお聞きでしょうか：\n1. **エンジニアカフェ**（コワーキングスペース）- 営業時間、設備、利用方法\n2. **サイノカフェ**（併設のカフェ＆バー）- メニュー、営業時間、料金\n\nお聞かせください！[/curious]";
        
        console.log('[QAAgent] Requesting clarification for ambiguous cafe query');
        return clarificationMessage;
      }
      
      // For cafe queries, always use lower threshold and specific category
      const isCafeQuery = category === 'saino-cafe';
      
      // For cafe queries, try multiple search strategies
      if (isCafeQuery) {
        // Try direct saino cafe content first
        const sainoQuery = 'saino cafe operating hours schedule time';
        const sainoResult = await ragTool.execute({
          query: sainoQuery,
          language,
          limit: 10,
          threshold: 0.1, // Very low threshold to catch any saino content
        });
        
        if (sainoResult.success && sainoResult.results.length > 0) {
          // Filter results to only include saino-cafe category
          const sainoOnlyResults = sainoResult.results.filter((r: any) => 
            r.category === 'saino-cafe' || 
            r.content.toLowerCase().includes('saino') ||
            r.content.includes('サイノ')
          );
          
          if (sainoOnlyResults.length > 0) {
            console.log('[QAAgent] Found', sainoOnlyResults.length, 'Saino cafe specific results');
            const parts = sainoOnlyResults.map((item: any, i: number) => `[${item.title || 'Result'}]
${item.content}`);
            return parts.join('\n\n');
          }
        }
      }
      
      // Try with category filter if available
      if (category && category !== 'general') {
        const categoryResult = await ragTool.execute({
          query,
          language,
          category,
          limit: 5,
          threshold: isCafeQuery ? 0.1 : 0.3,
        });
        
        if (categoryResult.success && categoryResult.results.length > 0) {
          console.log('[QAAgent] Found', categoryResult.results.length, 'results with category:', category);
          const parts = categoryResult.results.map((item: any, i: number) => `[${item.title || 'Result'}]
${item.content}`);
          return parts.join('\n\n');
        }
      }
      
      // Try general search
      const context = await ragTool.searchKnowledgeBase(query, language);
      console.log('[QAAgent] Context found:', context ? context.substring(0, 100) + '...' : 'null');
      
      // If still no results, try with very low threshold
      if (!context) {
        console.log('[QAAgent] No context found, retrying with lower threshold');
        const retry = await ragTool.execute({
          query,
          language,
          limit: 10,
          threshold: 0.15,
        });
        if (retry.success && retry.results.length > 0) {
          console.log('[QAAgent] Retry successful, found', retry.results.length, 'results');
          const parts = retry.results.map((item: any, i: number) => `[${item.title || 'Result'}]
${item.content}`);
          return parts.join('\n\n');
        }
      }
      
      // If no results found, return a default context
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
      // Fallback to sample context if search fails
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
    
    // Simple categorization logic - in practice, this could use ML
    const lowerQuestion = question.toLowerCase();
    
    // Check for specific cafe mentions first
    if (lowerQuestion.includes('サイノ') || lowerQuestion.includes('saino') || lowerQuestion.includes('併設')) {
      return 'saino-cafe';
    }
    
    // Check for ambiguous cafe queries that need clarification
    if (lowerQuestion.includes('カフェ') || lowerQuestion.includes('cafe')) {
      // If it's clearly about Engineer Cafe operations
      if (lowerQuestion.includes('エンジニアカフェ') || lowerQuestion.includes('engineer cafe') || 
          lowerQuestion.includes('コワーキング') || lowerQuestion.includes('作業') || 
          lowerQuestion.includes('無料') || lowerQuestion.includes('利用')) {
        return 'engineer-cafe';
      }
      // If it's ambiguous, mark for clarification
      return 'cafe-clarification-needed';
    }
    
    if (lowerQuestion.includes('料金') || lowerQuestion.includes('price') || lowerQuestion.includes('cost')) {
      return 'pricing';
    } else if (lowerQuestion.includes('設備') || lowerQuestion.includes('facility') || lowerQuestion.includes('equipment')) {
      return 'facilities';
    } else if (lowerQuestion.includes('アクセス') || lowerQuestion.includes('access') || lowerQuestion.includes('location')) {
      return 'access';
    } else if (lowerQuestion.includes('時間') || lowerQuestion.includes('営業') || lowerQuestion.includes('開') || lowerQuestion.includes('閉') || lowerQuestion.includes('hours') || lowerQuestion.includes('open') || lowerQuestion.includes('close')) {
      return 'hours';  // 営業時間関連の新しいカテゴリ
    } else if (lowerQuestion.includes('イベント') || lowerQuestion.includes('event')) {
      return 'events';
    } else if (lowerQuestion.includes('会員') || lowerQuestion.includes('membership') || lowerQuestion.includes('member')) {
      return 'membership';
    } else if (lowerQuestion.includes('技術') || lowerQuestion.includes('technical') || lowerQuestion.includes('internet')) {
      return 'technical';
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
    
    // TODO: Implement staff notification system
    
    const message = language === 'en'
      ? "[happy]I've notified our staff about your inquiry. Someone will be with you shortly to provide detailed assistance.[/happy]"
      : "[happy]スタッフにご連絡いたしました。詳しいご案内のため、まもなくスタッフがお伺いいたします。[/happy]";
    
    return message;
  }
}
