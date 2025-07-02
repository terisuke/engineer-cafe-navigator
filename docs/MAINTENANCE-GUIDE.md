# Maintenance Guide

This guide provides instructions for maintaining the Engineer Cafe Navigator system.

## 🔧 Regular Maintenance Tasks

### 1. Knowledge Base Updates

When updating knowledge base content:

```bash
# Update content using Supabase admin interface
# Or use the script:
pnpm tsx scripts/apply-saino-aka-renga-fixes.ts
```

### 2. Embedding Regeneration

If you change the embedding model or need to regenerate embeddings:

```bash
# Migrate all embeddings to OpenAI text-embedding-3-small
pnpm tsx scripts/migrate-to-openai-embeddings.ts
```

**Important**: Always use the same embedding model for both content and queries!

### 3. System Verification

After any major changes:

```bash
# Quick verification of essential features
pnpm tsx scripts/final-verification-test.ts

# Comprehensive navigation test (Japanese and English)
pnpm tsx scripts/comprehensive-navigation-test.ts
```

### 4. Integration Testing

```bash
# Test Google Calendar integration
pnpm tsx scripts/test-calendar-integration.ts

# Test web search integration
pnpm tsx scripts/test-web-search-integration.ts
```

## 📊 Monitoring

### Performance Dashboard
- Endpoint: `/api/monitoring/dashboard`
- Check RAG search latency and success rates
- Monitor embedding generation times

### Health Checks
- `/api/health` - Basic system health
- `/api/health/knowledge` - Knowledge base integrity

## 🚨 Common Issues

### RAG Search Not Working
1. Check embedding consistency - all entries must use the same model
2. Run `fix-embedding-consistency.ts` to analyze the problem
3. Regenerate embeddings if needed

### Incorrect Information Returned
1. Check knowledge base content in Supabase
2. Verify embeddings are up to date
3. Test with `comprehensive-navigation-test.ts`

### Calendar/Web Search Issues
1. Verify API keys are configured
2. Check network connectivity
3. Run integration tests

## 🔑 Environment Variables

Essential variables for production:
- `OPENAI_API_KEY` - For embeddings (text-embedding-3-small)
- `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini responses
- `GOOGLE_CALENDAR_ICAL_URL` - For calendar events
- `SUPABASE_SERVICE_ROLE_KEY` - For database access

## 📝 Database Schema

Key tables:
- `knowledge_base` - RAG content with embeddings (1536 dimensions)
- `agent_memory` - Conversation context (3-minute TTL)
- `conversation_history` - Chat logs
- `rag_search_metrics` - Performance tracking

## 🎯 Critical Information

Always verify these key facts are correct:
- Engineer Cafe hours: 9:00-22:00
- Closed: Last Monday of month, Dec 29-Jan 3
- Saino cafe: 1st floor (NOT 2nd floor)
- Saino closed: Same as Engineer Cafe
- Basement meeting space: FREE
- 2F meeting rooms: PAID (¥990+)
- Aka-Renga: Closed Mondays