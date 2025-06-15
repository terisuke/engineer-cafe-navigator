import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface Source {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web?: Source;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

interface SearchResult {
  text: string;
  sources: Source[];
}

export class GeneralWebSearchTool {
  name = 'general-web-search';
  description = '一般的な質問に対してGoogle検索で情報を取得';
  private genAI: GoogleGenerativeAI;
  private model: any;

  schema = z.object({
    query: z.string().describe('検索クエリ'),
    language: z.string().optional().default('ja').describe('Language for the response'),
    context: z.string().optional().describe('Additional context to include in the response'),
  });

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp' 
    });
  }

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    text: string;
    sources: Source[];
    error?: string;
  }> {
    try {
      const { query, language, context } = params;

      // Build the prompt with context if available
      let prompt = query;
      if (context) {
        prompt = `${context}\n\n質問: ${query}`;
      }

      // System instruction for general web search
      const systemInstruction = language === 'ja' 
        ? `あなたは親切なAIアシスタントです。質問に対してGoogle検索を使って最新で正確な情報を提供してください。
           回答は簡潔で分かりやすく、1-2文程度でお願いします。
           情報源がある場合は信頼できるソースを優先してください。`
        : `You are a helpful AI assistant. Use Google search to provide current and accurate information for questions.
           Keep responses brief and clear - typically 1-2 sentences.
           Prioritize reliable sources when available.`;

      // Create the request with Google Search tool enabled
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }], // Enable Google Search grounding
      });

      const response = await result.response;
      const text = response.text();
      
      // Extract sources from grounding metadata
      let sources: Source[] = [];
      if (response.candidates && response.candidates[0]) {
        const candidate = response.candidates[0];
        if (candidate.groundingMetadata?.groundingChunks) {
          sources = this.extractSources(candidate.groundingMetadata);
        }
      }

      return {
        success: true,
        text: text,
        sources: sources,
      };
    } catch (error) {
      console.error('General web search error:', error);
      return {
        success: false,
        text: '',
        sources: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private extractSources(groundingMetadata: GroundingMetadata): Source[] {
    if (!groundingMetadata.groundingChunks) {
      return [];
    }
    
    return groundingMetadata.groundingChunks
      .map((chunk: GroundingChunk) => chunk.web)
      .filter((source): source is Source => source !== undefined && source.uri !== undefined)
      .map(source => ({
        uri: source.uri,
        title: source.title || new URL(source.uri).hostname,
      }));
  }

  formatSearchResultsWithSources(text: string, sources: Source[], language: string): string {
    if (sources.length === 0) {
      return text;
    }
    
    const sourcesTitle = language.toLowerCase().startsWith('ja') ? '情報源:' : 'Sources:';
    
    let formatted = text + `\n\n${sourcesTitle}\n`;
    
    sources.forEach((source, index) => {
      formatted += `${index + 1}. ${source.title}: ${source.uri}\n`;
    });
    
    return formatted;
  }

  // Helper method to determine if a query should use web search
  static shouldUseWebSearch(query: string, category: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Sports queries
    if (lowerQuery.includes('野球') || lowerQuery.includes('baseball') ||
        lowerQuery.includes('サッカー') || lowerQuery.includes('soccer') ||
        lowerQuery.includes('試合') || lowerQuery.includes('game') ||
        lowerQuery.includes('結果') || lowerQuery.includes('result') ||
        lowerQuery.includes('スコア') || lowerQuery.includes('score') ||
        lowerQuery.includes('ホークス') || lowerQuery.includes('hawks') ||
        lowerQuery.includes('ソフトバンク') || lowerQuery.includes('softbank')) {
      return true;
    }
    
    // News and current events
    if (lowerQuery.includes('ニュース') || lowerQuery.includes('news') ||
        lowerQuery.includes('最新') || lowerQuery.includes('latest') ||
        lowerQuery.includes('今日') || lowerQuery.includes('today') ||
        lowerQuery.includes('昨日') || lowerQuery.includes('yesterday')) {
      return true;
    }
    
    // Weather queries
    if (lowerQuery.includes('天気') || lowerQuery.includes('weather') ||
        lowerQuery.includes('気温') || lowerQuery.includes('temperature') ||
        lowerQuery.includes('雨') || lowerQuery.includes('rain')) {
      return true;
    }
    
    // General category queries that are not facility-related
    if (category === 'general' && 
        !lowerQuery.includes('エンジニアカフェ') && 
        !lowerQuery.includes('engineer cafe') &&
        !lowerQuery.includes('施設') && 
        !lowerQuery.includes('福岡市')) {
      return true;
    }
    
    return false;
  }
}