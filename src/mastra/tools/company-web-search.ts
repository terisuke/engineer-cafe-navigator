import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface FacilityURL {
  url: string;
  title: string;
  category: 'website' | 'social' | 'profile' | 'contact';
  keywords: string[];
}

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

export class EngineerCafeWebSearchTool {
  name = 'engineercafe-web-search';
  description = '福岡市エンジニアカフェの情報をGoogle検索で取得';
  private genAI: GoogleGenerativeAI;
  private model: any;

  schema = z.object({
    query: z.string().describe('エンジニアカフェに関する検索クエリ'),
    language: z.string().optional().default('ja').describe('Language for the response'),
    facilityContext: z.string().optional().describe('Additional facility context to include'),
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
      const { query, language, facilityContext } = params;

      // Build the prompt with facility context if available
      let prompt = query;
      if (facilityContext) {
        prompt = `Based on the following facility information:\n${facilityContext}\n\nAnswer this question: ${query}`;
      }

      // Add Engineer Cafe context to the search
      const defaultContext = this.getEngineerCafeContext(language);
      prompt = `${defaultContext}\n\n${prompt}`;

      // System instruction
      const systemInstruction = language === 'ja' 
        ? `あなたは福岡市エンジニアカフェのAIアシスタントです。エンジニアカフェは福岡市が運営する公共施設です。
           提供された情報とGoogle検索を使って質問に答えてください。
           エンジニアカフェ公式サイト（https://engineercafe.jp）とX（https://x.com/EngineerCafeJP）の情報を優先的に参照してください。
           回答は簡潔に、1-2文程度でお願いします。`
        : `You are an AI assistant for Engineer Cafe Fukuoka. Engineer Cafe is a public facility operated by Fukuoka City.
           Answer questions using provided information and Google search when needed.
           Prioritize information from the official website (https://engineercafe.jp) and X/Twitter (https://x.com/EngineerCafeJP).
           Keep responses brief - typically 1-2 sentences.`;

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
      console.error('Engineer Cafe web search error:', error);
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

  private getEngineerCafeContext(language: string): string {
    if (language === 'ja') {
      return `エンジニアカフェは福岡市が運営するITエンジニア向けの公共施設です。
公式サイト: https://engineercafe.jp
公式X: https://x.com/EngineerCafeJP
営業時間: 9:00-22:00、休館日: 毎月最終月曜日（祝日の場合は翌平日）と年末年始（12/29-1/3）
利用料金: 完全無料
所在地: 福岡市中央区天神`;
    } else {
      return `Engineer Cafe is a public facility for IT engineers operated by Fukuoka City.
Official website: https://engineercafe.jp
Official X/Twitter: https://x.com/EngineerCafeJP
Operating hours: 9:00-22:00 (Open every day)
Usage fee: Completely free
Location: Tenjin, Chuo-ku, Fukuoka City`;
    }
  }

  private getDefaultURLs(): FacilityURL[] {
    return [
      {
        url: 'https://engineercafe.jp',
        title: 'エンジニアカフェ公式サイト',
        category: 'website',
        keywords: ['エンジニアカフェ', 'engineer cafe', '福岡市', 'fukuoka', 'コワーキング', 'イベント', '施設']
      },
      {
        url: 'https://x.com/EngineerCafeJP',
        title: 'エンジニアカフェ公式X（Twitter）',
        category: 'social',
        keywords: ['twitter', 'x', 'エンジニアカフェ', 'engineer cafe', '最新情報', 'イベント情報']
      }
    ];
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
}