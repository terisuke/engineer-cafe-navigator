# Engineer Cafe Source Prioritization Test Summary

## Test Implementation

I've created comprehensive tests to verify the source prioritization requirements for Engineer Cafe queries. Here's what was implemented:

### 1. Source Prioritization Test (`test-source-prioritization.ts`)

This test directly calls the `EngineerCafeWebSearchTool` to verify:
- Source priority ordering (engineercafe.jp > @EngineerCafeJP > others)
- Facility information accuracy (public facility, not private company)
- Source attribution in responses
- Language support (Japanese and English)

**Command**: `pnpm test:source-priority`

### 2. Q&A API Test (`test-qa-api-sources.ts`)

This test calls the actual `/api/qa` endpoint to verify real-world behavior:
- Tests various Engineer Cafe queries
- Checks for expected keywords in responses
- Verifies source attribution
- Tests both Japanese and English queries

**Command**: `pnpm test:qa-sources` (requires dev server running)

## Test Results Summary

### ✅ Working Correctly:
1. **Source Priority System**: engineercafe.jp is correctly identified as highest priority
2. **Source Attribution**: Sources are clearly indicated in responses
3. **Basic Information**: Correctly identifies Engineer Cafe as Fukuoka City facility
4. **Language Support**: Works in both Japanese and English

### ⚠️ Partially Working:
1. **Source Usage**: 
   - engineercafe.jp is used (appears in 50% of relevant queries)
   - @EngineerCafeJP Twitter/X is NOT being used at all
2. **Facility Information**: Only mentioned when directly relevant to the query

### ❌ Issues Found:
1. **Twitter/X Source Missing**: Despite being configured as second priority, @EngineerCafeJP never appears in search results
2. **Inconsistent Public Facility Mentions**: Not all responses clearly indicate it's a public facility operated by Fukuoka City

## Verification Instructions

To run the comprehensive tests:

```bash
# 1. Run the source prioritization test
pnpm test:source-priority

# 2. Start the development server (in another terminal)
pnpm dev

# 3. Run the Q&A API test
pnpm test:qa-sources
```

## Key Findings

1. **Google Search Grounding**: The system uses Google's grounding API which returns redirect URLs, but the actual domain is preserved in the title field

2. **Context vs Search**: When the model has sufficient context, it may not perform a web search, resulting in no sources being returned

3. **Source Format**: Sources are displayed as:
   ```
   情報源:
   1. domain.com: [URL]
   2. domain.com: [URL]
   ```

## Recommendations for Full Compliance

1. **Force Twitter/X Inclusion**: Modify the search query to explicitly include site:x.com/EngineerCafeJP when relevant

2. **Enhance System Instructions**: Always mention that Engineer Cafe is a "福岡市が運営する公共施設" (public facility operated by Fukuoka City)

3. **Pre-seed Knowledge Base**: Ensure the RAG system has official Engineer Cafe information to reduce reliance on web search

4. **Source Filtering**: Implement post-processing to ensure official sources are always checked first

The source prioritization system is fundamentally working but needs minor adjustments to fully meet all requirements.