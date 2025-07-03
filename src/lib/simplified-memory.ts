import { RAGSearchTool, KnowledgeSearchResult } from "@/mastra/tools/rag-search";
import { supabaseAdmin } from "./supabase";
import { getMostFrequentEmotion } from "./emotion-utils";

/**
 * Simplified memory system using existing Supabase infrastructure
 * Combines 3-minute short-term memory with Engineer Cafe knowledge base
 */
export interface MemoryConfig {
  ttlSeconds?: number;
  maxEntries?: number;
}

export class SimplifiedMemorySystem {
  private ragTool: RAGSearchTool;
  private agentName: string;
  private readonly TTL_SECONDS: number;
  private readonly MAX_ENTRIES: number;

  constructor(agentName: string, config: MemoryConfig = {}) {
    this.agentName = agentName;
    this.ragTool = new RAGSearchTool();
    this.TTL_SECONDS = config.ttlSeconds ?? 180; // 3 minutes default
    this.MAX_ENTRIES = config.maxEntries ?? 100; // Increased from 30 to 100
  }

  /**
   * Extract request type from user query
   */
  private extractRequestType(content: string): string | null {
    const lowerContent = content.toLowerCase();
    
    // Time/hours requests
    if (/営業時間|hours|time|何時|いつまで|when|open|close|開いて|閉まる|時間|休業日|休館日|定休日|休み|closed|holiday|day off/.test(lowerContent)) {
      return 'hours';
    }
    
    // Price/cost requests
    if (/料金|cost|price|値段|金額|fee|費用|有料|無料|いくら|how much/.test(lowerContent)) {
      return 'price';
    }
    
    // Location requests
    if (/どこ|where|場所|location|住所|address|アクセス|access|階/.test(lowerContent)) {
      return 'location';
    }
    
    // Booking/reservation requests
    if (/予約|booking|reservation|reserve|申し込み|申込/.test(lowerContent)) {
      return 'booking';
    }
    
    // Facility/equipment requests
    if (/設備|facility|equipment|何がある|what is there|利用できる/.test(lowerContent)) {
      return 'facility';
    }
    
    // Event requests
    if (/イベント|event|勉強会|セミナー|workshop/.test(lowerContent)) {
      return 'events';
    }
    
    return null;
  }

  /**
   * Store a conversation turn in short-term memory using existing agent_memory table
   */
  async addMessage(
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      emotion?: string;
      confidence?: number;
      sessionId?: string;
      requestType?: string | null;
    }
  ): Promise<void> {
    try {
      const timestamp = Date.now();
      
      // Auto-extract request type for user messages if not provided
      let requestType = metadata?.requestType;
      if (role === 'user' && !requestType) {
        requestType = this.extractRequestType(content);
      }
      
      const messageData = {
        role,
        content,
        timestamp,
        emotion: metadata?.emotion,
        confidence: metadata?.confidence,
        sessionId: metadata?.sessionId,
        requestType,
      };

      // Store in agent_memory table with TTL
      const expiresAt = new Date(timestamp + this.TTL_SECONDS * 1000).toISOString();
      
      await supabaseAdmin
        .from('agent_memory')
        .insert({
          agent_name: this.agentName,
          key: `message_${timestamp}`,
          value: messageData,
          expires_at: expiresAt,
        });

      // Update message index for efficient retrieval
      await this.updateMessageIndex(timestamp);

      console.log(`[SimplifiedMemory] Stored ${role} message with 3-minute TTL`, {
        agentName: this.agentName,
        key: `message_${timestamp}`,
        requestType: metadata?.requestType,
        sessionId: metadata?.sessionId,
        expiresAt
      });
    } catch (error) {
      console.error('[SimplifiedMemory] Error storing message:', error);
      throw error; // Rethrow to allow caller to handle the error
    }
  }

  /**
   * Extract request type from the last conversation for context inheritance
   */
  async getLastRequestType(): Promise<string | null> {
    try {
      const recentMessages = await this.getRecentMessages();
      
      // Find the most recent assistant message with metadata
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const message = recentMessages[i];
        if (message.role === 'assistant' && message.metadata?.requestType) {
          console.log(`[SimplifiedMemory] Found last request type: ${message.metadata.requestType}`);
          return message.metadata.requestType;
        }
      }
      
      return null;
    } catch (error) {
      console.error('[SimplifiedMemory] Error getting last request type:', error);
      return null;
    }
  }

  /**
   * Get comprehensive context combining conversation history and knowledge base
   */
  async getContext(
    userMessage: string,
    options?: {
      includeKnowledgeBase?: boolean;
      language?: 'ja' | 'en';
      inheritContext?: boolean;
    }
  ): Promise<{
    recentMessages: Array<{ role: string; content: string; metadata?: any }>;
    knowledgeResults: KnowledgeSearchResult[];
    contextString: string;
    inheritedRequestType?: string | null;
  }> {
    try {
      const { 
        includeKnowledgeBase = true,
        language = 'ja',
        inheritContext = true 
      } = options || {};

      // Get recent messages from agent_memory table (within 3-minute window)
      const recentMessages = await this.getRecentMessages();
      console.log(`[SimplifiedMemory] Found ${recentMessages.length} recent messages for ${this.agentName}`);

      // Check for context inheritance needs
      let inheritedRequestType: string | null = null;
      if (inheritContext) {
        inheritedRequestType = await this.getLastRequestType();
      }

      // Search knowledge base using existing RAG system
      let knowledgeResults: KnowledgeSearchResult[] = [];
      if (includeKnowledgeBase && userMessage.trim()) {
        try {
          const ragResults = await this.ragTool.execute({
            query: userMessage,
            language,
            limit: 3,
            threshold: 0.3, // Lower threshold for broader knowledge recall
          });
          
          if (ragResults.success) {
            knowledgeResults = ragResults.results;
          }
        } catch (error) {
          console.warn('[SimplifiedMemory] RAG search failed:', error);
        }
      }

      // Build comprehensive context string
      const contextString = this.buildComprehensiveContext(
        recentMessages,
        knowledgeResults,
        language
      );

      return {
        recentMessages,
        knowledgeResults,
        contextString,
        inheritedRequestType,
      };
    } catch (error) {
      console.error('[SimplifiedMemory] Error getting context:', error);
      const { language = 'ja' } = options || {};
      return {
        recentMessages: [],
        knowledgeResults: [],
        contextString: language === 'en' ? 'No conversation context available.' : '会話履歴がありません。',
        inheritedRequestType: null,
      };
    }
  }

  /**
   * Check if conversation is active (within 3-minute window)
   */
  async isConversationActive(): Promise<boolean> {
    try {
      const recentMessages = await this.getRecentMessages();
      return recentMessages.length > 0;
    } catch (error) {
      console.error('[SimplifiedMemory] Error checking conversation activity:', error);
      return false;
    }
  }

  /**
   * Get conversation summary
   */
  async getSessionSummary(language: 'ja' | 'en' = 'ja'): Promise<string> {
    try {
      const recentMessages = await this.getRecentMessages();
      const userMessages = recentMessages.filter(m => m.role === 'user').length;
      const assistantMessages = recentMessages.filter(m => m.role === 'assistant').length;

      if (userMessages === 0 && assistantMessages === 0) {
        return language === 'en' 
          ? 'No active conversation.' 
          : 'アクティブな会話はありません。';
      }

      // Extract dominant emotion from recent messages
      const emotions = recentMessages
        .map(m => m.metadata?.emotion)
        .filter(Boolean) as string[];
      
      const dominantEmotion = getMostFrequentEmotion(emotions) || 'neutral';

      if (language === 'en') {
        return `Active conversation: ${userMessages} user messages, ${assistantMessages} responses. Mood: ${dominantEmotion}.`;
      } else {
        return `アクティブな会話: ユーザー${userMessages}回、応答${assistantMessages}回。雰囲気: ${dominantEmotion}。`;
      }
    } catch (error) {
      console.error('[SimplifiedMemory] Error getting session summary:', error);
      return language === 'en' ? 'Error getting summary.' : 'サマリー取得エラー。';
    }
  }

  /**
   * Clean up expired entries automatically handled by Supabase TTL
   */
  async cleanup(): Promise<void> {
    try {
      // Remove expired entries manually if needed
      await supabaseAdmin
        .from('agent_memory')
        .delete()
        .eq('agent_name', this.agentName)
        .lt('expires_at', new Date().toISOString());
      
      console.log('[SimplifiedMemory] Cleanup completed');
    } catch (error) {
      console.error('[SimplifiedMemory] Error during cleanup:', error);
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<{
    activeTurns: number;
    oldestTurn: number | null;
    newestTurn: number | null;
    dominantEmotion: string | null;
    timeSpan: number; // in minutes
  }> {
    try {
      const recentMessages = await this.getRecentMessages();
      
      if (recentMessages.length === 0) {
        return {
          activeTurns: 0,
          oldestTurn: null,
          newestTurn: null,
          dominantEmotion: null,
          timeSpan: 0,
        };
      }

      const timestamps = recentMessages
        .map(m => m.metadata?.timestamp)
        .filter(Boolean) as number[];
      
      const oldestTurn = timestamps.length > 0 ? Math.min(...timestamps) : null;
      const newestTurn = timestamps.length > 0 ? Math.max(...timestamps) : null;
      const timeSpan = oldestTurn && newestTurn ? (newestTurn - oldestTurn) / (1000 * 60) : 0;

      const emotions = recentMessages
        .map(m => m.metadata?.emotion)
        .filter(Boolean) as string[];
      
      const dominantEmotion = getMostFrequentEmotion(emotions);

      return {
        activeTurns: recentMessages.length,
        oldestTurn,
        newestTurn,
        dominantEmotion,
        timeSpan,
      };
    } catch (error) {
      console.error('[SimplifiedMemory] Error getting memory stats:', error);
      return {
        activeTurns: 0,
        oldestTurn: null,
        newestTurn: null,
        dominantEmotion: null,
        timeSpan: 0,
      };
    }
  }

  /**
   * Get recent messages from agent_memory within 3-minute window
   */
  private async getRecentMessages(): Promise<Array<{ role: string; content: string; metadata?: any }>> {
    try {
      const currentTime = new Date().toISOString();
      console.log(`[SimplifiedMemory] Querying messages for agent: ${this.agentName}, current time: ${currentTime}`);
      
      const { data, error } = await supabaseAdmin
        .from('agent_memory')
        .select('*')
        .eq('agent_name', this.agentName)
        .like('key', 'message_%')
        .gt('expires_at', currentTime)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[SimplifiedMemory] Error fetching recent messages:', error);
        return [];
      }
      
      console.log(`[SimplifiedMemory] Retrieved ${data?.length || 0} messages from database`);

      return (data || []).map(item => ({
        role: item.value.role,
        content: item.value.content,
        metadata: {
          emotion: item.value.emotion,
          confidence: item.value.confidence,
          sessionId: item.value.sessionId,
          timestamp: item.value.timestamp,
          requestType: item.value.requestType,
        },
      }));
    } catch (error) {
      console.error('[SimplifiedMemory] Error getting recent messages:', error);
      return [];
    }
  }

  /**
   * Update message index for efficient retrieval using atomic operations
   */
  private async updateMessageIndex(newTimestamp: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.TTL_SECONDS * 1000).toISOString();
      
      // Use a PostgreSQL function call for atomic array operations
      const { error } = await supabaseAdmin.rpc('update_message_index_atomic', {
        p_agent_name: this.agentName,
        p_new_timestamp: newTimestamp,
        p_max_entries: this.MAX_ENTRIES,
        p_expires_at: expiresAt
      });

      if (error) {
        // Fallback to optimistic concurrency control if RPC function doesn't exist
        console.warn('[SimplifiedMemory] RPC function not available, using fallback approach');
        await this.updateMessageIndexFallback(newTimestamp);
      }
    } catch (error) {
      console.error('[SimplifiedMemory] Error updating message index:', error);
      // Try fallback approach
      try {
        await this.updateMessageIndexFallback(newTimestamp);
      } catch (fallbackError) {
        console.error('[SimplifiedMemory] Fallback also failed:', fallbackError);
      }
    }
  }

  /**
   * Fallback method using optimistic concurrency control
   */
  private async updateMessageIndexFallback(newTimestamp: number): Promise<void> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const expiresAt = new Date(Date.now() + this.TTL_SECONDS * 1000).toISOString();
        
        // Get current index with version info
        const { data: currentData } = await supabaseAdmin
          .from('agent_memory')
          .select('value, created_at')
          .eq('agent_name', this.agentName)
          .eq('key', 'message_index')
          .single();

        const currentIndex = currentData?.value?.timestamps || [];
        const currentVersion = currentData?.created_at;
        
        // Prepare updated index
        const updatedIndex = [...currentIndex, newTimestamp]
          .sort((a, b) => b - a) // Most recent first
          .slice(0, this.MAX_ENTRIES); // Keep only latest entries

        if (currentData) {
          // Update existing record with version check
          const { error } = await supabaseAdmin
            .from('agent_memory')
            .update({
              value: { timestamps: updatedIndex },
              expires_at: expiresAt,
              updated_at: new Date().toISOString()
            })
            .eq('agent_name', this.agentName)
            .eq('key', 'message_index')
            .eq('created_at', currentVersion);

          if (error) {
            throw error;
          }
        } else {
          // Insert new record
          const { error } = await supabaseAdmin
            .from('agent_memory')
            .insert({
              agent_name: this.agentName,
              key: 'message_index',
              value: { timestamps: updatedIndex },
              expires_at: expiresAt,
            });

          if (error) {
            throw error;
          }
        }

        // Success - exit retry loop
        return;
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }
        // Exponential backoff with jitter
        const delay = Math.random() * (50 * Math.pow(2, retryCount));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private buildComprehensiveContext(
    recentMessages: Array<{ role: string; content: string; metadata?: any }>,
    knowledgeResults: KnowledgeSearchResult[],
    language: 'ja' | 'en'
  ): string {
    const lines: string[] = [];

    // Add recent conversation context (3-minute window)
    if (recentMessages.length > 0) {
      const recentHeader = language === 'en' 
        ? 'Recent conversation (last 3 minutes):' 
        : '最近の会話履歴（直近3分）:';
      
      lines.push(recentHeader);
      
      recentMessages.forEach(msg => {
        const roleLabel = language === 'en' 
          ? (msg.role === 'user' ? 'User' : 'Assistant')
          : (msg.role === 'user' ? 'ユーザー' : 'アシスタント');
        
        const emotionInfo = msg.metadata?.emotion ? ` [${msg.metadata.emotion}]` : '';
        lines.push(`${roleLabel}: ${msg.content}${emotionInfo}`);
      });
    }

    // Add knowledge base results
    if (knowledgeResults.length > 0) {
      lines.push(''); // Empty line separator
      
      const knowledgeHeader = language === 'en' 
        ? 'Relevant Engineer Cafe information:' 
        : '関連するエンジニアカフェ情報:';
      
      lines.push(knowledgeHeader);
      
      knowledgeResults.forEach((result, index) => {
        const prefix = `${index + 1}.`;
        const categoryInfo = result.category ? ` [${result.category}]` : '';
        
        lines.push(`${prefix} ${result.content}${categoryInfo}`);
      });
    }

    return lines.length > 0 ? lines.join('\n') : 
      (language === 'en' ? 'No conversation context.' : '会話履歴がありません。');
  }

  /**
   * Get the most recent request type from user messages
   */
  async getPreviousRequestType(sessionId?: string): Promise<string | null> {
    try {
      const recentMessages = await this.getRecentMessages();
      
      // Find the most recent user message with a request type
      // If sessionId is provided, filter by that session
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i];
        if (msg.role === 'user' && msg.metadata?.requestType) {
          // Filter by sessionId if provided
          if (sessionId && msg.metadata?.sessionId !== sessionId) {
            continue;
          }
          console.log(`[SimplifiedMemory] Found previous request type: ${msg.metadata.requestType} for session: ${sessionId || 'any'}`);
          return msg.metadata.requestType;
        }
      }
      
      return null;
    } catch (error) {
      console.error('[SimplifiedMemory] Error getting previous request type:', error);
      return null;
    }
  }

}

// Export singleton instances for different agents with configuration
export const realtimeMemory = new SimplifiedMemorySystem('RealtimeAgent', {
  ttlSeconds: 180, // 3 minutes
  maxEntries: 100
});

export const qaMemory = new SimplifiedMemorySystem('QAAgent', {
  ttlSeconds: 180, // 3 minutes  
  maxEntries: 50 // QA sessions might need fewer entries
});

export const welcomeMemory = new SimplifiedMemorySystem('WelcomeAgent', {
  ttlSeconds: 60, // 1 minute for welcome interactions
  maxEntries: 20
});