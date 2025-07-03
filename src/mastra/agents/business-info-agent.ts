import { Agent } from '@mastra/core/agent';
import { SimplifiedMemorySystem } from '@/lib/simplified-memory';
import { SupportedLanguage } from '@/mastra/types/config';
import { UnifiedAgentResponse, createUnifiedResponse } from '@/mastra/types/unified-response';

export interface BusinessInfoAgentConfig {
  llm: {
    model: any;
  };
}

export class BusinessInfoAgent extends Agent {
  private _tools: Map<string, any> = new Map();
  private memory: SimplifiedMemorySystem;

  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }
  constructor(config: BusinessInfoAgentConfig) {
    super({
      name: 'BusinessInfoAgent',
      model: config.llm.model,
      instructions: `You are a business information specialist for Engineer Cafe.
        You provide accurate information about:
        - Operating hours
        - Pricing and fees
        - Location and access
        - Basic facility information
        
        IMPORTANT: Always start your response with an emotion tag.
        Available emotions: [happy], [sad], [angry], [relaxed], [surprised]
        
        Use [relaxed] for informational responses
        Use [happy] for positive information (available facilities, good news)
        Use [sad] for unavailable services or apologetic responses
        
        Example responses:
        - "[relaxed]営業時間は9:00〜22:00です。"
        - "[happy]The facility is open and available!"
        - "[sad]申し訳ございません、その施設は現在利用できません。"
        
        Answer concisely with only the requested information.
        Always respond in the same language as the question.`,
    });
    this.memory = new SimplifiedMemorySystem('shared');
  }

  async answerBusinessQuery(
    query: string, 
    category: string,
    requestType: string | null,
    language: SupportedLanguage,
    sessionId?: string
  ): Promise<UnifiedAgentResponse> {
    console.log('[BusinessInfoAgent] Processing query:', {
      query,
      category,
      requestType,
      language,
      sessionId
    });

    // Check for context inheritance for short queries
    let effectiveRequestType = requestType;
    let contextEntity: string | null = null;
    
    if (sessionId && this.isShortContextQuery(query)) {
      const memoryContext = await this.memory.getContext(query, {
        includeKnowledgeBase: false,
        language,
        inheritContext: true
      });
      
      if (memoryContext.inheritedRequestType) {
        effectiveRequestType = memoryContext.inheritedRequestType;
        console.log(`[BusinessInfoAgent] Inherited request type: ${effectiveRequestType} for query: ${query}`);
      }
      
      // 前の会話から文脈のエンティティを特定
      console.log(`[BusinessInfoAgent] Memory context:`, {
        hasContextString: !!memoryContext.contextString,
        contextLength: memoryContext.contextString?.length || 0,
        contextPreview: memoryContext.contextString?.substring(0, 200)
      });
      
      if (memoryContext.contextString) {
        if (memoryContext.contextString.includes('サイノカフェ') || memoryContext.contextString.includes('saino')) {
          contextEntity = 'saino';
          console.log(`[BusinessInfoAgent] Context entity detected: saino`);
        } else if (memoryContext.contextString.includes('エンジニアカフェ')) {
          contextEntity = 'engineer';
          console.log(`[BusinessInfoAgent] Context entity detected: engineer`);
        }
      }
    }

    // Enhance query for context-dependent cases
    let searchQuery = query;
    if (this.isShortContextQuery(query) || contextEntity) {
      searchQuery = this.enhanceContextQuery(query, effectiveRequestType, language, contextEntity);
      console.log(`[BusinessInfoAgent] Enhanced context query: ${searchQuery}`);
    }

    // Enhanced RAG検索を優先して使用
    const enhancedRagTool = this._tools.get('enhancedRagSearch');
    const ragTool = this._tools.get('ragSearch');
    const searchTool = enhancedRagTool || ragTool;
    
    if (!searchTool) {
      console.error('[BusinessInfoAgent] No RAG search tool available');
      return this.getDefaultResponse(language, category, requestType);
    }

    let searchResult;
    try {
      // Enhanced RAG requires category, standard RAG doesn't
      if (searchTool === enhancedRagTool) {
        const category = this.mapRequestTypeToCategory(effectiveRequestType);
        console.log(`[BusinessInfoAgent] Using Enhanced RAG with category: ${category}`);
        
        searchResult = await searchTool.execute({
          query: searchQuery,
          category,
          language,
          includeAdvice: true,
          maxResults: 10
        });
      } else {
        console.log('[BusinessInfoAgent] Using standard RAG as fallback');
        searchResult = await searchTool.execute({
          query: searchQuery,
          language,
          limit: 10
        });
      }
    } catch (error) {
      console.error('[BusinessInfoAgent] RAG search error:', error);
      return this.getDefaultResponse(language, category, requestType);
    }
    
    if (!searchResult.success) {
      return this.getDefaultResponse(language, category, requestType);
    }
    
    // RAG検索結果からコンテキストを構築
    let context = '';
    if (searchResult.results && Array.isArray(searchResult.results)) {
      // 標準RAGツールの結果形式
      context = searchResult.results
        .map((r: any) => r.content)
        .join('\n\n');
    } else if (searchResult.data && searchResult.data.context) {
      // エンハンスドRAGツールの結果形式
      context = searchResult.data.context;
    }

    if (!context) {
      return this.getDefaultResponse(language, category, requestType);
    }
    if (requestType) {
      const contextFilterTool = this._tools.get('contextFilter');
      if (contextFilterTool) {
        try {
          const filterResult = await contextFilterTool.execute({
            context,
            requestType,
            language,
            query
          });
          
          if (filterResult.success) {
            const originalLength = context.length;
            context = filterResult.data.filteredContext;
            console.log('[BusinessInfoAgent] Filtered context:', {
              originalLength,
              filteredLength: context.length
            });
          }
        } catch (error) {
          console.error('[BusinessInfoAgent] Context filter error:', error);
          // Continue with unfiltered context
        }
      }
    }
    
    // プロンプト構築（シンプル化）
    const prompt = this.buildPrompt(query, context, requestType, language);
    
    // LLM応答生成
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    
    // Determine sources used
    const sources = [];
    if (searchTool === enhancedRagTool) {
      sources.push('enhanced_rag');
    } else {
      sources.push('knowledge_base');
    }
    
    // Determine emotion based on request type and content
    let emotion = 'helpful';
    if (requestType === 'hours' || requestType === 'price') {
      emotion = 'informative';
    } else if (requestType === 'location') {
      emotion = 'guiding';
    }
    
    return createUnifiedResponse(
      response.text,
      emotion,
      'BusinessInfoAgent',
      language,
      {
        confidence: 0.85,
        category,
        requestType,
        sources,
        processingInfo: {
          filtered: !!requestType,
          contextInherited: effectiveRequestType !== requestType,
          enhancedRag: searchTool === enhancedRagTool
        }
      }
    );
  }

  private isShortContextQuery(query: string): boolean {
    const trimmed = query.trim();
    
    // Short queries that likely depend on context
    const contextPatterns = [
      /^土曜[日]?は.*/,          // 土曜日は... 土曜は...
      /^日曜[日]?は.*/,          // 日曜日は... 日曜は...
      /^平日は.*/,               // 平日は...
      /^saino[のは方]?.*/,       // sainoの方は... sainoは...
      /^そっち[のは]?.*/,        // そっちの方は... そっちは...
      /^あっち[のは]?.*/,        // あっちの方は... あっちは...
      /^それ[のは]?.*/,          // それの方は... それは...
      /^そこ[のは]?.*/,          // そこの方は... そこは...
    ];
    
    return contextPatterns.some(pattern => pattern.test(trimmed)) || trimmed.length < 10;
  }

  private enhanceContextQuery(query: string, requestType: string | null, language: SupportedLanguage, contextEntity?: string | null): string {
    const lowerQuery = query.toLowerCase();
    
    // Context entity takes precedence
    if (contextEntity === 'saino') {
      if (requestType === 'hours') {
        return language === 'en' ? 'saino cafe operating hours' : 'sainoカフェの営業時間';
      }
      if (requestType === 'price') {
        return language === 'en' ? 'saino cafe prices menu' : 'sainoカフェの料金 メニュー';
      }
      return language === 'en' ? 'saino cafe information' : 'sainoカフェ 情報';
    }
    
    // Entity mapping from query
    if (lowerQuery.includes('saino')) {
      if (requestType === 'hours') {
        return language === 'en' ? 'saino cafe operating hours' : 'sainoカフェの営業時間';
      }
      if (requestType === 'price') {
        return language === 'en' ? 'saino cafe prices menu' : 'sainoカフェの料金 メニュー';
      }
      return language === 'en' ? 'saino cafe information' : 'sainoカフェ 情報';
    }
    
    // Time-related queries
    if (lowerQuery.includes('土曜') || lowerQuery.includes('日曜') || lowerQuery.includes('平日')) {
      return language === 'en' ? 'engineer cafe operating hours days' : 'エンジニアカフェ 営業時間 曜日';
    }
    
    // Default enhancement based on request type
    if (requestType === 'hours') {
      // 短いクエリで文脈エンティティがある場合
      if (query.length < 10 && contextEntity) {
        const entityName = contextEntity === 'saino' ? 'sainoカフェ' : 'エンジニアカフェ';
        return language === 'en' ? `${entityName} operating hours` : `${entityName}の営業時間`;
      }
      return language === 'en' ? `${query} operating hours` : `${query} 営業時間`;
    }
    if (requestType === 'price') {
      // 短いクエリで文脈エンティティがある場合
      if (query.length < 10 && contextEntity) {
        const entityName = contextEntity === 'saino' ? 'sainoカフェ' : 'エンジニアカフェ';
        return language === 'en' ? `${entityName} price cost` : `${entityName}の料金 価格`;
      }
      return language === 'en' ? `${query} price cost` : `${query} 料金 価格`;
    }
    if (requestType === 'location') {
      // 短いクエリで文脈エンティティがある場合
      if (query.length < 10 && contextEntity) {
        const entityName = contextEntity === 'saino' ? 'sainoカフェ' : 'エンジニアカフェ';
        return language === 'en' ? `${entityName} location access` : `${entityName}の場所 アクセス`;
      }
      return language === 'en' ? `${query} location access` : `${query} 場所 アクセス`;
    }
    
    return query; // Return original if no enhancement needed
  }

  private buildPrompt(
    query: string, 
    context: string, 
    requestType: string | null,
    language: SupportedLanguage
  ): string {
    console.log('[BusinessInfoAgent] Building prompt with:', {
      queryLength: query.length,
      contextLength: context.length,
      requestType,
      language
    });

    if (requestType) {
      const requestTypePrompt = this.getRequestTypePrompt(requestType, language);
      return language === 'en'
        ? `Extract ONLY the ${requestTypePrompt} from the following information to answer the question.
          
Question: ${query}
Information: ${context}

Answer with ONLY the ${requestTypePrompt}. Maximum 1-2 sentences. Do not include any other information.
IMPORTANT: Start your response with [relaxed] for information or [happy] for positive news.`
        : `次の情報から${requestTypePrompt}のみを抽出して質問に答えてください。

質問: ${query}
情報: ${context}

${requestTypePrompt}のみを答えてください。最大1-2文。他の情報は含めないでください。
重要: 情報提供の場合は[relaxed]、良いニュースの場合は[happy]で回答を始めてください。`;
    } else {
      return language === 'en'
        ? `Answer the question using the provided information. Be concise and direct.
          
Question: ${query}
Information: ${context}

Answer briefly (1-2 sentences) with only the relevant information.
IMPORTANT: Start your response with an emotion tag: [relaxed] for information, [happy] for positive news, [sad] for unavailable services.`
        : `提供された情報を使って質問に答えてください。簡潔で直接的に答えてください。

質問: ${query}
情報: ${context}

関連する情報のみを簡潔に（1-2文）答えてください。
重要: 感情タグで回答を始めてください: 情報提供は[relaxed]、良いニュースは[happy]、利用できないサービスは[sad]。`;
    }
  }

  private mapRequestTypeToCategory(requestType: string | null): string {
    // Map request types to Enhanced RAG categories for better entity-aware scoring
    const categoryMapping: Record<string, string> = {
      'hours': 'hours',
      'price': 'pricing',
      'location': 'location', 
      'access': 'location',
      'basement': 'facility-info',
      'facility': 'facility-info',
      'wifi': 'facility-info'
    };
    
    return categoryMapping[requestType || ''] || 'general';
  }

  private getRequestTypePrompt(requestType: string, language: SupportedLanguage): string {
    const promptMap: Record<string, { en: string, ja: string }> = {
      'hours': { en: 'operating hours', ja: '営業時間' },
      'price': { en: 'pricing information', ja: '料金情報' },
      'location': { en: 'location information', ja: '場所情報' },
      'access': { en: 'access information', ja: 'アクセス情報' },
      'basement': { en: 'basement facility information', ja: '地下施設情報' }
    };
    
    const prompt = promptMap[requestType];
    return prompt ? prompt[language] : (language === 'en' ? 'requested information' : '要求された情報');
  }

  private getDefaultResponse(language: SupportedLanguage, category?: string, requestType?: string | null): UnifiedAgentResponse {
    const text = language === 'en'
      ? "[sad]I'm sorry, I couldn't find the specific information you're looking for. Please try rephrasing your question or contact the staff for assistance."
      : "[sad]申し訳ございません。お探しの情報が見つかりませんでした。質問を言い換えていただくか、スタッフにお問い合わせください。";
    
    return createUnifiedResponse(
      text,
      'apologetic',
      'BusinessInfoAgent',
      language,
      {
        confidence: 0.3,
        category,
        requestType,
        sources: ['fallback']
      }
    );
  }
}