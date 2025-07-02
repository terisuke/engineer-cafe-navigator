import { Agent } from '@mastra/core/agent';
import { SupportedLanguage } from '@/mastra/types/config';

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
        Always respond in the same language as the question.`,
    });
  }

  async answerFacilityQuery(
    query: string,
    requestType: string | null,
    language: SupportedLanguage
  ): Promise<string> {
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
      return this.getDefaultFacilityResponse(language);
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
      return this.getDefaultFacilityResponse(language);
    }
    
    if (!searchResult.success) {
      return this.getDefaultFacilityResponse(language);
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
      return this.getDefaultFacilityResponse(language);
    }
    if (requestType) {
      const contextFilterTool = this._tools.get('contextFilter');
      if (contextFilterTool) {
        try {
          const filterResult = await contextFilterTool.execute({
            context,
            requestType,
            language
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
    
    return response.text;
  }

  private enhanceQuery(query: string, requestType: string | null): string {
    // Wi-Fi関連の質問の強化
    if (requestType === 'wifi') {
      return `${query} 無料Wi-Fi インターネット 接続 wireless internet connection`;
    }
    // 地下施設の質問の強化
    if (query.includes('地下') || query.includes('basement') || requestType === 'basement') {
      return `${query} 地下 B1 B1F 地下1階 MTGスペース 集中スペース アンダースペース Makersスペース basement floor underground meeting focus under makers space 地下MTGスペース 地下集中スペース 地下アンダースペース 地下Makersスペース`;
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

Focus on: Wi-Fi availability, connection method, any restrictions, and coverage areas. Be specific and practical.`
        : `Wi-Fiとインターネット接続について具体的な情報を提供してください。

質問: ${query}
情報: ${context}

以下に焦点を当ててください：Wi-Fiの利用可否、接続方法、制限事項、利用可能エリア。具体的で実用的に答えてください。`;
    }

    if (requestType === 'basement') {
      return language === 'en'
        ? `Provide specific information about basement facilities and spaces.
          
Question: ${query}
Information: ${context}

Focus on: available spaces, equipment, access methods, and usage guidelines. Be detailed and helpful.`
        : `地下施設とスペースについて具体的な情報を提供してください。

質問: ${query}
情報: ${context}

以下に焦点を当ててください：利用可能なスペース、設備、アクセス方法、利用ガイドライン。詳細で役立つ情報を提供してください。`;
    }

    // 一般的な施設の質問
    return language === 'en'
      ? `Answer the facility-related question with practical details.
        
Question: ${query}
Information: ${context}

Provide specific, actionable information that helps visitors use the facilities effectively.`
      : `施設関連の質問に実用的な詳細で答えてください。

質問: ${query}
情報: ${context}

訪問者が施設を効果的に利用できるよう、具体的で実行可能な情報を提供してください。`;
  }

  private getDefaultFacilityResponse(language: SupportedLanguage): string {
    return language === 'en'
      ? "I couldn't find specific information about that facility or equipment. Please ask the staff for detailed information about our facilities."
      : "その施設や設備に関する具体的な情報が見つかりませんでした。施設の詳細についてはスタッフにお尋ねください。";
  }
}