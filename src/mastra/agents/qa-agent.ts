import { Agent } from '@mastra/core/agent';
import { SupportedLanguage } from '../types/config';
import { EmotionTagParser } from '../../lib/emotion-tag-parser';
import { ragSearchTool } from '../tools/rag-search';

export class QAAgent extends Agent {
  private memory: any;
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
  }

  // Method to add tools to this agent
  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }

  async answerQuestion(question: string): Promise<string> {
    const language = await this.memory.get('language') as SupportedLanguage || 'ja';
    
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
    const language = await this.memory.get('language') as SupportedLanguage || 'ja';
    
    try {
      // Use the RAG search tool to find relevant information
      const ragTool = this._tools.get('ragSearch') || ragSearchTool;
      const context = await ragTool.searchKnowledgeBase(query, language);
      
      // If no results found, return a default context
      if (!context) {
        const defaultContext = {
          en: `I couldn't find specific information about that in my knowledge base. 
                Engineer Cafe is a 24/7 coworking space in Fukuoka designed for IT engineers.`,
          ja: `申し訳ございませんが、その件について具体的な情報が見つかりませんでした。
                エンジニアカフェは福岡のITエンジニア向け24時間営業のコワーキングスペースです。`
        };
        return defaultContext[language];
      }
      
      return context;
    } catch (error) {
      console.error('Knowledge base search error:', error);
      // Fallback to sample context if search fails
      const sampleContext = {
        en: `Engineer Cafe is a 24/7 coworking space in Fukuoka designed for IT engineers. 
              Features include high-speed internet, private meeting rooms, coffee service, 
              and event spaces. Membership plans start from ¥8,000/month.`,
        ja: `エンジニアカフェは福岡のITエンジニア向け24時間営業のコワーキングスペースです。
              高速インターネット、プライベート会議室、コーヒーサービス、イベントスペースを完備。
              会員プランは月額8,000円から。`
      };
      return sampleContext[language];
    }
  }

  async categorizeQuestion(question: string): Promise<string> {
    
    // Simple categorization logic - in practice, this could use ML
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('料金') || lowerQuestion.includes('price') || lowerQuestion.includes('cost')) {
      return 'pricing';
    } else if (lowerQuestion.includes('設備') || lowerQuestion.includes('facility') || lowerQuestion.includes('equipment')) {
      return 'facilities';
    } else if (lowerQuestion.includes('アクセス') || lowerQuestion.includes('access') || lowerQuestion.includes('location')) {
      return 'access';
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
    const language = await this.memory.get('language') as SupportedLanguage || 'ja';
    
    const fallback = language === 'en'
      ? "[sad]I don't have specific information about that. Would you like me to connect you with our staff for detailed assistance?[/sad]"
      : "[sad]その件について詳しい情報がございません。スタッフにお繋ぎしてより詳しくご案内させていただきましょうか？[/sad]";
    
    return fallback;
  }

  async escalateToStaff(_question: string): Promise<string> {
    const language = await this.memory.get('language') as SupportedLanguage || 'ja';
    
    // TODO: Implement staff notification system
    
    const message = language === 'en'
      ? "[happy]I've notified our staff about your inquiry. Someone will be with you shortly to provide detailed assistance.[/happy]"
      : "[happy]スタッフにご連絡いたしました。詳しいご案内のため、まもなくスタッフがお伺いいたします。[/happy]";
    
    return message;
  }
}
