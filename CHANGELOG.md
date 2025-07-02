# Changelog

## [2025-07-02] - RAG System Fix & Context Inheritance

### Fixed
- **Embedding Model Consistency**: Unified all knowledge base entries to use OpenAI text-embedding-3-small (1536 dimensions)
  - Previously mixed Google text-embedding-004 (content) and OpenAI (queries) causing search failures
  - Migrated all 93 entries to consistent embedding space
- **Saino Cafe Information**: Corrected closing day to "毎月最終月曜日" (last Monday of each month)
  - Removed incorrect pattern: "土曜日はエンジニアカフェが休館日の場合のみ営業"
- **Knowledge Base**: Added 8 entries for Aka-Renga Cultural Center
- **Context Inheritance**: Implemented generic requestType inheritance for all entities
  - Added filterContextByRequestType() to filter RAG results based on previous questions
  - Created universal prompt template that works for any entity (not just Saino Cafe)
  - Now correctly handles all clarification patterns:
    - "カフェの営業時間は？" → "エンジニアカフェの方"
    - "カフェの営業時間は？" → "才能cafeの方"
    - "会議室の料金は？" → "2階の方"
    - Any similar entity-requestType combination

### Added
- Database migration scripts for embedding consistency
- Comprehensive navigation test suite
- System architecture documentation
- Maintenance guide for operations

### Removed
- 30+ temporary test scripts used during debugging
- Experimental memory system files

## [2025-06-30] - Memory System Enhancement

### Added
- SimplifiedMemorySystem for unified conversation memory
- 3-minute short-term memory with TTL
- Memory-aware question handling ("さっき何を聞いた？")
- Emotion context tracking

### Improved
- STT correction system for Japanese terms
- Response precision for specific requests
- Context inheritance for single entity queries

## [2025-06-23] - Mobile Compatibility

### Added
- Web Audio API integration for iPad/iOS
- Autoplay policy compliance
- User interaction management
- Fallback mechanisms

### Fixed
- Audio playback errors on tablets
- Lip-sync performance on mobile devices