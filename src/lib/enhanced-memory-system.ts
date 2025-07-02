import { RAGSearchTool, KnowledgeSearchResult } from "@/mastra/tools/rag-search";
import { supabaseAdmin } from "./supabase";
import { getMostFrequentEmotion } from "./emotion-utils";

/**
 * Enhanced memory system with improved RAG integration and caching
 * Refactored version of SimplifiedMemorySystem
 */
export interface EnhancedMemoryConfig {
  ttlSeconds?: number;
  maxEntries?: number;
  ragCacheTtlSeconds?: number;
  enableContextualRAG?: boolean;
}

interface CachedRAGResult {
  query: string;
  results: KnowledgeSearchResult[];
  timestamp: number;
}

export class EnhancedMemorySystem {
  private ragTool: RAGSearchTool;
  private agentName: string;
  private readonly TTL_SECONDS: number;
  private readonly MAX_ENTRIES: number;
  private readonly RAG_CACHE_TTL: number;
  private readonly ENABLE_CONTEXTUAL_RAG: boolean;
  private ragCache: Map<string, CachedRAGResult> = new Map();

  constructor(agentName: string, config: EnhancedMemoryConfig = {}) {
    this.agentName = agentName;
    this.ragTool = new RAGSearchTool();
    this.TTL_SECONDS = config.ttlSeconds ?? 180; // 3 minutes default
    this.MAX_ENTRIES = config.maxEntries ?? 100;
    this.RAG_CACHE_TTL = config.ragCacheTtlSeconds ?? 60; // 1 minute cache
    this.ENABLE_CONTEXTUAL_RAG = config.enableContextualRAG ?? true;
  }

  /**
   * Store a conversation turn with enhanced metadata
   */
  async addMessage(
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      emotion?: string;
      confidence?: number;
      sessionId?: string;
      requestType?: string | null;
      isContextualResponse?: boolean;
      originalQuestion?: string;
    }
  ): Promise<void> {
    try {
      const timestamp = Date.now();
      const messageData = {
        role,
        content,
        timestamp,
        ...metadata,
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

      console.log(`[EnhancedMemory] Stored ${role} message with metadata`, {
        agentName: this.agentName,
        isContextualResponse: metadata?.isContextualResponse,
        requestType: metadata?.requestType,
      });
    } catch (error) {
      console.error('[EnhancedMemory] Error storing message:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive context with intelligent RAG integration
   */
  async getContext(
    userMessage: string,
    options?: {
      includeKnowledgeBase?: boolean;
      language?: 'ja' | 'en';
      forceRAGRefresh?: boolean;
      contextDepth?: number;
    }
  ): Promise<{
    recentMessages: Array<{ role: string; content: string; metadata?: any }>;
    knowledgeResults: KnowledgeSearchResult[];
    contextString: string;
    isContextual: boolean;
  }> {
    try {
      const { 
        includeKnowledgeBase = true,
        language = 'ja',
        forceRAGRefresh = false,
        contextDepth = 10,
      } = options || {};

      // Get recent messages with context depth control
      const recentMessages = await this.getRecentMessages(contextDepth);
      console.log(`[EnhancedMemory] Found ${recentMessages.length} recent messages`);

      // Determine if this is a contextual query
      const isContextual = this.isContextualQuery(userMessage, recentMessages);

      // Build enhanced query for RAG search
      let enhancedQuery = userMessage;
      if (this.ENABLE_CONTEXTUAL_RAG && isContextual && recentMessages.length > 0) {
        enhancedQuery = this.buildContextualQuery(userMessage, recentMessages);
        console.log('[EnhancedMemory] Enhanced query for RAG:', enhancedQuery);
      }

      // Search knowledge base with caching
      let knowledgeResults: KnowledgeSearchResult[] = [];
      if (includeKnowledgeBase && enhancedQuery.trim()) {
        knowledgeResults = await this.searchKnowledgeWithCache(
          enhancedQuery,
          language,
          forceRAGRefresh
        );
      }

      // Build comprehensive context string
      const contextString = this.buildEnhancedContext(
        recentMessages,
        knowledgeResults,
        language,
        isContextual
      );

      return {
        recentMessages,
        knowledgeResults,
        contextString,
        isContextual,
      };
    } catch (error) {
      console.error('[EnhancedMemory] Error getting context:', error);
      return {
        recentMessages: [],
        knowledgeResults: [],
        contextString: 'No context available.',
        isContextual: false,
      };
    }
  }

  /**
   * Search knowledge base with caching
   */
  private async searchKnowledgeWithCache(
    query: string,
    language: 'ja' | 'en',
    forceRefresh: boolean
  ): Promise<KnowledgeSearchResult[]> {
    const cacheKey = `${query}_${language}`;
    const now = Date.now();

    // Check cache
    if (!forceRefresh && this.ragCache.has(cacheKey)) {
      const cached = this.ragCache.get(cacheKey)!;
      if (now - cached.timestamp < this.RAG_CACHE_TTL * 1000) {
        console.log('[EnhancedMemory] Using cached RAG results');
        return cached.results;
      }
    }

    // Perform RAG search
    try {
      const ragResults = await this.ragTool.execute({
        query,
        language,
        limit: 5,
        threshold: 0.3,
      });
      
      if (ragResults.success) {
        // Cache the results
        this.ragCache.set(cacheKey, {
          query,
          results: ragResults.results,
          timestamp: now,
        });
        
        // Clean old cache entries
        this.cleanCache();
        
        return ragResults.results;
      }
    } catch (error) {
      console.warn('[EnhancedMemory] RAG search failed:', error);
    }
    
    return [];
  }

  /**
   * Build contextual query by combining current question with conversation context
   */
  private buildContextualQuery(userMessage: string, recentMessages: any[]): string {
    // Extract key topics from recent conversation
    const recentTopics = this.extractTopicsFromMessages(recentMessages.slice(-4));
    
    // Combine with current message
    const contextualParts = [userMessage];
    
    if (recentTopics.length > 0) {
      contextualParts.push(...recentTopics);
    }
    
    return contextualParts.join(' ');
  }

  /**
   * Extract key topics from messages
   */
  private extractTopicsFromMessages(messages: any[]): string[] {
    const topics = new Set<string>();
    
    const keywordPatterns = [
      // Facilities
      'エンジニアカフェ', 'engineer cafe', 'saino', 'サイノ',
      '会議室', 'meeting room', '地下', 'basement',
      // Services
      'wifi', '営業時間', 'hours', '料金', 'price',
      '予約', 'booking', 'reservation',
      // Locations
      '1階', '2階', 'first floor', 'second floor',
    ];
    
    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      keywordPatterns.forEach(pattern => {
        if (content.includes(pattern.toLowerCase())) {
          topics.add(pattern);
        }
      });
    });
    
    return Array.from(topics);
  }

  /**
   * Determine if query is contextual based on content and conversation history
   */
  private isContextualQuery(query: string, recentMessages: any[]): boolean {
    // Short queries are often contextual
    if (query.length < 20) return true;
    
    // Check for referential expressions
    const referentialPatterns = [
      'それ', 'これ', 'あれ', 'その', 'この', 'あの',
      'that', 'this', 'those', 'these', 'it',
      '前者', '後者', 'former', 'latter',
    ];
    
    const lowerQuery = query.toLowerCase();
    return referentialPatterns.some(pattern => lowerQuery.includes(pattern));
  }

  /**
   * Build enhanced context with better formatting and relevance
   */
  private buildEnhancedContext(
    recentMessages: any[],
    knowledgeResults: KnowledgeSearchResult[],
    language: 'ja' | 'en',
    isContextual: boolean
  ): string {
    const parts: string[] = [];

    // Add conversation history if contextual or has messages
    if (recentMessages.length > 0) {
      const historyHeader = language === 'ja' 
        ? '最近の会話履歴（直近3分）:'
        : 'Recent conversation (last 3 minutes):';
      
      parts.push(historyHeader);
      
      recentMessages.forEach(msg => {
        const roleLabel = msg.role === 'user' 
          ? (language === 'ja' ? 'ユーザー' : 'User')
          : (language === 'ja' ? 'アシスタント' : 'Assistant');
        
        const emotionTag = msg.metadata?.emotion ? ` [${msg.metadata.emotion}]` : '';
        parts.push(`${roleLabel}: ${msg.content}${emotionTag}`);
      });
    }

    // Add knowledge base results if available
    if (knowledgeResults.length > 0) {
      if (parts.length > 0) parts.push(''); // Add separator
      
      const knowledgeHeader = language === 'ja' 
        ? '関連知識ベース情報:'
        : 'Related knowledge base:';
      
      parts.push(knowledgeHeader);
      
      // Prioritize results by relevance and contextual match
      const prioritizedResults = isContextual 
        ? this.prioritizeContextualResults(knowledgeResults, recentMessages)
        : knowledgeResults;
      
      prioritizedResults.slice(0, 3).forEach(result => {
        parts.push(`- ${result.content}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Prioritize knowledge results based on conversation context
   */
  private prioritizeContextualResults(
    results: KnowledgeSearchResult[],
    recentMessages: any[]
  ): KnowledgeSearchResult[] {
    // Extract recent topics
    const recentTopics = this.extractTopicsFromMessages(recentMessages);
    
    // Score results based on topic relevance
    const scoredResults = results.map(result => {
      let score = result.similarity || 0;
      
      // Boost score for results matching recent topics
      recentTopics.forEach(topic => {
        if (result.content.toLowerCase().includes(topic.toLowerCase())) {
          score += 0.1;
        }
      });
      
      return { ...result, contextScore: score };
    });
    
    // Sort by contextual score
    return scoredResults.sort((a, b) => b.contextScore - a.contextScore);
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.ragCache.forEach((value, key) => {
      if (now - value.timestamp > this.RAG_CACHE_TTL * 1000) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => this.ragCache.delete(key));
  }

  /**
   * Get recent messages with depth control
   */
  private async getRecentMessages(limit: number): Promise<Array<{ role: string; content: string; metadata?: any }>> {
    try {
      const currentTime = new Date().toISOString();
      
      const { data, error } = await supabaseAdmin
        .from('agent_memory')
        .select('*')
        .eq('agent_name', this.agentName)
        .like('key', 'message_%')
        .gt('expires_at', currentTime)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('[EnhancedMemory] Error fetching recent messages:', error);
        return [];
      }

      return (data || []).map(item => ({
        role: item.value.role,
        content: item.value.content,
        metadata: item.value,
      }));
    } catch (error) {
      console.error('[EnhancedMemory] Error getting recent messages:', error);
      return [];
    }
  }

  /**
   * Update message index for efficient retrieval
   */
  private async updateMessageIndex(newTimestamp: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.TTL_SECONDS * 1000).toISOString();
      
      // Try atomic update first
      const { error } = await supabaseAdmin.rpc('update_message_index_atomic', {
        p_agent_name: this.agentName,
        p_new_timestamp: newTimestamp,
        p_max_entries: this.MAX_ENTRIES,
        p_expires_at: expiresAt
      });

      if (error) {
        console.warn('[EnhancedMemory] RPC function not available, using fallback');
        // Implement fallback if needed
      }
    } catch (error) {
      console.error('[EnhancedMemory] Error updating message index:', error);
    }
  }

  /**
   * Get memory statistics with enhanced metrics
   */
  async getMemoryStats(): Promise<{
    activeTurns: number;
    contextualQueries: number;
    cacheHitRate: number;
    dominantEmotion: string | null;
    timeSpan: number;
  }> {
    try {
      const recentMessages = await this.getRecentMessages(this.MAX_ENTRIES);
      
      const contextualCount = recentMessages.filter(
        m => m.metadata?.isContextualResponse
      ).length;
      
      const emotions = recentMessages
        .map(m => m.metadata?.emotion)
        .filter(Boolean) as string[];
      
      const cacheHits = Array.from(this.ragCache.values()).length;
      const cacheHitRate = this.ragCache.size > 0 ? cacheHits / this.ragCache.size : 0;
      
      return {
        activeTurns: recentMessages.length,
        contextualQueries: contextualCount,
        cacheHitRate,
        dominantEmotion: getMostFrequentEmotion(emotions),
        timeSpan: 3, // Fixed 3-minute window
      };
    } catch (error) {
      console.error('[EnhancedMemory] Error getting memory stats:', error);
      return {
        activeTurns: 0,
        contextualQueries: 0,
        cacheHitRate: 0,
        dominantEmotion: null,
        timeSpan: 0,
      };
    }
  }
}