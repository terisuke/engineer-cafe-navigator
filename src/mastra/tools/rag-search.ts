import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase';
import { SupportedLanguage } from '../types/config';

// Types for the knowledge base search results
export interface KnowledgeSearchResult {
  id: string;
  title?: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  category?: string;
  subcategory?: string;
  language: SupportedLanguage;
}

export class RAGSearchTool {
  name = 'rag-search';
  description = 'Search the Engineer Cafe knowledge base using semantic similarity';
  
  private openaiApiKey: string;
  
  schema = z.object({
    query: z.string().describe('The search query to find relevant information'),
    language: z.enum(['ja', 'en']).optional().describe('Language for the search (defaults to ja)'),
    category: z.string().optional().describe('Filter by specific category'),
    limit: z.number().min(1).max(10).optional().default(5).describe('Maximum number of results to return'),
    threshold: z.number().min(0).max(1).optional().default(0.5).describe('Minimum similarity threshold'),
  });

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    
    this.openaiApiKey = apiKey;
  }

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    results: KnowledgeSearchResult[];
    message?: string;
  }> {
    const { query, language = 'ja', category, limit = 5, threshold = 0.5 } = params;

    try {
      // Keep query as is to match knowledge base content exactly
      const normalizedQuery = query; // Removed term conversion that was causing search mismatches
      
      // Generate embedding for the query
      const embedding = await this.generateEmbedding(normalizedQuery);
      
      // Search the knowledge base
      const results = await this.performKnowledgeBaseSearch({
        embedding,
        language,
        category,
        limit,
        threshold,
      });

      // Sort by metadata.importance (critical>high>medium>low>undefined) then similarity
      const importanceRank = (imp?: string) => {
        switch ((imp || '').toLowerCase()) {
          case 'critical': return 4;
          case 'high': return 3;
          case 'medium': return 2;
          case 'low': return 1;
          default: return 0;
        }
      };

      // Check if this is a specific query (e.g., Saino Cafe)
      const isSpecificQuery = query.toLowerCase().includes('saino') || 
                             query.toLowerCase().includes('才能') ||
                             query.toLowerCase().includes('併設');

      const sorted = results.sort((a,b)=>{
        // For specific queries, prioritize similarity over importance
        if (isSpecificQuery) {
          // If similarity difference is significant (>0.2), use similarity
          const simDiff = b.similarity - a.similarity;
          if (Math.abs(simDiff) > 0.2) {
            return simDiff;
          }
        }

        const diffImp = importanceRank(b.metadata?.importance) - importanceRank(a.metadata?.importance);
        if (diffImp !== 0) return diffImp;

        // Boost if content directly includes the query string
        const queryLower = query.toLowerCase();
        const aContains = a.content.toLowerCase().includes(queryLower) ? 1 : 0;
        const bContains = b.content.toLowerCase().includes(queryLower) ? 1 : 0;
        if (aContains !== bContains) return bContains - aContains; // prefer inclusion

        return b.similarity - a.similarity;
      });

      return {
        success: true,
        results: sorted,
        message: results.length > 0 
          ? `Found ${results.length} relevant results` 
          : 'No matching results found',
      };
    } catch (error) {
      console.error('RAG search error:', error);
      return {
        success: false,
        results: [],
        message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small', // 1536 dimensions
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error('Failed to generate embedding for the query');
    }
  }

  private async performKnowledgeBaseSearch(params: {
    embedding: number[];
    language: SupportedLanguage;
    category?: string;
    limit: number;
    threshold: number;
  }): Promise<KnowledgeSearchResult[]> {
    const { embedding, language, category, limit, threshold } = params;

    try {
      // Use Supabase RPC function for vector similarity search
      const { data, error } = await supabaseAdmin.rpc('search_knowledge_base', {
        query_embedding: embedding,
        similarity_threshold: threshold,
        match_count: limit * 5, // Get more results to filter by language/category
      });

      if (error) {
        // Fallback to direct query if RPC function doesn't exist
        return await this.fallbackSearch(params);
      }

      // Filter results by language and category
      let filteredData = data || [];
      
      // Filter by language
      filteredData = filteredData.filter((item: any) => item.language === language);
      
      // Filter by category if specified
      if (category) {
        filteredData = filteredData.filter((item: any) => item.category === category);
      }
      
      console.log(`[performKnowledgeBaseSearch] Found ${data?.length || 0} total results, ${filteredData.length} after filtering (language: ${language}, category: ${category || 'none'})`);

      // Transform the results
      return filteredData.map((item: any) => ({
        id: item.id,
        title: item.metadata?.title || item.subcategory || item.category || 'Untitled',
        content: item.content,
        metadata: item.metadata || {},
        similarity: item.similarity || 0,
        category: item.category,
        subcategory: item.subcategory,
        language: item.language,
      }));
    } catch (error) {
      console.error('Knowledge base search error:', error);
      throw new Error('Failed to search knowledge base');
    }
  }

  private async fallbackSearch(params: {
    embedding: number[];
    language: SupportedLanguage;
    category?: string;
    limit: number;
    threshold: number;
  }): Promise<KnowledgeSearchResult[]> {
    const { embedding, language, category, limit } = params;

    try {
      // First, get all relevant records
      let query = supabaseAdmin
        .from('knowledge_base')
        .select('*')
        .eq('language', language);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Calculate cosine similarity for each record
      const resultsWithSimilarity: KnowledgeSearchResult[] = [];
      
      for (const item of data) {
        // Parse the embedding if it's stored as a string
        let itemEmbedding: number[];
        if (typeof item.content_embedding === 'string') {
          try {
            itemEmbedding = JSON.parse(item.content_embedding);
          } catch {
            continue;
          }
        } else if (Array.isArray(item.content_embedding)) {
          itemEmbedding = item.content_embedding;
        } else {
          continue;
        }

        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(embedding, itemEmbedding);
        
        // Only include items that meet the threshold
        if (similarity >= params.threshold) {
          resultsWithSimilarity.push({
            id: item.id,
            title: item.metadata?.title || item.subcategory || item.category || 'Untitled',
            content: item.content,
            metadata: item.metadata || {},
            similarity,
            category: item.category,
            subcategory: item.subcategory,
            language: item.language,
          });
        }
      }

      return resultsWithSimilarity
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error('Fallback search error:', error);
      throw new Error('Failed to perform fallback search');
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  // Helper method to search and format results for agent use
  async searchKnowledgeBase(query: string, language: SupportedLanguage = 'ja'): Promise<string> {
    console.log('[RAGSearchTool] searchKnowledgeBase called with:', { query, language });
    
    const result = await this.execute({
      query,
      language,
      limit: 5,
      threshold: 0.3,  // Lower threshold for more results with OpenAI embeddings
    });

    console.log('[RAGSearchTool] Search result:', {
      success: result.success,
      resultCount: result.results.length,
      message: result.message
    });

    if (!result.success || result.results.length === 0) {
      console.log('[RAGSearchTool] No results found, returning empty string');
      return '';
    }

    // Format results as a context string
    const contextParts = result.results.map((item, index) => {
      const title = item.title || `Result ${index + 1}`;
      console.log(`[RAGSearchTool] Result ${index + 1}:`, {
        title,
        similarity: item.similarity,
        contentLength: item.content.length,
        category: item.category
      });
      // Return only the content without the title in brackets
      return item.content;
    });

    const finalContext = contextParts.join('\n\n');
    console.log('[RAGSearchTool] Returning context length:', finalContext.length);
    return finalContext;
  }

  // Multi-language search: search both languages and combine results
  async searchKnowledgeBaseMultiLang(query: string, primaryLanguage: SupportedLanguage = 'ja'): Promise<string> {
    console.log('[RAGSearchTool] searchKnowledgeBaseMultiLang called with:', { query, primaryLanguage });
    
    // Search both languages in parallel
    const [primaryResult, secondaryResult] = await Promise.all([
      this.execute({
        query,
        language: primaryLanguage,
        limit: 10,
        threshold: 0.2,
      }),
      this.execute({
        query,
        language: primaryLanguage === 'ja' ? 'en' : 'ja',
        limit: 5,
        threshold: 0.2,
      })
    ]);

    console.log('[RAGSearchTool] Multi-language search results:', {
      primary: { success: primaryResult.success, count: primaryResult.results.length },
      secondary: { success: secondaryResult.success, count: secondaryResult.results.length }
    });

    // Combine results, prioritizing primary language
    const allResults = [
      ...primaryResult.results,
      ...secondaryResult.results
    ];

    if (allResults.length === 0) {
      console.log('[RAGSearchTool] No results found in either language');
      return '';
    }

    // Remove duplicates based on content similarity
    const uniqueResults = this.removeDuplicateResults(allResults);

    // Format results as a context string
    const contextParts = uniqueResults.map((item, index) => {
      const title = item.title || `Result ${index + 1}`;
      console.log(`[RAGSearchTool] Multi-lang result ${index + 1}:`, {
        title,
        similarity: item.similarity,
        language: item.language,
        contentLength: item.content.length,
        category: item.category
      });
      // Return only the content without the title in brackets
      return item.content;
    });

    const finalContext = contextParts.join('\n\n');
    console.log('[RAGSearchTool] Multi-lang returning context length:', finalContext.length);
    return finalContext;
  }

  private removeDuplicateResults(results: KnowledgeSearchResult[]): KnowledgeSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      // Use category + subcategory as duplicate key
      const key = `${result.category}/${result.subcategory}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

// Export a singleton instance for use in agents
export const ragSearchTool = new RAGSearchTool();