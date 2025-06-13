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
   * Check if an entry already exists in the knowledge base
   */
  async checkDuplicate(entry: KnowledgeBaseEntry): Promise<{ exists: boolean; existingId?: string }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .select('id')
        .eq('content', entry.content)
        .eq('language', entry.language)
        .eq('source', entry.source || '')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }

      return {
        exists: !!data,
        existingId: data?.id
      };
    } catch (error) {
      console.error('❌ Failed to check duplicate:', error);
      return { exists: false };
    }
  }

  /**
   * Add a single entry to the knowledge base with automatic duplicate checking
   */
  async addEntry(entry: KnowledgeBaseEntry): Promise<{ id: string; success: boolean; error?: string; isDuplicate?: boolean }> {
    try {
      // Check for duplicates first
      const duplicateCheck = await this.checkDuplicate(entry);
      
      if (duplicateCheck.exists) {
        console.log(`⚠️ Duplicate entry detected for content: ${entry.content.substring(0, 50)}...`);
        return { 
          id: duplicateCheck.existingId!, 
          success: true, 
          isDuplicate: true 
        };
      }
      
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

      return { id: data.id, success: true, isDuplicate: false };
    } catch (error) {
      console.error('❌ Failed to add knowledge base entry:', error);
      return { 
        id: '', 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Add multiple entries to the knowledge base in batch with duplicate tracking
   */
  async addEntries(entries: KnowledgeBaseEntry[]): Promise<{
    successful: number;
    failed: number;
    duplicates: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    let successful = 0;
    let failed = 0;
    let duplicates = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < entries.length; i++) {
      const result = await this.addEntry(entries[i]);
      if (result.success) {
        if (result.isDuplicate) {
          duplicates++;
        } else {
          successful++;
        }
      } else {
        failed++;
        errors.push({ index: i, error: result.error || 'Unknown error' });
      }
    }

    return { successful, failed, duplicates, errors };
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
   * Get all entries with filtering and pagination
   */
  async getAll(options: {
    page?: number;
    limit?: number;
    language?: SupportedLanguage;
    category?: string;
    search?: string;
  } = {}): Promise<{
    data: Array<{
      id: string;
      content: string;
      category?: string;
      subcategory?: string;
      language: SupportedLanguage;
      source?: string;
      metadata: Record<string, any>;
      created_at: string;
      updated_at: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('knowledge_base')
        .select('id, content, category, subcategory, language, source, metadata, created_at, updated_at', { count: 'exact' });

      // Apply filters
      if (options.language) {
        query = query.eq('language', options.language);
      }
      if (options.category) {
        query = query.eq('category', options.category);
      }
      if (options.search) {
        query = query.ilike('content', `%${options.search}%`);
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      // Order by updated_at descending
      query = query.order('updated_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      console.error('Failed to get all entries:', error);
      return {
        data: [],
        total: 0,
        page: options.page || 1,
        limit: options.limit || 20,
      };
    }
  }

  /**
   * Get a single entry by ID
   */
  async getById(id: string): Promise<{
    id: string;
    content: string;
    category?: string;
    subcategory?: string;
    language: SupportedLanguage;
    source?: string;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
  } | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .select('id, content, category, subcategory, language, source, metadata, created_at, updated_at')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to get entry by ID:', error);
      return null;
    }
  }

  /**
   * Update an existing entry
   */
  async updateEntry(id: string, updates: Partial<KnowledgeBaseEntry>): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {};
      
      // Copy simple fields
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.subcategory !== undefined) updateData.subcategory = updates.subcategory;
      if (updates.language !== undefined) updateData.language = updates.language;
      if (updates.source !== undefined) updateData.source = updates.source;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      // If content is being updated, regenerate embedding
      if (updates.content !== undefined) {
        updateData.content = updates.content;
        updateData.content_embedding = await this.generateEmbedding(updates.content);
      }

      const { error } = await supabaseAdmin
        .from('knowledge_base')
        .update(updateData)
        .eq('id', id);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to update entry:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
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
   * Uses consistent padding method across the application
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.embeddingModel.embedContent(text);
      const embedding = result.embedding.values;
      
      // Google text-embedding-004 returns 768 dimensions, but database expects 1536
      // Use consistent padding method: duplicate the embedding to reach 1536 dimensions
      if (embedding.length === 768) {
        const paddedEmbedding = [
          ...embedding,
          ...embedding // Duplicate the embedding to reach 1536 total (768 * 2)
        ];
        return paddedEmbedding;
      }
      
      return embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error('Failed to generate embedding');
    }
  }
}

// Export a singleton instance
export const knowledgeBaseUtils = new KnowledgeBaseUtils();