import { createClient } from '@supabase/supabase-js'

// Database types (後で supabase gen types typescript で生成可能)
export interface Database {
  public: {
    Tables: {
      conversation_sessions: {
        Row: {
          id: string
          visitor_id: string | null
          language: 'ja' | 'en'
          mode: string
          started_at: string
          ended_at: string | null
          status: string
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['conversation_sessions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['conversation_sessions']['Insert']>
      }
      conversation_history: {
        Row: {
          id: string
          session_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          audio_url: string | null
          metadata: Record<string, any>
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['conversation_history']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['conversation_history']['Insert']>
      }
      knowledge_base: {
        Row: {
          id: string
          content: string
          content_embedding: number[] | null
          category: string | null
          subcategory: string | null
          language: 'ja' | 'en'
          source: string | null
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['knowledge_base']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['knowledge_base']['Insert']>
      }
      agent_memory: {
        Row: {
          id: string
          agent_name: string
          key: string
          value: Record<string, any>
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['agent_memory']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['agent_memory']['Insert']>
      }
    }
  }
}

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Public client (for client-side operations)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Service client (for server-side operations with full access)
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
})
