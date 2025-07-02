import { RouterAgent } from '@/mastra/agents/router-agent';
import { BusinessInfoAgent } from '@/mastra/agents/business-info-agent';
import { FacilityAgent } from '@/mastra/agents/facility-agent';
import { MemoryAgent } from '@/mastra/agents/memory-agent';
import { EventAgent } from '@/mastra/agents/event-agent';
import { GeneralKnowledgeAgent } from '@/mastra/agents/general-knowledge-agent';
import { SimplifiedMemorySystem } from '@/lib/simplified-memory';
import { SupportedLanguage } from '@/mastra/types/config';
import { RAGSearchTool } from '@/mastra/tools/rag-search';
import { enhancedRagSearchTool } from '@/mastra/tools/enhanced-rag-search';
import { CalendarServiceTool } from '@/mastra/tools/calendar-service';
import { GeneralWebSearchTool } from '@/mastra/tools/general-web-search';
import { contextFilterTool } from '@/mastra/tools/context-filter';

export interface QAWorkflowConfig {
  llm: {
    model: any;
  };
}

export interface QAWorkflowResult {
  answer: string;
  metadata: {
    routedTo: string;
    category: string;
    requestType: string | null;
    language: SupportedLanguage;
    confidence: number;
    processingTime: number;
  };
}

export class MainQAWorkflow {
  private routerAgent: RouterAgent;
  private businessInfoAgent: BusinessInfoAgent;
  private facilityAgent: FacilityAgent;
  private memoryAgent: MemoryAgent;
  private eventAgent: EventAgent;
  private generalKnowledgeAgent: GeneralKnowledgeAgent;
  private memorySystem: SimplifiedMemorySystem;
  private tools: Map<string, any> = new Map();

  constructor(config: QAWorkflowConfig) {
    // Initialize all agents
    this.routerAgent = new RouterAgent(config);
    this.businessInfoAgent = new BusinessInfoAgent(config);
    this.facilityAgent = new FacilityAgent(config);
    this.memoryAgent = new MemoryAgent(config);
    this.eventAgent = new EventAgent(config);
    this.generalKnowledgeAgent = new GeneralKnowledgeAgent(config);
    this.memorySystem = new SimplifiedMemorySystem('shared');
    
    // Initialize tools
    this.initializeTools();
  }
  
  private initializeTools() {
    // Initialize RAG search tools
    const ragSearchTool = new RAGSearchTool();
    const calendarServiceTool = new CalendarServiceTool();
    
    // Initialize web search with error handling
    let generalWebSearchTool: GeneralWebSearchTool | null = null;
    try {
      generalWebSearchTool = new GeneralWebSearchTool();
    } catch (error) {
      console.warn('[MainQAWorkflow] Failed to initialize GeneralWebSearchTool:', error);
    }
    
    // Register tools
    this.tools.set('ragSearch', ragSearchTool);
    this.tools.set('enhancedRagSearch', enhancedRagSearchTool);
    this.tools.set('calendarService', calendarServiceTool);
    this.tools.set('contextFilter', contextFilterTool);
    
    if (generalWebSearchTool) {
      this.tools.set('generalWebSearch', generalWebSearchTool);
    }
    
    // Register tools with all agents
    const agents = [
      this.businessInfoAgent,
      this.facilityAgent,
      this.eventAgent,
      this.generalKnowledgeAgent
    ];
    
    agents.forEach(agent => {
      if (agent.addTool) {
        this.tools.forEach((tool, name) => {
          agent.addTool(name, tool);
        });
      }
    });
  }

  async processQuestion(
    question: string,
    sessionId: string,
    requestLanguage?: SupportedLanguage
  ): Promise<QAWorkflowResult> {
    const startTime = Date.now();
    
    console.log('[MainQAWorkflow] Processing question:', {
      question,
      sessionId,
      requestLanguage
    });

    try {
      // Step 1: Route the query
      const routingResult = await this.routerAgent.routeQuery(question, sessionId);
      
      console.log('[MainQAWorkflow] Routing result:', routingResult);

      // Step 2: Process with the selected agent
      let answer: string;
      const language = requestLanguage || routingResult.language;

      switch (routingResult.agent) {
        case 'BusinessInfoAgent':
          answer = await this.businessInfoAgent.answerBusinessQuery(
            question,
            routingResult.category,
            routingResult.requestType,
            language,
            sessionId
          );
          break;

        case 'FacilityAgent':
          answer = await this.facilityAgent.answerFacilityQuery(
            question,
            routingResult.requestType,
            language
          );
          break;

        case 'MemoryAgent':
          answer = await this.memoryAgent.handleMemoryQuery(
            question,
            sessionId,
            language
          );
          break;

        case 'EventAgent':
          answer = await this.eventAgent.answerEventQuery(
            question,
            language
          );
          break;

        case 'GeneralKnowledgeAgent':
        default:
          answer = await this.generalKnowledgeAgent.answerGeneralQuery(
            question,
            language
          );
          break;
      }

      // Step 3: Store in memory
      await this.storeConversation(question, answer, sessionId, routingResult.category);

      const processingTime = Date.now() - startTime;

      return {
        answer,
        metadata: {
          routedTo: routingResult.agent,
          category: routingResult.category,
          requestType: routingResult.requestType,
          language,
          confidence: routingResult.confidence,
          processingTime
        }
      };

    } catch (error) {
      console.error('[MainQAWorkflow] Error processing question:', error);
      
      const fallbackAnswer = requestLanguage === 'en'
        ? "I apologize, but I encountered an error while processing your question. Please try again or contact staff for assistance."
        : "申し訳ございません。質問の処理中にエラーが発生しました。もう一度お試しいただくか、スタッフにお問い合わせください。";

      return {
        answer: fallbackAnswer,
        metadata: {
          routedTo: 'error',
          category: 'error',
          requestType: null,
          language: requestLanguage || 'ja',
          confidence: 0,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  private async storeConversation(
    question: string,
    answer: string,
    sessionId: string,
    category: string
  ): Promise<void> {
    try {
      // Store user question
      await this.memorySystem.addMessage('user', question, {
        sessionId
      });

      // Store assistant answer
      await this.memorySystem.addMessage('assistant', answer, {
        sessionId
      });

      console.log('[MainQAWorkflow] Conversation stored in memory');
    } catch (error) {
      console.error('[MainQAWorkflow] Error storing conversation:', error);
      // Don't fail the whole request if memory storage fails
    }
  }
}