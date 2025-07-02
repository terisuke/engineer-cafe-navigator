import { Agent } from '@mastra/core/agent';
import { SupportedLanguage } from '@/mastra/types/config';

export interface GeneralKnowledgeAgentConfig {
  llm: {
    model: any;
  };
}

export class GeneralKnowledgeAgent extends Agent {
  private _tools: Map<string, any> = new Map();

  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }
  constructor(config: GeneralKnowledgeAgentConfig) {
    super({
      name: 'GeneralKnowledgeAgent',
      model: config.llm.model,
      instructions: `You are a general knowledge specialist who can answer a wide range of questions.
        You handle:
        - General information about Engineer Cafe
        - AI and technology topics
        - Fukuoka tech scene and startup information
        - Questions that don't fit specific categories
        Use both knowledge base and web search when appropriate.
        Always respond in the same language as the question.`,
    });
  }

  async answerGeneralQuery(
    query: string,
    language: SupportedLanguage
  ): Promise<string> {
    console.log('[GeneralKnowledgeAgent] Processing general query:', {
      query,
      language
    });

    // Determine if this needs web search
    const needsWebSearch = this.shouldUseWebSearch(query);
    
    // Always try knowledge base first
    const ragTool = this._tools.get('ragSearch');
    let knowledgeResult: any = { success: false, data: null };
    if (ragTool) {
      try {
        knowledgeResult = await ragTool.execute({
          query,
          language,
          limit: 10
        });
      } catch (error) {
        console.error('[GeneralKnowledgeAgent] RAG search error:', error);
      }
    }
    
    let context = '';
    let sources: string[] = [];
    
    if (knowledgeResult.success) {
      if (knowledgeResult.results && Array.isArray(knowledgeResult.results)) {
        context = knowledgeResult.results
          .map((r: any) => r.content)
          .join('\n\n');
        sources.push('knowledge base');
      } else if (knowledgeResult.data && knowledgeResult.data.context) {
        context = knowledgeResult.data.context;
        sources.push('knowledge base');
      }
    }
    
    // Use web search for current information or if knowledge base has no results
    if (needsWebSearch || !context) {
      const webSearchTool = this._tools.get('generalWebSearch');
      if (webSearchTool) {
        try {
          const webResult = await webSearchTool.execute({
            query,
            language
          });
          
          if (webResult.success) {
            let webContext = '';
            if (webResult.text) {
              webContext = webResult.text;
            } else if (webResult.data && webResult.data.context) {
              webContext = webResult.data.context;
            }
            
            if (webContext) {
              context = context ? `${context}\n\n${webContext}` : webContext;
              sources.push('web search');
            }
          }
        } catch (error) {
          console.error('[GeneralKnowledgeAgent] Web search error:', error);
        }
      }
    }
    
    if (!context) {
      return this.getDefaultGeneralResponse(language);
    }
    
    const prompt = this.buildGeneralPrompt(query, context, sources, language);
    
    const response = await this.generate([
      { role: 'user', content: prompt }
    ]);
    
    return response.text;
  }

  private shouldUseWebSearch(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Keywords that indicate need for current/web information
    const webSearchKeywords = [
      // Japanese
      '最新', '現在', '今', 'ニュース', 'トレンド', 'スタートアップ', 'ベンチャー',
      '技術', 'AI', '人工知能', '機械学習', 'プログラミング',
      // English
      'latest', 'current', 'now', 'news', 'trend', 'startup', 'venture',
      'technology', 'ai', 'artificial intelligence', 'machine learning', 'programming'
    ];
    
    return webSearchKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  private buildGeneralPrompt(
    query: string,
    context: string,
    sources: string[],
    language: SupportedLanguage
  ): string {
    const sourceInfo = sources.join(' and ');
    
    if (language === 'en') {
      return `Answer the following question using the provided information from ${sourceInfo}.

Question: ${query}

Information:
${context}

Provide a comprehensive but concise answer. If the information is from web search, mention that it's current information. Be helpful and informative.`;
    } else {
      return `${sourceInfo}から提供された情報を使用して、次の質問に答えてください。

質問: ${query}

情報:
${context}

包括的だが簡潔な回答を提供してください。情報がウェブ検索からのものである場合は、それが最新の情報であることを述べてください。役立つ情報を提供してください。`;
    }
  }

  private getDefaultGeneralResponse(language: SupportedLanguage): string {
    return language === 'en'
      ? "I'm sorry, I couldn't find specific information to answer your question. Please try rephrasing your question or ask about something else."
      : "申し訳ございません。ご質問に答えるための具体的な情報が見つかりませんでした。質問を言い換えていただくか、別のことについてお尋ねください。";
  }
}