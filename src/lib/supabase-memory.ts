import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/types/supabase';

type AgentMemoryRow = Database['public']['Tables']['agent_memory']['Row'];
type AgentMemoryInsert = Database['public']['Tables']['agent_memory']['Insert'];

export class SupabaseMemoryAdapter {
  constructor(private agentName: string) {}

  async get(key: string): Promise<any | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('agent_memory')
        .select('value, expires_at')
        .eq('agent_name', this.agentName)
        .eq('key', key)
        .single();

      if (error || !data) return null;

      // Check if expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        await this.delete(key);
        return null;
      }

      return data.value;
    } catch (error) {
      console.error('Memory get error:', error);
      return null;
    }
  }

  async store(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const expires_at = ttl ? new Date(Date.now() + ttl * 1000).toISOString() : null;

      const { error } = await supabaseAdmin
        .from('agent_memory')
        .upsert({
          agent_name: this.agentName,
          key,
          value,
          expires_at,
        }, {
          onConflict: 'agent_name,key'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Memory store error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('agent_memory')
        .delete()
        .eq('agent_name', this.agentName)
        .eq('key', key);

      if (error) throw error;
    } catch (error) {
      console.error('Memory delete error:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('agent_memory')
        .delete()
        .eq('agent_name', this.agentName);

      if (error) throw error;
    } catch (error) {
      console.error('Memory clear error:', error);
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('agent_memory')
        .select('key')
        .eq('agent_name', this.agentName);

      if (error) throw error;

      return data?.map(row => row.key) || [];
    } catch (error) {
      console.error('Memory getAllKeys error:', error);
      return [];
    }
  }
}

// Conversation session management
export class ConversationManager {
  static async createSession(
    visitorId?: string,
    language: 'ja' | 'en' = 'ja'
  ): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('conversation_sessions')
      .insert({
        visitor_id: visitorId,
        language,
        mode: 'welcome',
        status: 'active',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async addToHistory(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    audioUrl?: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('conversation_history')
      .insert({
        session_id: sessionId,
        role,
        content,
        audio_url: audioUrl,
      });

    if (error) throw error;
  }

  static async getHistory(sessionId: string, limit: number = 10) {
    const { data, error } = await supabaseAdmin
      .from('conversation_history')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data?.reverse() || [];
  }

  static async endSession(sessionId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('conversation_sessions')
      .update({
        ended_at: new Date().toISOString(),
        status: 'completed',
      })
      .eq('id', sessionId);

    if (error) throw error;
  }
}
