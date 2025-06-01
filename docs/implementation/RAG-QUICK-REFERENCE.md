# RAG Quick Reference

## API Usage

### Search Knowledge Base

```bash
# Search with default parameters
curl -X POST http://localhost:3000/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "料金プラン", "language": "ja"}'

# Search with filters
curl -X POST http://localhost:3000/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "meeting room",
    "language": "en",
    "category": "Facilities",
    "limit": 3,
    "threshold": 0.8
  }'
```

### Check Status

```bash
curl http://localhost:3000/api/knowledge/search
```

## Code Examples

### Using RAG Search Tool

```typescript
import { ragSearchTool } from '@/mastra/tools/rag-search';

// Basic search
const results = await ragSearchTool.execute({
  query: "Wi-Fi環境",
  language: "ja"
});

// Search with filters
const filteredResults = await ragSearchTool.execute({
  query: "pricing",
  language: "en",
  category: "Pricing",
  limit: 5,
  threshold: 0.7
});

// Get formatted context for agents
const context = await ragSearchTool.searchKnowledgeBase(
  "エンジニアカフェの設備",
  "ja"
);
```

### Managing Knowledge Base

```typescript
import { knowledgeBaseUtils } from '@/lib/knowledge-base-utils';

// Add a single entry
await knowledgeBaseUtils.addEntry({
  content: "New information about Engineer Cafe...",
  category: "News",
  language: "ja",
  metadata: { title: "Latest Update" }
});

// Add multiple entries
const entries = [
  { content: "...", category: "Events", language: "ja" },
  { content: "...", category: "Events", language: "en" }
];
await knowledgeBaseUtils.addEntries(entries);

// Get statistics
const stats = await knowledgeBaseUtils.getStats();
console.log(`Total entries: ${stats.total}`);
console.log(`With embeddings: ${stats.withEmbeddings}`);
```

## Common Queries

### Japanese
- 料金プラン / 料金体系
- 会議室の予約方法
- アクセス / 最寄り駅
- 営業時間
- Wi-Fi / インターネット環境
- イベント情報
- 設備 / 施設

### English
- pricing plans / membership fees
- meeting room reservation
- access / nearest station
- opening hours
- internet connection
- event information
- facilities / equipment

## Knowledge Base Categories

| Category | Description | Example Content |
|----------|-------------|-----------------|
| 基本情報 | General information | About, overview |
| 料金 | Pricing | Plans, fees |
| 設備 | Facilities | Rooms, equipment |
| イベント | Events | Workshops, meetups |
| アクセス | Access | Location, directions |

## Troubleshooting

### No results found
```typescript
// Check if knowledge base has data
const stats = await knowledgeBaseUtils.getStats();
if (stats.total === 0) {
  // Run: pnpm seed:knowledge
}
```

### Low similarity scores
```typescript
// Lower the threshold
const results = await ragSearchTool.execute({
  query: "your query",
  threshold: 0.5  // Default is 0.7
});
```

### Embedding generation fails
```bash
# Check environment variable
echo $GOOGLE_GENERATIVE_AI_API_KEY

# Test API key
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=$GOOGLE_GENERATIVE_AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": {"parts": [{"text": "test"}]}}'
```

## Performance Tips

1. **Use specific queries**: More specific queries yield better results
2. **Filter by category**: Reduces search space and improves relevance
3. **Adjust threshold**: Balance between precision and recall
4. **Limit results**: Fewer results = faster response
5. **Cache results**: Store frequently searched queries

## Scripts Reference

```bash
# Seed knowledge base with sample data
pnpm seed:knowledge

# Test RAG search functionality
pnpm test:rag

# Test including API endpoints (requires dev server)
pnpm test:rag:api

# Start development server
pnpm dev

# Build for production
pnpm build
```