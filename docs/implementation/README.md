# RAG Implementation - Getting Started

## Overview
This guide helps you implement RAG (Retrieval-Augmented Generation) functionality for Engineer Cafe Navigator.

## Quick Start

### 1. Check Prerequisites
- Node.js 18+ installed
- PostgreSQL with pgvector extension running
- Environment variables configured in `.env`

### 2. Install Dependencies
```bash
# If not already installed
pnpm add cheerio googleapis
```

### 3. Create Implementation Files

Create these files based on the implementation guide:

1. **`src/mastra/tools/rag-search.ts`**
   - Main RAG search functionality
   - Vector similarity search
   - Integration with Supabase

2. **`src/mastra/tools/external-data-fetcher.ts`**
   - Connpass API integration
   - Google Calendar integration
   - Web scraping functionality

3. **`scripts/ingest-knowledge-base.ts`**
   - Initial data ingestion script
   - Embedding generation
   - Database population

### 4. Update Integration Points

Update `src/mastra/index.ts` to include the new tools:
```typescript
import { RAGSearchTool } from './tools/rag-search';
import { ExternalDataFetcherTool } from './tools/external-data-fetcher';

// Add in initializeTools()
const ragSearchTool = new RAGSearchTool();
const externalDataFetcherTool = new ExternalDataFetcherTool();

this.tools.set('ragSearch', ragSearchTool);
this.tools.set('externalDataFetcher', externalDataFetcherTool);
```

### 5. Ingest Initial Data
```bash
# Add script to package.json first
pnpm rag:ingest
```

### 6. Test the Implementation
```bash
# Create and run test script
pnpm rag:test
```

## File Structure
```
engineer-cafe-navigator/
├── src/mastra/tools/
│   ├── rag-search.ts              ← Create this
│   └── external-data-fetcher.ts   ← Create this
├── scripts/
│   ├── ingest-knowledge-base.ts   ← Create this
│   └── test-rag-search.ts         ← Create this
├── data/knowledge-base/
│   └── sample-knowledge-base.json ← Already created
└── docs/implementation/
    ├── RAG-IMPLEMENTATION-GUIDE.md
    ├── RAG-QUICK-REFERENCE.md
    └── README.md                  ← This file
```

## Key Implementation Details

### Vector Search
- Uses pgvector with cosine similarity
- Embeddings are 1536 dimensions (text-embedding-004)
- Relevance threshold: 0.7

### Knowledge Base Structure
- Categories: facilities, pricing, access, events, services, rules, technical
- Bilingual support (ja/en)
- Metadata for filtering and ranking

### External Data Sources
1. **Connpass API**
   - Event information
   - No authentication required
   - Rate limit: 10 requests/minute

2. **Google Calendar API**
   - Requires OAuth2 setup
   - Syncs Engineer Cafe events

3. **Web Scraping**
   - Engineer Cafe website
   - News and announcements

## Common Commands

```bash
# Development
pnpm dev                # Start dev server

# RAG Operations
pnpm rag:ingest        # Ingest initial knowledge base
pnpm rag:update        # Update from external sources
pnpm rag:test          # Test RAG functionality

# Database
psql $DATABASE_URL     # Connect to database
```

## Troubleshooting

### Issue: Vector dimension mismatch
```sql
-- Check current dimension
\d knowledge_base

-- If needed, recreate column
ALTER TABLE knowledge_base 
DROP COLUMN content_embedding;

ALTER TABLE knowledge_base 
ADD COLUMN content_embedding vector(1536);
```

### Issue: Slow search performance
```sql
-- Create IVFFlat index
CREATE INDEX ON knowledge_base 
USING ivfflat (content_embedding vector_cosine_ops);
```

### Issue: API rate limits
- Implement exponential backoff
- Add caching layer
- Use batch operations

## Next Steps

1. ✅ Review implementation guide
2. ⬜ Create RAG search tool
3. ⬜ Set up knowledge base ingestion
4. ⬜ Test with sample queries
5. ⬜ Integrate external data sources
6. ⬜ Deploy and monitor

## Support

- Check `docs/implementation/` for detailed guides
- Review existing code in `src/mastra/agents/qa-agent.ts`
- Test with sample data in `data/knowledge-base/`

---

**Last Updated**: 2025-06-01