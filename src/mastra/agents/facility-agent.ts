import { Agent } from '@mastra/core/agent';
import { SupportedLanguage } from '@/mastra/types/config';
import { UnifiedAgentResponse, createUnifiedResponse } from '@/mastra/types/unified-response';

export interface FacilityAgentConfig {
  llm: {
    model: any;
  };
}

export class FacilityAgent extends Agent {
  private _tools: Map<string, any> = new Map();

  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }
  constructor(config: FacilityAgentConfig) {
    super({
      name: 'FacilityAgent',
      model: config.llm.model,
      instructions: `You are a facility information specialist for Engineer Cafe.
        You provide detailed information about:
        - Facilities and equipment (Wi-Fi, power outlets, etc.)
        - Meeting rooms and spaces
        - Basement facilities
        - Technical equipment (3D printers, etc.)
        Focus on practical details that help visitors use the facilities.
        Always respond in the same language as the question.
        
        IMPORTANT: Always start your response with an emotion tag at the very beginning.
        Available emotions: [happy], [sad], [angry], [relaxed], [surprised]
        
        - Use [happy] when describing available facilities or positive features
        - Use [sad] when mentioning unavailable facilities or limitations
        - Use [relaxed] for general facility information or neutral descriptions
        - The emotion tag MUST be the first thing in your response, before any other text`,
    });
  }

  async answerFacilityQuery(
    query: string,
    requestType: string | null,
    language: SupportedLanguage
  ): Promise<UnifiedAgentResponse> {
    console.log('[FacilityAgent] Processing query:', {
      query,
      requestType,
      language
    });

    // 施設特有の処理
    const enhancedQuery = this.enhanceQuery(query, requestType);
    
    // Enhanced RAG検索を使用
    const enhancedRagTool = this._tools.get('enhancedRagSearch');
    const ragTool = this._tools.get('ragSearch');
    const searchTool = enhancedRagTool || ragTool;
    
    if (!searchTool) {
      console.error('[FacilityAgent] No RAG search tool available');
      return this.getDefaultFacilityResponse(language, requestType);
    }

    let searchResult;
    try {
      // Enhanced RAG requires category, standard RAG doesn't
      if (searchTool === enhancedRagTool) {
        searchResult = await searchTool.execute({
          query: enhancedQuery,
          category: 'facility-info',
          language,
          includeAdvice: true,
          maxResults: 10
        });
      } else {
        searchResult = await searchTool.execute({
          query: enhancedQuery,
          language,
          limit: 10
        });
      }
    } catch (error) {
      console.error('[FacilityAgent] RAG search error:', error);
      return this.getDefaultFacilityResponse(language, requestType);
    }
    
    if (!searchResult.success) {
      return this.getDefaultFacilityResponse(language, requestType);
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
      return this.getDefaultFacilityResponse(language, requestType);
    }
    
    // 特定の地下施設についてのクエリの場合、その施設の情報のみを抽出
    if (requestType === 'basement' && context) {
      const specificFacility = this.detectSpecificFacility(query);
      if (specificFacility) {
        context = this.filterContextForSpecificFacility(context, specificFacility, language);
        console.log(`[FacilityAgent] Filtered context for specific facility: ${specificFacility}`);
      }
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
            console.log('[FacilityAgent] Filtered context:', {
              originalLength,
              filteredLength: context.length
            });
          }
        } catch (error) {
          console.error('[FacilityAgent] Context filter error:', error);
          // Continue with unfiltered context
        }
      }
    }
    
    const prompt = this.buildFacilityPrompt(query, context, requestType, language);
    
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
    
    // Determine emotion based on request type
    let emotion = 'helpful';
    if (requestType === 'wifi') {
      emotion = 'technical';
    } else if (requestType === 'basement') {
      emotion = 'guiding';
    }
    
    return createUnifiedResponse(
      response.text,
      emotion,
      'FacilityAgent',
      language,
      {
        confidence: 0.85,
        category: 'facilities',
        requestType,
        sources,
        processingInfo: {
          filtered: !!requestType,
          enhancedRag: searchTool === enhancedRagTool
        }
      }
    );
  }

  private enhanceQuery(query: string, requestType: string | null): string {
    // Wi-Fi関連の質問の強化
    if (requestType === 'wifi') {
      return `${query} 無料Wi-Fi インターネット 接続 wireless internet connection`;
    }
    // 地下施設の質問の強化
    if (query.includes('地下') || query.includes('basement') || requestType === 'basement') {
      // 特定の施設名が含まれているかチェック
      if (query.includes('MTG') || query.includes('ミーティング')) {
        return `${query} 地下MTGスペース basement meeting space B1`;
      } else if (query.includes('集中')) {
        return `${query} 地下集中スペース basement focus space B1`;
      } else if (query.includes('アンダー') || query.includes('under')) {
        return `${query} 地下アンダースペース basement under space B1`;
      } else if (query.includes('Makers') || query.includes('メーカー')) {
        return `${query} 地下Makersスペース basement makers space B1`;
      }
      // 特定の施設名がない場合のみ、すべての地下施設を含める
      return `${query} 地下 B1 B1F 地下1階 MTGスペース 集中スペース アンダースペース Makersスペース basement floor underground meeting focus under makers space`;
    }
    // 会議室の質問の強化
    if (query.includes('会議室') || query.includes('meeting room')) {
      return `${query} 会議室 ミーティングルーム meeting room MTG 予約`;
    }
    // 設備の質問の強化
    if (requestType === 'facility' || query.includes('設備') || query.includes('equipment')) {
      return `${query} 設備 電源 コンセント プリンター facilities equipment power outlet`;
    }
    return query;
  }

  private buildFacilityPrompt(
    query: string,
    context: string,
    requestType: string | null,
    language: SupportedLanguage
  ): string {
    console.log('[FacilityAgent] Building facility prompt with:', {
      queryLength: query.length,
      contextLength: context.length,
      requestType,
      language
    });

    if (requestType === 'wifi') {
      return language === 'en'
        ? `Provide specific information about Wi-Fi and internet connectivity.
          
Question: ${query}
Information: ${context}

Focus on: Wi-Fi availability, connection method, any restrictions, and coverage areas. Be specific and practical.

IMPORTANT: Start your response with an emotion tag before any other text.
- Use [happy] when Wi-Fi is available and working well
- Use [sad] if there are limitations or unavailable features
- Use [relaxed] for general Wi-Fi information
The emotion tag MUST be the very first thing in your response.`
        : `Wi-Fiとインターネット接続について具体的な情報を提供してください。

質問: ${query}
情報: ${context}

以下に焦点を当ててください：Wi-Fiの利用可否、接続方法、制限事項、利用可能エリア。具体的で実用的に答えてください。

重要：回答の最初に必ず感情タグを付けてください。
- Wi-Fiが利用可能で正常に動作している場合は[happy]を使用
- 制限や利用できない機能がある場合は[sad]を使用
- 一般的なWi-Fi情報には[relaxed]を使用
感情タグは回答の一番最初に来る必要があります。`;
    }

    if (requestType === 'basement') {
      // 特定の施設について聞かれているかチェック
      const isSpecificFacility = query.includes('MTG') || query.includes('ミーティング') || 
                                query.includes('集中') || query.includes('アンダー') || 
                                query.includes('under') || query.includes('Makers') || 
                                query.includes('メーカー');
      
      return language === 'en'
        ? `Provide specific information about ${isSpecificFacility ? 'the requested' : 'basement'} facilities and spaces.
          
Question: ${query}
Information: ${context}

${isSpecificFacility ? 
'IMPORTANT: The user is asking about a SPECIFIC facility. Only provide information about the requested facility, not all basement facilities.' :
'Focus on: available spaces, equipment, access methods, and usage guidelines. Be detailed and helpful.'}

IMPORTANT: Start your response with an emotion tag before any other text.
- Use [happy] when describing available facilities and features
- Use [sad] if certain facilities are unavailable or have restrictions
- Use [relaxed] for general facility information
The emotion tag MUST be the very first thing in your response.`
        : `${isSpecificFacility ? '質問されている特定の' : '地下'}施設とスペースについて具体的な情報を提供してください。

質問: ${query}
情報: ${context}

${isSpecificFacility ? 
'重要：ユーザーは特定の施設について質問しています。要求された施設の情報のみを提供し、すべての地下施設の情報を提供しないでください。' :
'以下に焦点を当ててください：利用可能なスペース、設備、アクセス方法、利用ガイドライン。詳細で役立つ情報を提供してください。'}

重要：回答の最初に必ず感情タグを付けてください。
- 利用可能な施設や機能を説明する際は[happy]を使用
- 特定の施設が利用できない、または制限がある場合は[sad]を使用
- 一般的な施設情報には[relaxed]を使用
感情タグは回答の一番最初に来る必要があります。`;
    }

    // 一般的な施設の質問
    return language === 'en'
      ? `Answer the facility-related question with practical details.
        
Question: ${query}
Information: ${context}

Provide specific, actionable information that helps visitors use the facilities effectively.

IMPORTANT: Start your response with an emotion tag before any other text.
- Use [happy] when describing available facilities or positive features
- Use [sad] when mentioning unavailable facilities or limitations
- Use [relaxed] for general facility information or neutral descriptions
The emotion tag MUST be the very first thing in your response.`
      : `施設関連の質問に実用的な詳細で答えてください。

質問: ${query}
情報: ${context}

訪問者が施設を効果的に利用できるよう、具体的で実行可能な情報を提供してください。

重要：回答の最初に必ず感情タグを付けてください。
- 利用可能な施設や良い機能を説明する際は[happy]を使用
- 利用できない施設や制限を言及する際は[sad]を使用
- 一般的な施設情報や中立的な説明には[relaxed]を使用
感情タグは回答の一番最初に来る必要があります。`;
  }

  private getDefaultFacilityResponse(language: SupportedLanguage, requestType?: string | null): UnifiedAgentResponse {
    const text = language === 'en'
      ? "I couldn't find specific information about that facility or equipment. [sad] Please ask the staff for detailed information about our facilities."
      : "その施設や設備に関する具体的な情報が見つかりませんでした。[sad] 施設の詳細についてはスタッフにお尋ねください。";
    
    return createUnifiedResponse(
      text,
      'apologetic',
      'FacilityAgent',
      language,
      {
        confidence: 0.3,
        category: 'facilities',
        requestType,
        sources: ['fallback']
      }
    );
  }

  private detectSpecificFacility(query: string): string | null {
    if (query.includes('MTG') || query.includes('ミーティング')) {
      return 'MTGスペース';
    } else if (query.includes('集中')) {
      return '集中スペース';
    } else if (query.includes('アンダー') || query.includes('under')) {
      return 'アンダースペース';
    } else if (query.includes('Makers') || query.includes('メーカー')) {
      return 'Makersスペース';
    }
    return null;
  }

  private filterContextForSpecificFacility(
    context: string, 
    facilityName: string, 
    language: SupportedLanguage
  ): string {
    const sections = context.split(/[。\n]+/).filter(s => s.trim());
    const filteredSections = sections.filter(section => {
      const sectionLower = section.toLowerCase();
      const facilityLower = facilityName.toLowerCase();
      
      // Check if this section is about the specific facility
      return section.includes(facilityName) || 
             sectionLower.includes(facilityLower) ||
             (facilityName === 'MTGスペース' && (sectionLower.includes('meeting') || sectionLower.includes('mtg'))) ||
             (facilityName === '集中スペース' && sectionLower.includes('focus')) ||
             (facilityName === 'アンダースペース' && sectionLower.includes('under')) ||
             (facilityName === 'Makersスペース' && sectionLower.includes('makers'));
    });
    
    if (filteredSections.length === 0) {
      // If no specific sections found, return the original context
      return context;
    }
    
    return filteredSections.join('。');
  }
}