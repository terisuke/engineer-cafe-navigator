import { SimplifiedMemorySystem } from './simplified-memory';
import { SupportedLanguage } from '@/mastra/types/config';

/**
 * Shared memory service that provides a unified memory interface for all agents
 * This solves the problem of fragmented conversation context across multiple agents
 */
export class SharedMemoryService {
  private memory: SimplifiedMemorySystem;
  private currentSessionId: string | null = null;
  private currentLanguage: SupportedLanguage = 'ja';
  
  constructor() {
    // Use a single shared namespace for all agents
    this.memory = new SimplifiedMemorySystem('shared', {
      ttlSeconds: 180, // 3 minutes
      maxEntries: 100
    });
  }
  
  /**
   * Set the current session ID for all subsequent operations
   */
  setSessionId(sessionId: string | null) {
    this.currentSessionId = sessionId;
    console.log(`[SharedMemoryService] Session ID set to: ${sessionId}`);
  }
  
  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }
  
  /**
   * Set the current language
   */
  setLanguage(language: SupportedLanguage) {
    this.currentLanguage = language;
    console.log(`[SharedMemoryService] Language set to: ${language}`);
  }
  
  /**
   * Get the current language
   */
  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }
  
  /**
   * Add a message to the conversation history
   */
  async addMessage(
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      agentName?: string;
      emotion?: string;
      confidence?: number;
      requestType?: string | null;
      [key: string]: any;
    }
  ): Promise<void> {
    try {
      await this.memory.addMessage(role, content, {
        ...metadata,
        sessionId: this.currentSessionId || undefined
      });
      
      console.log(`[SharedMemoryService] Added ${role} message${metadata?.agentName ? ` from ${metadata.agentName}` : ''}`);
    } catch (error) {
      console.error('[SharedMemoryService] Error adding message:', error);
      throw error;
    }
  }
  
  /**
   * Get conversation context for a given query
   */
  async getContext(
    query: string,
    options?: {
      includeKnowledgeBase?: boolean;
      language?: SupportedLanguage;
    }
  ) {
    const language = options?.language || this.currentLanguage;
    
    return await this.memory.getContext(query, {
      includeKnowledgeBase: options?.includeKnowledgeBase ?? false,
      language
    });
  }
  
  /**
   * Check if conversation is still active (within TTL)
   */
  async isConversationActive(): Promise<boolean> {
    return await this.memory.isConversationActive();
  }
  
  /**
   * Clear all messages for the current session
   */
  async clearSession(): Promise<void> {
    if (!this.currentSessionId) {
      console.warn('[SharedMemoryService] No session ID set, cannot clear session');
      return;
    }
    
    // Since SimplifiedMemorySystem doesn't have a clear method,
    // we'll rely on TTL to expire old messages
    console.log(`[SharedMemoryService] Session ${this.currentSessionId} will expire based on TTL`);
  }
  
  /**
   * Get recent messages for the current session
   */
  async getRecentMessages(limit: number = 10): Promise<any[]> {
    const context = await this.getContext('', {
      includeKnowledgeBase: false
    });
    
    return context.recentMessages.slice(-limit);
  }
}

// Singleton instance
let sharedMemoryInstance: SharedMemoryService | null = null;

/**
 * Get or create the shared memory service instance
 */
export function getSharedMemoryService(): SharedMemoryService {
  if (!sharedMemoryInstance) {
    sharedMemoryInstance = new SharedMemoryService();
  }
  return sharedMemoryInstance;
}

/**
 * Reset the shared memory service (mainly for testing)
 */
export function resetSharedMemoryService(): void {
  sharedMemoryInstance = null;
}