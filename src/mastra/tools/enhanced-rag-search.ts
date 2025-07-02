// import { ToolReturn } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { RAGPriorityScorer, ScoredSearchResult } from '@/lib/rag-priority-scorer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const enhancedRagSearchTool = {
  name: 'enhancedRagSearch',
  description: 'Enhanced RAG search with priority scoring and practical advice generation',
  schema: z.object({
    query: z.string().describe('The search query'),
    category: z.string().describe('Query category for context-aware scoring'),
    language: z.enum(['ja', 'en']).describe('Language for the query'),
    includeAdvice: z.boolean().optional().describe('Include practical advice'),
    maxResults: z.number().optional().describe('Maximum number of results to return')
  }),
  
  execute: async ({ query, category, language, includeAdvice = true, maxResults = 10 }: {
    query: string;
    category: string;
    language: 'ja' | 'en';
    includeAdvice?: boolean;
    maxResults?: number;
  }): Promise<any> => {
    try {
      console.log('[EnhancedRAGSearch] Starting search with query:', query);
      console.log('[EnhancedRAGSearch] Category:', category, 'Language:', language);
      
      // Generate embedding for the query
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: query,
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error(`Embedding API error: ${embeddingResponse.statusText}`);
      }

      const { data } = await embeddingResponse.json();
      const embedding = data[0].embedding;

      // Perform vector similarity search
      const { data: searchResults, error } = await supabase.rpc('search_knowledge_base', {
        query_embedding: embedding,
        similarity_threshold: 0.5,
        match_count: maxResults * 2 // Get more results for better scoring
      });

      if (error) {
        throw new Error(`Supabase search error: ${error.message}`);
      }

      // Apply priority scoring
      const scoredResults = RAGPriorityScorer.scoreResults(
        searchResults || [],
        query,
        category,
        language
      );

      // Take top results after scoring
      const topResults = scoredResults.slice(0, maxResults);
      
      console.log('[EnhancedRAGSearch] Top results after scoring:', 
        topResults.map(r => ({
          title: r.title,
          entity: r.entity,
          priorityScore: r.priorityScore,
          originalSimilarity: r.originalSimilarity
        }))
      );

      // Build context from scored results
      let context = enhancedRagSearchTool.buildContextFromResults(topResults, category, language);
      
      // Add practical advice if requested
      if (includeAdvice) {
        const advice = RAGPriorityScorer.generatePracticalAdvice(
          topResults,
          query,
          category,
          language
        );
        if (advice) {
          context += `\n\n${advice}`;
        }
      }

      return {
        success: true,
        data: {
          context,
          results: topResults,
          totalResults: scoredResults.length,
          topEntity: topResults[0]?.entity || 'general'
        }
      };
    } catch (error) {
      console.error('[EnhancedRAGSearch] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Build context from scored results with entity-aware formatting
   */
  buildContextFromResults(results: ScoredSearchResult[], category: string, language: 'ja' | 'en'): string {
    if (results.length === 0) return '';
    
    // Group results by entity
    const groupedResults = results.reduce((acc, result) => {
      if (!acc[result.entity]) {
        acc[result.entity] = [];
      }
      acc[result.entity].push(result);
      return acc;
    }, {} as Record<string, ScoredSearchResult[]>);
    
    // Build context with entity-aware prioritization
    let context = '';
    
    // Priority order for entities based on category
    const entityPriority = enhancedRagSearchTool.getEntityPriority(category);
    
    for (const entity of entityPriority) {
      const entityResults = groupedResults[entity];
      if (entityResults && entityResults.length > 0) {
        // Add entity header for clarity
        if (context.length > 0) context += '\n\n';
        
        if (entity === 'engineer-cafe' && language === 'ja') {
          context += '【エンジニアカフェ】\n';
        } else if (entity === 'saino' && language === 'ja') {
          context += '【sainoカフェ】\n';
        } else if (entity === 'meeting-room' && language === 'ja') {
          context += '【会議室】\n';
        }
        
        // Add content from this entity
        context += entityResults
          .map(r => r.content)
          .join('\n');
      }
    }
    
    return context;
  },

  /**
   * Get entity priority based on category
   */
  getEntityPriority(category: string): string[] {
    const priorityMap: Record<string, string[]> = {
      'pricing': ['engineer-cafe', 'saino', 'meeting-room', 'general'],
      'hours': ['engineer-cafe', 'saino', 'general', 'meeting-room'],
      'facility-info': ['engineer-cafe', 'general', 'meeting-room', 'saino'],
      'booking': ['meeting-room', 'engineer-cafe', 'general', 'saino'],
      'location': ['engineer-cafe', 'general', 'saino', 'meeting-room'],
      'default': ['engineer-cafe', 'general', 'saino', 'meeting-room']
    };
    
    return priorityMap[category] || priorityMap.default;
  }
};