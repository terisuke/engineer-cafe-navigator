# System Architecture

## Overview

Engineer Cafe Navigator is a multilingual AI navigation system for the Engineer Cafe facility in Fukuoka's Aka-Renga Cultural Center.

## 🏗️ Architecture Layers

### 1. Frontend Layer
- **Framework**: Next.js 15.3.2 with App Router
- **UI**: React 19.1.0 + TypeScript 5.8.3
- **3D Avatar**: Three.js with VRM support
- **Audio**: Web Audio API with mobile compatibility

### 2. AI Agent Layer (8-Agent Architecture)
- **Framework**: Mastra 0.10.5
- **Response Model**: Google Gemini 2.5 Flash Preview
- **Embedding Model**: OpenAI text-embedding-3-small (1536 dims)
- **Coordinator**: MainQAWorkflow
- **Specialized Agents**:
  - RouterAgent: Query classification and routing
  - BusinessInfoAgent: Hours, pricing, location
  - FacilityAgent: Equipment, facilities, basement spaces
  - MemoryAgent: Conversation history management
  - EventAgent: Calendar and events
  - GeneralKnowledgeAgent: General queries via web search
  - ClarificationAgent: Ambiguity resolution
  - RealtimeAgent: Voice interaction processing
- **Supporting Agents**: WelcomeAgent, SlideNarrator

### 3. Data Layer
- **Database**: PostgreSQL with pgvector
- **Backend**: Supabase 2.49.8
- **Vector Search**: 1536-dimensional embeddings
- **Memory**: 3-minute conversation context

### 4. Integration Layer
- **Calendar**: Google Calendar API (public iCal)
- **Web Search**: Gemini with grounding
- **Voice**: Google Cloud Speech-to-Text/Text-to-Speech

## 🔑 Key Components

### RAG System
- **Knowledge Base**: 93+ entries (JA/EN)
- **Embedding**: OpenAI text-embedding-3-small
- **Search**: Cosine similarity with threshold
- **Categories**: Facilities, Hours, Pricing, etc.

### Memory System
- **SimplifiedMemorySystem**: Unified memory management
- **Short-term**: 3-minute conversation window
- **Context**: Combines memory + knowledge base
- **Isolation**: Separate namespaces per agent

### Audio System
- **AudioPlaybackService**: Unified audio handling
- **MobileAudioService**: iOS/Android compatibility
- **LipSync**: Optimized with caching
- **Fallback**: Graceful degradation

## 📊 Data Flow

```
User Query → STT → RealtimeAgent → MainQAWorkflow → RouterAgent
                                            ↓
                        [Route to Appropriate Specialized Agent]
                                            ↓
                    Agent Processing (with Enhanced RAG if needed)
                                            ↓
                    Response Generation → TTS → Audio Playback → Avatar Animation
```

### Query Processing Pipeline
1. Speech recognition with STT corrections
2. Language detection (JA/EN)
3. RouterAgent classification:
   - Ambiguity detection (clarification needed?)
   - Request type extraction (hours, pricing, etc.)
   - Context-dependent routing
   - Memory-aware classification
4. Specialized agent processing:
   - Memory context retrieval (MemoryAgent)
   - Enhanced RAG search (BusinessInfo/FacilityAgent)
   - External data fetch (EventAgent)
   - Web search (GeneralKnowledgeAgent)
   - Clarification dialog (ClarificationAgent)
5. Response generation with Gemini
6. Audio synthesis with Google TTS
7. Character animation sync

## 🎯 Critical Features

### Multi-language Support
- Japanese and English UI
- Cross-language RAG search
- STT corrections for Japanese terms

### Contextual Understanding
- Single entity query inheritance
- Memory-aware responses
- Request type tracking
- Ambiguity resolution with clarification

### 8-Agent Architecture Details

#### MainQAWorkflow (Coordinator)
- Central orchestration of all specialized agents
- Session management and context propagation
- Unified error handling and fallback strategies

#### Specialized Agent Responsibilities
1. **RouterAgent**: First-line query analysis and routing decisions
2. **BusinessInfoAgent**: Engineer Cafe operational information with Enhanced RAG
3. **FacilityAgent**: Physical facilities and equipment queries with basement focus
4. **MemoryAgent**: Conversation history, "What did I ask?" queries
5. **EventAgent**: Real-time calendar integration and event listings
6. **GeneralKnowledgeAgent**: Fallback for out-of-scope queries using web search
7. **ClarificationAgent**: Disambiguates cafe/meeting room queries
8. **RealtimeAgent**: Voice interaction and emotion detection

### Integration Features
- Real-time calendar events
- Web search for general queries
- External system webhooks

## 🔧 Configuration

### Environment Variables
```env
# AI Services
OPENAI_API_KEY=              # Embeddings
GOOGLE_GENERATIVE_AI_API_KEY= # Gemini responses

# Database
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Integrations
GOOGLE_CALENDAR_ICAL_URL=    # Public calendar
GOOGLE_CLOUD_PROJECT_ID=     # Voice services
```

### Key Endpoints
- `/api/voice` - Voice processing
- `/api/qa` - Q&A interactions  
- `/api/calendar` - Calendar proxy
- `/admin/knowledge` - Knowledge management

## 📈 Performance

### Optimization Strategies
- Embedding caching
- Lip-sync pre-computation
- Memory indexing
- Query normalization

### Monitoring
- RAG search metrics
- Audio playback success rates
- Memory operation latency
- External API usage

## 🚀 Deployment

### Production Requirements
- Node.js 20+
- PostgreSQL with pgvector
- 2GB+ RAM recommended
- HTTPS for audio APIs

### Health Checks
- `/api/health` - System status
- `/api/health/knowledge` - RAG integrity
- `/api/monitoring/dashboard` - Metrics