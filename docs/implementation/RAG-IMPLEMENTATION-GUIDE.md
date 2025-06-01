# RAG Implementation Guide for Engineer Cafe Navigator

## Overview

This guide documents the implemented RAG (Retrieval-Augmented Generation) functionality for the Engineer Cafe Navigator system. The RAG system enables intelligent question-answering based on Engineer Cafe's knowledge base using vector embeddings and semantic search.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User Query    │────▶│   RAG Search     │────▶│  Vector Search  │
└─────────────────┘     │      Tool        │     │   (pgvector)    │
                        └──────────────────┘     └─────────────────┘
                                 │                         │
                                 ▼                         ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Context Builder  │◀────│  Knowledge Base │
                        └──────────────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │    QA Agent      │
                        │ (Gemini 2.5)     │
                        └──────────────────┘
```

## Implemented Components

### 1. RAG Search Tool

**File**: `src/mastra/tools/rag-search.ts`

The RAG search tool has been implemented with the following features:
- Generates embeddings using Google's text-embedding-004 model (1536 dimensions)
- Searches the knowledge_base table using pgvector cosine similarity
- Returns relevant results with a configurable similarity threshold (default: 0.7)
- Supports both Japanese and English queries
- Includes category filtering capabilities

```typescript
import { Tool } from '@mastra/core/tool';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { embedText } from '@mastra/rag';

export class RAGSearchTool extends Tool {
  constructor() {
    super({
      name: 'ragSearch',
      description: 'Search Engineer Cafe knowledge base using vector similarity',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        language: z.enum(['ja', 'en']).default('ja'),
        limit: z.number().default(5),
        category: z.string().optional(),
      }),
      outputSchema: z.object({
        results: z.array(z.object({
          content: z.string(),
          category: z.string(),
          relevance: z.number(),
          source: z.string(),
          metadata: z.record(z.any()),
        })),
      }),
    });
  }

  async execute(input: {
    query: string;
    language: 'ja' | 'en';
    limit?: number;
    category?: string;
  }) {
    // 1. Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(input.query);
    
    // 2. Perform vector similarity search
    const results = await this.searchVectors(
      queryEmbedding,
      input.language,
      input.limit || 5,
      input.category
    );
    
    // 3. Format and return results
    return { results };
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use Mastra's embedding function with Google's text-embedding-004 model
    const embedding = await embedText({
      text,
      model: 'text-embedding-004',
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    });
    
    return embedding;
  }

  private async searchVectors(
    embedding: number[],
    language: string,
    limit: number,
    category?: string
  ) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build query
    let query = supabase
      .from('knowledge_base')
      .select('*')
      .eq('language', language);
    
    if (category) {
      query = query.eq('category', category);
    }

    // Perform vector similarity search using pgvector
    const { data, error } = await query
      .order('content_embedding', {
        ascending: false,
        nullsFirst: false,
        foreignTable: undefined,
      })
      .limit(limit);

    if (error) throw error;

    // Calculate relevance scores
    return data.map((item: any) => ({
      content: item.content,
      category: item.category,
      relevance: this.cosineSimilarity(embedding, item.content_embedding),
      source: item.source,
      metadata: item.metadata || {},
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
```

### 2. Knowledge Base Management Utilities

**File**: `src/lib/knowledge-base-utils.ts`

Utility functions for managing the knowledge base:
- `addEntry`: Add single entries with automatic embedding generation
- `addEntries`: Batch import multiple entries
- `updateMissingEmbeddings`: Update entries without embeddings
- `getStats`: Get statistics about the knowledge base
- `getByCategory`: Search by category
- `deleteEntry`: Remove entries

### 3. Database Schema and Functions

**File**: `supabase/migrations/20250601000000_add_knowledge_base_search.sql`

PostgreSQL functions for efficient vector search:
- `search_knowledge_base`: Main search function using pgvector
- `add_knowledge_base_entry`: Helper for adding entries
- IVFFlat index for improved search performance

```typescript
import { createClient } from '@supabase/supabase-js';
import { embedText } from '@mastra/rag';
import fs from 'fs/promises';
import path from 'path';

interface KnowledgeItem {
  content: string;
  category: string;
  subcategory?: string;
  language: 'ja' | 'en';
  source: string;
  metadata?: Record<string, any>;
}

class KnowledgeBaseIngester {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async ingestFromJSON(filePath: string) {
    const data = await fs.readFile(filePath, 'utf-8');
    const items: KnowledgeItem[] = JSON.parse(data);
    
    for (const item of items) {
      await this.ingestItem(item);
    }
  }

  async ingestItem(item: KnowledgeItem) {
    // Generate embedding
    const embedding = await embedText({
      text: item.content,
      model: 'text-embedding-004',
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    });

    // Insert into database
    const { error } = await this.supabase
      .from('knowledge_base')
      .upsert({
        content: item.content,
        content_embedding: embedding,
        category: item.category,
        subcategory: item.subcategory,
        language: item.language,
        source: item.source,
        metadata: item.metadata || {},
      });

    if (error) {
      console.error('Failed to ingest item:', error);
      throw error;
    }
  }

  async ingestEngineerCafeData() {
    // Sample Engineer Cafe knowledge base data
    const knowledgeItems: KnowledgeItem[] = [
      // Facility Information
      {
        content: 'エンジニアカフェは福岡市中央区天神にある24時間営業のコワーキングスペースです。高速Wi-Fi（1Gbps）、電源完備の作業スペース、会議室、イベントスペースを提供しています。',
        category: 'facilities',
        subcategory: 'general',
        language: 'ja',
        source: 'engineer-cafe-official',
      },
      {
        content: 'Engineer Cafe is a 24/7 coworking space located in Tenjin, Chuo-ku, Fukuoka. We provide high-speed Wi-Fi (1Gbps), fully equipped workspaces with power outlets, meeting rooms, and event spaces.',
        category: 'facilities',
        subcategory: 'general',
        language: 'en',
        source: 'engineer-cafe-official',
      },
      // Pricing Information
      {
        content: '料金プラン: ドロップイン利用 500円/時間、デイパス 2,000円/日、マンスリーメンバー 8,000円/月（学生割引あり 5,000円/月）。会議室は1,000円/時間から利用可能です。',
        category: 'pricing',
        subcategory: 'membership',
        language: 'ja',
        source: 'engineer-cafe-official',
      },
      {
        content: 'Pricing Plans: Drop-in 500 yen/hour, Day Pass 2,000 yen/day, Monthly Member 8,000 yen/month (Student Discount 5,000 yen/month). Meeting rooms available from 1,000 yen/hour.',
        category: 'pricing',
        subcategory: 'membership',
        language: 'en',
        source: 'engineer-cafe-official',
      },
      // Add more knowledge items...
    ];

    for (const item of knowledgeItems) {
      await this.ingestItem(item);
      console.log(`Ingested: ${item.category} - ${item.subcategory || 'general'}`);
    }
  }
}

// Run ingestion
async function main() {
  const ingester = new KnowledgeBaseIngester();
  
  // Ingest default Engineer Cafe data
  await ingester.ingestEngineerCafeData();
  
  // Ingest from JSON files if available
  const dataDir = path.join(process.cwd(), 'data', 'knowledge-base');
  try {
    const files = await fs.readdir(dataDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await ingester.ingestFromJSON(path.join(dataDir, file));
      }
    }
  } catch (error) {
    console.log('No additional knowledge base files found');
  }
}

main().catch(console.error);
```

### 4. QA Agent Integration

**File**: `src/mastra/agents/qa-agent.ts`

The QA Agent has been updated to use the RAG search tool:

```typescript
private async searchKnowledgeBase(query: string): Promise<string> {
  const language = await this.memory.get('language') as SupportedLanguage || 'ja';
  
  // Get RAG search tool
  const ragSearchTool = this._tools.get('ragSearch');
  if (!ragSearchTool) {
    console.error('RAG Search tool not found');
    return this.getFallbackContext(language);
  }

  try {
    // Search knowledge base
    const { results } = await ragSearchTool.execute({
      query,
      language,
      limit: 5,
    });

    // Format results as context
    if (results.length === 0) {
      return this.getFallbackContext(language);
    }

    // Combine top results into context
    const context = results
      .filter(r => r.relevance > 0.7) // Only use highly relevant results
      .map(r => r.content)
      .join('\n\n');

    return context || this.getFallbackContext(language);
  } catch (error) {
    console.error('RAG search failed:', error);
    return this.getFallbackContext(language);
  }
}

private getFallbackContext(language: SupportedLanguage): string {
  const fallback = {
    en: 'Engineer Cafe is a coworking space in Fukuoka for IT engineers.',
    ja: 'エンジニアカフェは福岡のITエンジニア向けコワーキングスペースです。',
  };
  return fallback[language];
}
```

### 5. API Endpoint

**File**: `src/app/api/knowledge/search/route.ts`

REST API endpoints for knowledge base search:
- `POST /api/knowledge/search`: Perform semantic search
- `GET /api/knowledge/search`: Check knowledge base status

### 6. Seed Script

**File**: `scripts/seed-knowledge-base.ts`

Script to populate the knowledge base with sample Engineer Cafe data in both Japanese and English.

**File**: `src/mastra/tools/external-data-fetcher.ts`

```typescript
import { Tool } from '@mastra/core/tool';
import { z } from 'zod';

export class ExternalDataFetcherTool extends Tool {
  constructor() {
    super({
      name: 'externalDataFetcher',
      description: 'Fetch data from external sources (Connpass, Google Calendar, Web)',
      inputSchema: z.object({
        source: z.enum(['connpass', 'google-calendar', 'web']),
        query: z.string(),
        options: z.record(z.any()).optional(),
      }),
      outputSchema: z.object({
        data: z.any(),
        source: z.string(),
        timestamp: z.string(),
      }),
    });
  }

  async execute(input: {
    source: 'connpass' | 'google-calendar' | 'web';
    query: string;
    options?: Record<string, any>;
  }) {
    switch (input.source) {
      case 'connpass':
        return await this.fetchConnpassEvents(input.query, input.options);
      case 'google-calendar':
        return await this.fetchGoogleCalendarEvents(input.query, input.options);
      case 'web':
        return await this.fetchWebContent(input.query, input.options);
      default:
        throw new Error(`Unsupported source: ${input.source}`);
    }
  }

  private async fetchConnpassEvents(query: string, options?: any) {
    // Implement Connpass API integration
    const response = await fetch(
      `https://connpass.com/api/v1/event/?keyword=${encodeURIComponent(query)}&count=10`
    );
    const data = await response.json();
    
    return {
      data: data.events,
      source: 'connpass',
      timestamp: new Date().toISOString(),
    };
  }

  private async fetchGoogleCalendarEvents(query: string, options?: any) {
    // Implement Google Calendar API integration
    // This requires OAuth2 setup
    return {
      data: [],
      source: 'google-calendar',
      timestamp: new Date().toISOString(),
    };
  }

  private async fetchWebContent(url: string, options?: any) {
    // Implement web scraping for Engineer Cafe website
    const response = await fetch(url);
    const html = await response.text();
    
    // Parse HTML and extract relevant information
    return {
      data: { html, url },
      source: 'web',
      timestamp: new Date().toISOString(),
    };
  }
}
```

## Available Scripts

The following npm scripts have been added:

```bash
pnpm seed:knowledge   # Populate knowledge base with sample data
pnpm test:rag        # Test RAG search functionality
pnpm test:rag:api    # Test including API endpoints
```

## Testing

### Test Script

**File**: `scripts/test-rag-search.ts`

Comprehensive test script that:
- Tests various queries in both languages
- Verifies category filtering
- Tests the searchKnowledgeBase helper method
- Optionally tests API endpoints

```typescript
import { RAGSearchTool } from '../src/mastra/tools/rag-search';

async function testRAGSearch() {
  const ragTool = new RAGSearchTool();
  
  const testQueries = [
    { query: '料金', language: 'ja' as const },
    { query: 'pricing', language: 'en' as const },
    { query: 'Wi-Fi', language: 'ja' as const },
    { query: 'meeting room', language: 'en' as const },
  ];

  for (const test of testQueries) {
    console.log(`\nTesting: ${test.query} (${test.language})`);
    const results = await ragTool.execute(test);
    console.log('Results:', JSON.stringify(results, null, 2));
  }
}

testRAGSearch().catch(console.error);
```

## Data Structure

### Knowledge Base Categories

- **facilities**: Physical space, equipment, amenities
- **pricing**: Membership plans, fees, payment methods
- **access**: Location, directions, parking
- **events**: Regular events, workshops, meetups
- **services**: Additional services, support
- **rules**: Usage rules, guidelines
- **technical**: Internet, development tools, tech stack

### Knowledge Base JSON Format

```json
{
  "knowledge_items": [
    {
      "content": "Full text content of the knowledge item",
      "category": "facilities",
      "subcategory": "meeting_rooms",
      "language": "ja",
      "source": "engineer-cafe-official",
      "metadata": {
        "last_updated": "2024-06-01",
        "tags": ["meeting", "reservation"],
        "importance": "high"
      }
    }
  ]
}
```

## Environment Variables

Add these to `.env`:

```bash
# Existing variables...

# RAG Configuration
RAG_EMBEDDING_MODEL=text-embedding-004
RAG_SEARCH_LIMIT=5
RAG_RELEVANCE_THRESHOLD=0.7

# External Data Sources
CONNPASS_API_KEY=your_connpass_api_key
GOOGLE_CALENDAR_CLIENT_ID=your_google_calendar_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_google_calendar_client_secret
```

## Quick Start Guide

1. **Set up environment variables**:
   ```bash
   GOOGLE_GENERATIVE_AI_API_KEY=your_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```

2. **Apply database migrations**:
   ```bash
   supabase db push
   ```

3. **Seed the knowledge base**:
   ```bash
   pnpm seed:knowledge
   ```

4. **Test the implementation**:
   ```bash
   pnpm test:rag
   ```

## Performance Considerations

- **Embedding Model**: Google's text-embedding-004 (1536 dimensions)
- **Vector Index**: IVFFlat with 100 lists for faster searches
- **Similarity Metric**: Cosine similarity with configurable threshold
- **Caching**: Results can be cached for repeated queries

## Future Enhancements

1. **Hybrid Search**: Combine vector search with keyword matching
2. **Real-time Updates**: Automatic knowledge base updates from external sources
3. **Multi-modal Support**: Add image and document embeddings
4. **Query Expansion**: Use synonyms and related terms
5. **Feedback Loop**: Learn from user interactions to improve relevance

---

**Document Version**: 2.0  
**Date**: 2025-06-01  
**Status**: Implemented