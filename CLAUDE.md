# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
pnpm dev                    # Start development server (http://localhost:3000)
pnpm dev:clean              # Clean cache and start dev server

# Build & Production
pnpm build                  # Create production build
pnpm start                  # Start production server

# Code Quality
pnpm lint                   # Run Next.js linting

# CSS Dependencies
pnpm install:css            # Install correct Tailwind CSS v3 dependencies

# Knowledge Base Management
pnpm seed:knowledge         # Seed knowledge base with initial data
pnpm migrate:embeddings     # Migrate existing knowledge to OpenAI embeddings
pnpm import:knowledge       # Import knowledge from markdown files
pnpm import:narrations      # Import slide narrations

# Database Management
pnpm db:migrate             # Run database migrations
pnpm db:setup-admin         # Setup admin knowledge interface

# CRON Jobs (Production)
pnpm cron:update-knowledge  # Manually trigger knowledge base update
pnpm cron:update-slides     # Manually trigger slide update
```

## ⚠️ CRITICAL: Tailwind CSS Version

**This project uses Tailwind CSS v3.4.17. DO NOT upgrade to v4.**
- Tailwind CSS v4 has breaking changes and is incompatible
- Always use: `tailwindcss@3.4.17`, `postcss@8.4.47`, `autoprefixer@10.4.20`
- PostCSS config must use `tailwindcss: {}`, NOT `@tailwindcss/postcss: {}`

## High-Level Architecture

### Technology Stack
- **Frontend**: Next.js 15.3.2 (App Router) + React 19.1.0 + TypeScript 5.8.3
- **AI Framework**: Mastra 0.10.5 for agent orchestration
- **AI Models**: 
  - Google Gemini 2.5 Flash Preview (for responses)
  - Google text-embedding-004 (768 dimensions, padded to 1536 for compatibility)
  - OpenAI text-embedding-3-small (1536 dimensions as fallback)
- **Voice**: Google Cloud Speech-to-Text/Text-to-Speech
- **3D Graphics**: Three.js 0.176.0 with @pixiv/three-vrm 3.4.1
- **Database**: PostgreSQL with pgvector extension
- **Backend Services**: Supabase 2.49.8
- **External Integrations**: Connpass API, Google Calendar API

### Architecture Overview

The application follows a multi-layered architecture:

1. **Frontend Layer** (`/src/app/`): React components and API routes
   - VoiceInterface: Audio recording and playback
   - MarpViewer: Presentation slides display
   - CharacterAvatar: 3D VRM character rendering
   - API routes handle voice, slides, character control, and Q&A

2. **AI Agent Layer** (`/src/mastra/`): Mastra-based agent system
   - Agents: WelcomeAgent, QAAgent, RealtimeAgent, SlideNarrator
   - Tools: SlideControl, MarpRenderer, CharacterControl, etc.
   - Voice service integration with Google Cloud

3. **Data Layer**: Supabase/PostgreSQL with pgvector
   - Conversation sessions, history, and analytics
   - Knowledge base with vector embeddings (1536 dimensions)
   - Multi-language support (Japanese/English content)
   - Intelligent agent memory with 3-minute TTL for conversational continuity
   - Production monitoring metrics and system health tracking
   - Automated knowledge base synchronization

### Key API Endpoints

#### Core Functionality
- **POST /api/voice**: Voice processing (speech recognition, AI response, TTS)
- **GET /api/backgrounds**: Get available background images
- **POST /api/marp**: Marp markdown slide rendering
- **POST /api/slides**: Slide navigation with narration
- **POST /api/character**: VRM character control
- **POST /api/qa**: Q&A interactions
- **POST /api/external**: External system integration

#### Admin & Management
- **GET/POST /admin/knowledge**: Knowledge base management interface
- **/api/admin/knowledge/categories**: Category management
- **/api/admin/knowledge/metadata-templates**: Metadata template management
- **/api/admin/knowledge/import**: Batch import with duplicate detection

#### Monitoring & Health
- **/api/monitoring/dashboard**: Real-time performance metrics
- **/api/health/knowledge**: Knowledge base health check
- **/api/alerts/webhook**: Alert webhook system

#### Automated Updates (CRON)
- **/api/cron/update-knowledge-base**: Auto-sync external data (6-hour intervals)
- **/api/cron/update-slides**: Auto-update slide content

### Environment Configuration

Required environment variables:
- `GOOGLE_CLOUD_PROJECT_ID`: GCP project for speech services
- `GOOGLE_GENERATIVE_AI_API_KEY`: Gemini API key for AI responses
- `OPENAI_API_KEY`: OpenAI API key for embeddings (1536 dimensions)
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Supabase access
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side Supabase access
- `CRON_SECRET`: Authentication for CRON job endpoints
- `GOOGLE_CALENDAR_CLIENT_ID` & `GOOGLE_CALENDAR_CLIENT_SECRET`: Calendar OAuth2 (optional)
- Service account key at `config/service-account-key.json`

### Database Schema

The application uses Supabase with the following main tables:

#### Core Tables
- `conversation_sessions`: Visitor sessions with language and mode
- `conversation_history`: Chat messages with audio URLs
- `knowledge_base`: RAG knowledge with vector embeddings (1536 dimensions)
- `agent_memory`: Key-value storage for agent state and short-term memory (with TTL)
- `conversation_analytics`: Usage metrics and analytics

#### Monitoring & Metrics Tables
- `rag_search_metrics`: Search performance tracking
- `external_api_metrics`: External API usage and performance
- `knowledge_base_metrics`: Knowledge base health metrics
- `system_metrics`: Overall system performance baselines

#### Features
- All tables have Row Level Security (RLS) enabled with service role access
- Automatic TTL-based cleanup for agent_memory
- Optimistic concurrency control for memory operations
- Comprehensive indexing for performance optimization

### Memory Architecture

The application features a unified memory system that provides contextual conversation experiences through intelligent memory management:

#### **SimplifiedMemorySystem** (`/src/lib/simplified-memory.ts`)
A streamlined memory implementation that replaces the previous complex multi-layer architecture with a single, cohesive system.

**Core Components:**
- **Short-term Memory**: 3-minute conversation context using `agent_memory` table with TTL
- **Knowledge Base Integration**: Seamless integration with existing RAG system (1536-dimension OpenAI embeddings)
- **Agent Isolation**: Separate memory namespaces for RealtimeAgent and EnhancedQAAgent
- **Automatic Cleanup**: TTL-based expiration handling via Supabase
- **Multi-language Support**: Japanese/English context and knowledge retrieval

**Memory Features:**
- **Conversational Continuity**: Agents remember recent conversation context and can reference previous questions/answers
- **Intelligent Context Building**: Combines short-term conversation history with relevant knowledge base information
- **Emotion Tracking**: Stores and retrieves emotional context from conversations for personalized responses
- **Memory-aware Question Handling**: Special processing for memory-related questions ("さっき何を聞いた？", "Do you remember...?")
- **Performance Optimized**: Message indexing and hash-based cache keys for efficient retrieval
- **Atomic Operations**: Thread-safe memory operations with optimistic concurrency control
- **Batch Processing**: Efficient batch operations for memory cleanup and updates

**Agent Integration:**
- **RealtimeAgent**: Uses SimplifiedMemorySystem for context-aware voice interactions with 3-minute conversation window
- **EnhancedQAAgent**: Leverages memory for follow-up questions and maintains conversation continuity across Q&A sessions

**Usage Example:**
```typescript
import { SimplifiedMemorySystem } from '@/lib/simplified-memory';

const memory = new SimplifiedMemorySystem('RealtimeAgent');

// Store conversation with metadata
await memory.addMessage('user', 'エンジニアカフェの営業時間は？', {
  emotion: 'curious',
  sessionId: 'session_123'
});

await memory.addMessage('assistant', 'エンジニアカフェの営業時間は9:00〜22:00です。', {
  emotion: 'helpful',
  sessionId: 'session_123'
});

// Get comprehensive context for follow-up questions
const context = await memory.getContext('さっき僕が何を聞いたか覚えてる？', {
  includeKnowledgeBase: true,
  language: 'ja'
});

// context.contextString includes:
// "最近の会話履歴（直近3分）:
//  ユーザー: エンジニアカフェの営業時間は？
//  アシスタント: エンジニアカフェの営業時間は9:00〜22:00です。 [helpful]"
```

**Memory Layers:**
1. **Short-term (3 minutes)**: Recent conversation turns with emotion data and session metadata
2. **Knowledge Base**: Engineer Cafe information via OpenAI embeddings for contextual responses
3. **Session Continuity**: Maintains conversation flow across multiple interactions
4. **Memory-aware Processing**: Intelligent handling of memory-related queries with conversation history reference

**Memory-Related Question Processing:**
The system automatically detects and handles memory-related questions using keyword analysis:
- **Japanese**: さっき, 前に, 覚えて, 記憶, 質問, 聞いた, 話した, etc.
- **English**: remember, recall, earlier, before, previous, asked, said, etc.

When detected, the agent uses conversation history instead of knowledge base search to provide contextual responses about previous interactions.

### Development Workflow

1. Start the development server with `pnpm dev`
2. Access admin interface at `/admin/knowledge` for content management
3. VRM character models should be placed in `public/characters/models/`
4. Slide content in Marp format goes in `src/slides/`
5. Narration JSON files in `src/slides/narration/`
6. Use Mastra agents for AI interactions
7. Voice processing uses Google Cloud services with base64 audio encoding
8. Knowledge base entries support rich metadata with importance levels and tags

### RAG Search System

The application uses a sophisticated multi-language RAG (Retrieval-Augmented Generation) system:

- **Multi-language Knowledge Base**: Supports both Japanese and English content
- **Cross-language Search**: English questions can retrieve Japanese content and vice versa
- **Hybrid Embeddings**: 
  - Primary: Google text-embedding-004 (768 dimensions, padded to 1536)
  - Fallback: OpenAI text-embedding-3-small (1536 dimensions)
- **Duplicate Detection**: Automatic duplicate checking on knowledge base insert
- **Batch Import**: Efficient batch processing with duplicate tracking
- **Vector Database**: PostgreSQL with pgvector for similarity search
- **Admin Interface**: Web-based knowledge management at `/admin/knowledge`
- **Smart Query Enhancement**: Automatically enhances queries for better basement space detection
- **Duplicate Removal**: Intelligent deduplication of cross-language results

### Knowledge Base Structure

The knowledge base contains 84+ entries organized by:
- **Categories**: 設備/Facilities, 基本情報/General, 料金/Pricing, etc.
- **Subcategories**: Specific facility types (地下MTGスペース, Basement Focus Space, etc.)
- **Languages**: Japanese (ja) and English (en) versions
- **Metadata**: Importance levels, tags, last updated timestamps

### Key Considerations

- **Multi-language Support**: Japanese/English UI and content with automatic language detection
- **Real-time Voice Interactions**: Speech-to-text with interruption handling
- **3D Character Animations**: Synchronized with voice output and emotion detection with intelligent lip-sync caching
- **Intelligent Memory System**: Contextual 3-minute conversation memory with automatic memory-related question detection and RAG integration
- **Slide Presentations**: Marp-based slides with voice narration
- **Admin Knowledge Management**: Structured metadata editing with dropdowns and templates
- **Hybrid AI Architecture**: Gemini for responses, OpenAI for embeddings (1536 dimensions)
- **Cross-language RAG**: Questions in one language can retrieve answers from content in either language
- **Voice Recognition**: Google Cloud STT with Service Account authentication
- **WebSocket Support**: For external system integration
- **Streamlined UI**: Fullscreen controls removed from character display for cleaner interface
- **No Test Framework**: Currently configured for production deployment

### Lip-sync System

The application features an optimized lip-sync system for VRM character animations with intelligent caching and mobile-friendly performance optimizations:

#### **Core Components**
- **LipSyncAnalyzer** (`/src/lib/lip-sync-analyzer.ts`): Optimized audio analysis for mouth shape generation
- **LipSyncCache** (`/src/lib/lip-sync-cache.ts`): Intelligent caching system for performance optimization
- **5 Viseme Types**: A, I, U, E, O mouth shapes plus Closed state

#### **Performance Optimizations (2024)**
- **Efficient FFT Processing**: Replaced O(n²) DFT with O(n) frequency band analysis
- **Timeout Protection**: 10-second timeout prevents UI freezing
- **Batch Processing**: Non-blocking frame processing with yielding control
- **Adaptive Frame Rates**: Dynamic interval adjustment based on audio duration
- **Simplified Algorithms**: Fast mouth shape determination using volume and variance
- **Mobile-Optimized**: Special handling for iOS/iPad audio permission issues

#### **Caching System Features**
- **Audio Fingerprinting**: Generates unique hashes from audio data for cache keys
- **Hybrid Storage**: Memory cache for speed + localStorage for persistence
- **Auto-cleanup**: 7-day expiration with automatic old entry removal
- **Size Management**: 10MB max cache size, 100 entry limit
- **Performance Monitoring**: Hit rate tracking and detailed statistics

#### **Performance Benefits**
- **First Analysis**: 1-3 seconds for new audio processing (optimized from 4-8s)
- **Cached Results**: 10-50ms retrieval time for repeated audio
- **Efficient Storage**: Compressed frame data with intelligent deduplication
- **Memory Management**: Automatic cleanup prevents storage bloat
- **Mobile Performance**: Optimized algorithms for tablet/mobile devices

#### **User Interface**
- **Settings Panel**: Real-time cache statistics display
- **Cache Management**: One-click cache clearing functionality
- **Performance Metrics**: Hit rate, entry counts, and usage statistics
- **Error Handling**: Graceful fallback to audio-only mode on permission issues

#### **Technical Details**
- **Frame Rate**: 20fps mouth shape updates (50ms intervals for short audio, 100ms for long)
- **Audio Analysis**: Optimized frequency band analysis (no longer uses heavy FFT)
- **Storage Format**: JSON serialization with timestamp metadata
- **Error Handling**: Graceful fallbacks when cache fails or permissions denied
- **Cross-session**: Persistent cache across browser restarts
- **AudioContext Management**: Lazy initialization to prevent permission issues

#### **Mobile/Tablet Compatibility & Known Limitations**

**Current Status:**
- **Desktop/PC Browsers**: Full functionality including lip-sync and audio playback
- **iPad/iOS Safari**: Limited audio functionality due to browser restrictions
- **Android Tablets**: Generally functional with occasional permission prompts

**Known iPad/iOS Issues:**
- **AudioContext Restrictions**: Safari blocks AudioContext creation until explicit user interaction
- **Lip-sync Limitations**: May fail with "request not allowed" errors on iPads
- **Autoplay Policy**: Strict autoplay restrictions prevent background audio processing
- **WebKit Permissions**: Audio permission requirements vary between iOS versions

**Recommended User Experience:**
1. **Desktop/PC**: Use for full feature experience including real-time lip-sync
2. **iPad/iOS**: Audio-only mode recommended (lip-sync may be disabled automatically)
3. **Android**: Generally functional with manual permission grants

**Technical Workarounds Implemented:**
- **Graceful Degradation**: Automatic fallback to audio-only when lip-sync fails
- **Permission Detection**: User-friendly error messages for permission issues
- **Simplified Processing**: Reduced computational load for mobile devices
- **Lazy Initialization**: AudioContext only created after user interaction

**For Optimal iPad/iOS Experience:**
- Tap the screen before using voice features
- Grant microphone permissions when prompted
- Use in landscape orientation for better UI
- Consider using Chrome for iOS as an alternative to Safari

#### **Cache Key Generation**
```typescript
// Audio fingerprinting process:
1. File size hash
2. Sample data points throughout audio
3. Checksum calculation
4. Collision-resistant final hash
```

This system provides fast, reliable lip-sync with mobile-first performance optimizations while maintaining high-quality mouth animations.

### Conversation Memory System

The application features an advanced conversation memory system that enables natural, contextual interactions:

#### **Memory-Aware Conversations**
- **Contextual Follow-ups**: Users can ask "さっき僕が何を聞いた？" (What did I ask earlier?) and receive accurate responses
- **Question History**: Agents remember previous questions and can reference them in responses
- **Conversation Continuity**: 3-minute conversation windows maintain context across multiple interactions
- **Intelligent Routing**: Memory-related questions automatically use conversation history instead of knowledge base search

#### **Natural Language Memory Queries**
The system recognizes memory-related questions in both languages:
- **Japanese**: "さっき", "前に", "覚えてる", "何を聞いた", "どんな質問"
- **English**: "remember", "earlier", "before", "what did I ask", "previous question"

#### **Technical Implementation**
- **Agent Isolation**: Separate memory namespaces prevent cross-contamination between RealtimeAgent and EnhancedQAAgent
- **TTL Management**: Automatic 3-minute expiration with Supabase-based cleanup
- **Emotion Context**: Emotional state is preserved and referenced in memory retrieval
- **Performance Optimization**: Hash-based message indexing for efficient memory access

#### **User Experience Benefits**
- **Natural Interactions**: Users can reference previous conversations naturally
- **Reduced Repetition**: No need to repeat context in follow-up questions
- **Personalized Responses**: Agents can acknowledge and build upon previous interactions
- **Seamless Transitions**: Smooth conversation flow between different types of questions

## Production Features

### Monitoring System

The application includes a comprehensive production monitoring system:

#### **Real-time Performance Dashboard**
- **Endpoint**: `/api/monitoring/dashboard`
- **Metrics Tracked**:
  - RAG search performance (latency, success rates)
  - Cache hit rates and efficiency
  - External API usage and costs
  - Error rates and types
  - Percentile latencies (p50, p95, p99)
  - System health indicators

#### **Alert System**
- **Webhook Integration**: `/api/alerts/webhook`
- **Alert Types**:
  - Performance degradation
  - Error rate spikes
  - Knowledge base health issues
  - External API failures

#### **Metrics Storage**
- Automatic aggregation of performance data
- Historical trending and analysis
- Baseline tracking for anomaly detection

### Automated Knowledge Base Updates

#### **CRON Job System**
- **Update Frequency**: Every 6 hours
- **Authentication**: Secured with CRON_SECRET
- **Endpoints**:
  - `/api/cron/update-knowledge-base`: Syncs external data sources
  - `/api/cron/update-slides`: Updates presentation content

#### **External Data Sources**
- **Connpass Events**: Automatic import of Engineer Cafe events
- **Google Calendar**: OAuth2 integration for schedule sync
- **Website Scraping**: Placeholder for future content updates

#### **Update Features**
- Automatic cleanup of expired events
- Duplicate detection and merging
- Multi-language content generation
- Error recovery and retry logic

### Enhanced Memory System Features

#### **Atomic Operations**
- Thread-safe memory updates
- Optimistic concurrency control
- Batch processing capabilities
- Automatic conflict resolution

#### **Performance Optimizations**
- Hash-based message indexing
- Efficient TTL cleanup via Supabase
- Memory-aware query routing
- Cached context building

### Knowledge Base Enhancements

#### **Google Embeddings Integration**
- Uses text-embedding-004 (768 dimensions)
- Automatic padding to 1536 dimensions for compatibility
- Faster embedding generation
- Lower API costs

#### **Admin Features**
- Metadata template management
- Category hierarchy management
- Batch import with progress tracking
- Duplicate detection and resolution

### Script Tools

Utility scripts for maintenance and migration:
- `scripts/import-markdown-knowledge.ts`: Import knowledge from markdown
- `scripts/import-slide-narrations.ts`: Import slide narrations
- `scripts/setup-admin-knowledge.ts`: Initialize admin interface
- `scripts/update-database-schema.ts`: Schema migrations
- `scripts/migrate-all-knowledge.ts`: Comprehensive migration tool