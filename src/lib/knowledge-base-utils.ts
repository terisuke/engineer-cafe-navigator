import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from './supabase';
import { SupportedLanguage } from '../mastra/types/config';

export interface KnowledgeBaseEntry {
  content: string;
  category?: string;
  subcategory?: string;
  language: SupportedLanguage;
  source?: string;
  metadata?: Record<string, any>;
}

export class KnowledgeBaseUtils {
  private genAI: GoogleGenerativeAI;
  private embeddingModel: any;

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
  }

  /**
   * Add a single entry to the knowledge base with automatic embedding generation
   */
  async addEntry(entry: KnowledgeBaseEntry): Promise<{ id: string; success: boolean; error?: string }> {
    try {
      // Generate embedding for the content
      const embedding = await this.generateEmbedding(entry.content);

      // Insert into database
      const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .insert({
          content: entry.content,
          content_embedding: embedding,
          category: entry.category,
          subcategory: entry.subcategory,
          language: entry.language,
          source: entry.source,
          metadata: entry.metadata || {},
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return { id: data.id, success: true };
    } catch (error) {
      console.error('Failed to add knowledge base entry:', error);
      return { 
        id: '', 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Add multiple entries to the knowledge base in batch
   */
  async addEntries(entries: KnowledgeBaseEntry[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    let successful = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < entries.length; i++) {
      const result = await this.addEntry(entries[i]);
      if (result.success) {
        successful++;
      } else {
        failed++;
        errors.push({ index: i, error: result.error || 'Unknown error' });
      }
    }

    return { successful, failed, errors };
  }

  /**
   * Update the embedding for existing entries that have content but no embedding
   */
  async updateMissingEmbeddings(): Promise<{ updated: number; failed: number }> {
    try {
      // Get entries without embeddings
      const { data: entries, error } = await supabaseAdmin
        .from('knowledge_base')
        .select('id, content')
        .is('content_embedding', null);

      if (error) {
        throw error;
      }

      let updated = 0;
      let failed = 0;

      for (const entry of entries || []) {
        try {
          const embedding = await this.generateEmbedding(entry.content);
          
          const { error: updateError } = await supabaseAdmin
            .from('knowledge_base')
            .update({ content_embedding: embedding })
            .eq('id', entry.id);

          if (updateError) {
            throw updateError;
          }

          updated++;
        } catch (error) {
          console.error(`Failed to update embedding for entry ${entry.id}:`, error);
          failed++;
        }
      }

      return { updated, failed };
    } catch (error) {
      console.error('Failed to update missing embeddings:', error);
      return { updated: 0, failed: -1 };
    }
  }

  /**
   * Search the knowledge base by category
   */
  async getByCategory(category: string, language?: SupportedLanguage): Promise<Array<{
    id: string;
    content: string;
    subcategory?: string;
    metadata: Record<string, any>;
  }>> {
    let query = supabaseAdmin
      .from('knowledge_base')
      .select('id, content, subcategory, metadata')
      .eq('category', category);

    if (language) {
      query = query.eq('language', language);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get entries by category:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Delete an entry from the knowledge base
   */
  async deleteEntry(id: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('knowledge_base')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Failed to delete knowledge base entry:', error);
      return false;
    }
  }

  /**
   * Get statistics about the knowledge base
   */
  async getStats(): Promise<{
    total: number;
    byLanguage: Record<string, number>;
    byCategory: Record<string, number>;
    withEmbeddings: number;
    withoutEmbeddings: number;
  }> {
    try {
      // Get total count
      const { count: total } = await supabaseAdmin
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true });

      // Get counts by language
      const { data: languageData } = await supabaseAdmin
        .from('knowledge_base')
        .select('language')
        .not('language', 'is', null);

      const byLanguage: Record<string, number> = {};
      languageData?.forEach((item) => {
        byLanguage[item.language] = (byLanguage[item.language] || 0) + 1;
      });

      // Get counts by category
      const { data: categoryData } = await supabaseAdmin
        .from('knowledge_base')
        .select('category')
        .not('category', 'is', null);

      const byCategory: Record<string, number> = {};
      categoryData?.forEach((item) => {
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      });

      // Get counts with/without embeddings
      const { count: withEmbeddings } = await supabaseAdmin
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true })
        .not('content_embedding', 'is', null);

      const { count: withoutEmbeddings } = await supabaseAdmin
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true })
        .is('content_embedding', null);

      return {
        total: total || 0,
        byLanguage,
        byCategory,
        withEmbeddings: withEmbeddings || 0,
        withoutEmbeddings: withoutEmbeddings || 0,
      };
    } catch (error) {
      console.error('Failed to get knowledge base stats:', error);
      return {
        total: 0,
        byLanguage: {},
        byCategory: {},
        withEmbeddings: 0,
        withoutEmbeddings: 0,
      };
    }
  }

  /**
   * Generate embedding for text (public method for external use)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error('Failed to generate embedding');
    }
  }
}

// Export a singleton instance
export const knowledgeBaseUtils = new KnowledgeBaseUtils();