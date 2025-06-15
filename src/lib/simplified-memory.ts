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
   * Store a conversation turn in short-term memory using existing agent_memory table
   */
  async addMessage(
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      emotion?: string;
      confidence?: number;
      sessionId?: string;
    }
  ): Promise<void> {
    try {
      const timestamp = Date.now();
      const messageData = {
        role,
        content,
        timestamp,
        emotion: metadata?.emotion,
        confidence: metadata?.confidence,
        sessionId: metadata?.sessionId,
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

      console.log(`[SimplifiedMemory] Stored ${role} message with 3-minute TTL`);
    } catch (error) {
      console.error('[SimplifiedMemory] Error storing message:', error);
      throw error; // Rethrow to allow caller to handle the error
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
    }
  ): Promise<{
    recentMessages: Array<{ role: string; content: string; metadata?: any }>;
    knowledgeResults: KnowledgeSearchResult[];
    contextString: string;
  }> {
    try {
      const { 
        includeKnowledgeBase = true,
        language = 'ja' 
      } = options || {};

      // Get recent messages from agent_memory table (within 3-minute window)
      const recentMessages = await this.getRecentMessages();

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
      };
    } catch (error) {
      console.error('[SimplifiedMemory] Error getting context:', error);
      const { language = 'ja' } = options || {};
      return {
        recentMessages: [],
        knowledgeResults: [],
        contextString: language === 'en' ? 'No conversation context available.' : '会話履歴がありません。',
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
      const { data, error } = await supabaseAdmin
        .from('agent_memory')
        .select('*')
        .eq('agent_name', this.agentName)
        .like('key', 'message_%')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[SimplifiedMemory] Error fetching recent messages:', error);
        return [];
      }

      return (data || []).map(item => ({
        role: item.value.role,
        content: item.value.content,
        metadata: {
          emotion: item.value.emotion,
          confidence: item.value.confidence,
          sessionId: item.value.sessionId,
          timestamp: item.value.timestamp,
        },
      }));
    } catch (error) {
      console.error('[SimplifiedMemory] Error getting recent messages:', error);
      return [];
    }
  }

  /**
   * Update message index for efficient retrieval
   */
  private async updateMessageIndex(newTimestamp: number): Promise<void> {
    try {
      // Get current index
      const { data } = await supabaseAdmin
        .from('agent_memory')
        .select('value')
        .eq('agent_name', this.agentName)
        .eq('key', 'message_index')
        .single();

      const currentIndex = data?.value?.timestamps || [];
      const updatedIndex = [...currentIndex, newTimestamp]
        .sort((a, b) => b - a) // Most recent first
        .slice(0, this.MAX_ENTRIES); // Keep only latest entries

      // Update index
      const expiresAt = new Date(Date.now() + this.TTL_SECONDS * 1000).toISOString();
      
      await supabaseAdmin
        .from('agent_memory')
        .upsert({
          agent_name: this.agentName,
          key: 'message_index',
          value: { timestamps: updatedIndex },
          expires_at: expiresAt,
        });
    } catch (error) {
      console.error('[SimplifiedMemory] Error updating message index:', error);
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