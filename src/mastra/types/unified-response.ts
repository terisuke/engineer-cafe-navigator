import { SupportedLanguage } from '@/mastra/types/config';

/**
 * Unified response interface for all Q&A agents
 * This ensures consistent response format across all agents
 * and allows VoiceOutputAgent and CharacterControlAgent to process responses uniformly
 */
export interface UnifiedAgentResponse {
  /** The actual response text */
  text: string;
  
  /** The emotion associated with the response */
  emotion: string;
  
  /** Metadata about the response */
  metadata: {
    /** Name of the agent that generated this response */
    agentName: string;
    
    /** Confidence level of the response (0-1) */
    confidence: number;
    
    /** Language of the response */
    language: SupportedLanguage;
    
    /** Category of the query that was processed */
    category?: string;
    
    /** Specific request type (e.g., 'hours', 'price', 'location') */
    requestType?: string | null;
    
    /** Source of information (e.g., 'knowledge_base', 'web_search', 'calendar') */
    sources?: string[];
    
    /** Additional processing information */
    processingInfo?: {
      /** Whether the response was filtered for specificity */
      filtered?: boolean;
      
      /** Whether context was inherited from previous conversation */
      contextInherited?: boolean;
      
      /** Whether enhanced RAG was used */
      enhancedRag?: boolean;
    };
  };
}

/**
 * Helper function to create a unified response
 */
export function createUnifiedResponse(
  text: string,
  emotion: string,
  agentName: string,
  language: SupportedLanguage,
  options: {
    confidence?: number;
    category?: string;
    requestType?: string | null;
    sources?: string[];
    processingInfo?: {
      filtered?: boolean;
      contextInherited?: boolean;
      enhancedRag?: boolean;
    };
  } = {}
): UnifiedAgentResponse {
  return {
    text,
    emotion,
    metadata: {
      agentName,
      confidence: options.confidence ?? 0.8,
      language,
      category: options.category,
      requestType: options.requestType,
      sources: options.sources,
      processingInfo: options.processingInfo
    }
  };
}

/**
 * Extract VoiceOutputRequest from UnifiedAgentResponse
 */
export function toVoiceOutputRequest(
  response: UnifiedAgentResponse,
  sessionId?: string
): {
  text: string;
  language: SupportedLanguage;
  emotion?: string;
  sessionId?: string;
  agentName?: string;
} {
  return {
    text: response.text,
    language: response.metadata.language,
    emotion: response.emotion,
    sessionId,
    agentName: response.metadata.agentName
  };
}

/**
 * Extract CharacterControlRequest from UnifiedAgentResponse
 */
export function toCharacterControlRequest(
  response: UnifiedAgentResponse
): {
  emotion?: string;
  text?: string;
  agentName?: string;
} {
  return {
    emotion: response.emotion,
    text: response.text,
    agentName: response.metadata.agentName
  };
}