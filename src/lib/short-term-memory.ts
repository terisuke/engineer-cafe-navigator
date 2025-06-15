import { SupabaseMemoryAdapter } from './supabase-memory';

/**
 * Short-term Memory Manager for 3-minute conversation context
 * Based on the concept from the article about maintaining recent conversation context
 */
export class ShortTermMemoryManager {
  private supabaseMemory: SupabaseMemoryAdapter;
  private readonly TTL_SECONDS = 180; // 3 minutes in seconds
  private readonly MAX_ENTRIES = 30; // Maximum number of entries to keep

  constructor(agentName: string) {
    this.supabaseMemory = new SupabaseMemoryAdapter(agentName);
  }

  /**
   * Store a conversation turn in short-term memory with 3-minute TTL
   */
  async storeConversationTurn(
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      emotion?: string;
      confidence?: number;
      timestamp?: number;
    }
  ): Promise<void> {
    try {
      const timestamp = metadata?.timestamp || Date.now();
      const turnData = {
        role,
        content,
        timestamp,
        emotion: metadata?.emotion,
        confidence: metadata?.confidence,
      };

      // Store with 3-minute TTL
      await this.supabaseMemory.set(
        `short_turn_${timestamp}`,
        turnData,
        this.TTL_SECONDS
      );

      // Update the index of all turns
      await this.updateTurnsIndex(timestamp);

      console.log(`[ShortTermMemory] Stored ${role} turn with 3-minute TTL`);
    } catch (error) {
      console.error('[ShortTermMemory] Error storing conversation turn:', error);
    }
  }

  /**
   * Get recent conversation turns from short-term memory
   */
  async getRecentTurns(limit: number = 10): Promise<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    emotion?: string;
    confidence?: number;
  }>> {
    try {
      // Get the index of all active turns
      const turnsIndex = await this.supabaseMemory.get('short_turns_index') as number[] || [];
      
      // Sort by timestamp (most recent first) and limit
      const recentTimestamps = turnsIndex
        .sort((a, b) => b - a)
        .slice(0, limit);

      // Fetch the actual turn data
      const turns = [];
      for (const timestamp of recentTimestamps) {
        const turnData = await this.supabaseMemory.get(`short_turn_${timestamp}`);
        if (turnData) {
          turns.push(turnData);
        }
      }

      return turns;
    } catch (error) {
      console.error('[ShortTermMemory] Error getting recent turns:', error);
      return [];
    }
  }

  /**
   * Get conversation context string for AI prompt
   */
  async getContextString(language: 'ja' | 'en' = 'ja'): Promise<string> {
    const recentTurns = await this.getRecentTurns(6); // Last 3 exchanges
    
    if (recentTurns.length === 0) {
      return language === 'en' 
        ? 'No recent conversation context.' 
        : '最近の会話履歴はありません。';
    }

    const contextHeader = language === 'en' 
      ? 'Recent conversation context:' 
      : '最近の会話履歴:';

    const contextLines = recentTurns.reverse().map(turn => {
      const roleLabel = language === 'en' 
        ? (turn.role === 'user' ? 'User' : 'Assistant')
        : (turn.role === 'user' ? 'ユーザー' : 'アシスタント');
      
      const emotionInfo = turn.emotion ? ` [${turn.emotion}]` : '';
      return `${roleLabel}: ${turn.content}${emotionInfo}`;
    });

    return `${contextHeader}\n${contextLines.join('\n')}`;
  }

  /**
   * Check if the conversation is still within the 3-minute window
   */
  async isConversationActive(): Promise<boolean> {
    const recentTurns = await this.getRecentTurns(1);
    if (recentTurns.length === 0) return false;

    const lastTurnTime = recentTurns[0].timestamp;
    const timeSinceLastTurn = Date.now() - lastTurnTime;
    
    return timeSinceLastTurn < (this.TTL_SECONDS * 1000);
  }

  /**
   * Get conversation summary for the current short-term session
   */
  async getSessionSummary(language: 'ja' | 'en' = 'ja'): Promise<string> {
    const allTurns = await this.getRecentTurns(20); // Get all recent turns
    
    if (allTurns.length === 0) {
      return language === 'en' 
        ? 'No conversation in the current session.' 
        : '現在のセッションに会話はありません。';
    }

    // Count turns and dominant emotions
    const userTurns = allTurns.filter(t => t.role === 'user').length;
    const assistantTurns = allTurns.filter(t => t.role === 'assistant').length;
    
    const emotions = allTurns
      .filter(t => t.emotion)
      .map(t => t.emotion)
      .filter(Boolean) as string[];
    
    const dominantEmotion = this.getMostFrequentEmotion(emotions);
    
    if (language === 'en') {
      return `Session: ${userTurns} user messages, ${assistantTurns} responses. Mood: ${dominantEmotion || 'neutral'}.`;
    } else {
      return `セッション: ユーザー${userTurns}回、応答${assistantTurns}回。雰囲気: ${dominantEmotion || '中立'}。`;
    }
  }

  /**
   * Clear expired entries and clean up memory
   */
  async cleanupExpiredEntries(): Promise<void> {
    try {
      const turnsIndex = await this.supabaseMemory.get('short_turns_index') as number[] || [];
      const now = Date.now();
      const validTimestamps: number[] = [];

      // Check each entry and remove expired ones
      for (const timestamp of turnsIndex) {
        const age = now - timestamp;
        if (age < (this.TTL_SECONDS * 1000)) {
          validTimestamps.push(timestamp);
        } else {
          // Remove expired entry
          await this.supabaseMemory.delete(`short_turn_${timestamp}`);
        }
      }

      // Update index with only valid timestamps
      await this.supabaseMemory.set('short_turns_index', validTimestamps, this.TTL_SECONDS);
      
      console.log(`[ShortTermMemory] Cleaned up ${turnsIndex.length - validTimestamps.length} expired entries`);
    } catch (error) {
      console.error('[ShortTermMemory] Error during cleanup:', error);
    }
  }

  /**
   * Store important information that should persist beyond 3 minutes
   */
  async promoteToLongTermMemory(
    key: string,
    data: any,
    reason: string
  ): Promise<void> {
    try {
      const longTermData = {
        data,
        reason,
        promotedAt: Date.now(),
        originalSource: 'short_term_memory',
      };

      // Store without TTL for long-term persistence
      await this.supabaseMemory.set(`long_term_${key}`, longTermData);
      
      console.log(`[ShortTermMemory] Promoted data to long-term memory: ${key} (${reason})`);
    } catch (error) {
      console.error('[ShortTermMemory] Error promoting to long-term memory:', error);
    }
  }

  /**
   * Get statistics about current short-term memory usage
   */
  async getMemoryStats(): Promise<{
    activeTurns: number;
    oldestTurn: number | null;
    newestTurn: number | null;
    dominantEmotion: string | null;
    timeSpan: number; // in minutes
  }> {
    const recentTurns = await this.getRecentTurns(50);
    
    if (recentTurns.length === 0) {
      return {
        activeTurns: 0,
        oldestTurn: null,
        newestTurn: null,
        dominantEmotion: null,
        timeSpan: 0,
      };
    }

    const timestamps = recentTurns.map(t => t.timestamp);
    const oldestTurn = Math.min(...timestamps);
    const newestTurn = Math.max(...timestamps);
    const timeSpan = (newestTurn - oldestTurn) / (1000 * 60); // in minutes

    const emotions = recentTurns
      .filter(t => t.emotion)
      .map(t => t.emotion)
      .filter(Boolean) as string[];
    
    const dominantEmotion = this.getMostFrequentEmotion(emotions);

    return {
      activeTurns: recentTurns.length,
      oldestTurn,
      newestTurn,
      dominantEmotion,
      timeSpan,
    };
  }

  private async updateTurnsIndex(newTimestamp: number): Promise<void> {
    try {
      const turnsIndex = await this.supabaseMemory.get('short_turns_index') as number[] || [];
      
      // Add new timestamp
      turnsIndex.push(newTimestamp);
      
      // Keep only the most recent entries and sort
      const sortedIndex = turnsIndex
        .sort((a, b) => b - a)
        .slice(0, this.MAX_ENTRIES);

      // Store updated index with TTL
      await this.supabaseMemory.set('short_turns_index', sortedIndex, this.TTL_SECONDS);
    } catch (error) {
      console.error('[ShortTermMemory] Error updating turns index:', error);
    }
  }

  private getMostFrequentEmotion(emotions: string[]): string | null {
    if (emotions.length === 0) return null;

    const emotionCount: Record<string, number> = {};
    for (const emotion of emotions) {
      emotionCount[emotion] = (emotionCount[emotion] || 0) + 1;
    }

    let maxCount = 0;
    let dominantEmotion: string | null = null;
    
    for (const [emotion, count] of Object.entries(emotionCount)) {
      if (count > maxCount) {
        maxCount = count;
        dominantEmotion = emotion;
      }
    }

    return dominantEmotion;
  }
}

// Export singleton instances for different agents
export const realtimeShortTermMemory = new ShortTermMemoryManager('RealtimeAgent');
export const qaShortTermMemory = new ShortTermMemoryManager('QAAgent');
export const welcomeShortTermMemory = new ShortTermMemoryManager('WelcomeAgent');