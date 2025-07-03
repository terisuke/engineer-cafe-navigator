# Engineer Cafe Navigator

> AI Voice Agent System for Fukuoka City Engineer Cafe

**🇺🇸 English** | **[🇯🇵 日本語](README.md)**

[![Next.js](https://img.shields.io/badge/Next.js-15.3.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)](https://www.typescriptlang.org/)
[![Mastra](https://img.shields.io/badge/Mastra-0.10.5-green)](https://mastra.ai/)
[![React](https://img.shields.io/badge/React-19.1.0-61dafb)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-VRM-orange)](https://threejs.org/)

## 📖 Project Overview

Engineer Cafe Navigator is a **multilingual voice AI agent system** that automates customer service for Fukuoka City Engineer Cafe. Built with the Mastra framework, it aims to reduce staff workload and improve customer satisfaction.

### 🆕 Latest Updates (2025/07/03)

#### ✅ Complete Migration to 8-Agent Architecture
- **🤖 New Multi-Agent Architecture** - MainQAWorkflow integrates 8 specialized agents
  - **RouterAgent**: Context-dependent query routing with memory integration
  - **BusinessInfoAgent**: Hours, pricing, location information (with Enhanced RAG)
  - **FacilityAgent**: Equipment, basement facilities, Wi-Fi info (with Enhanced RAG)
  - **MemoryAgent**: Conversation history and context retrieval
  - **EventAgent**: Calendar and event information
  - **GeneralKnowledgeAgent**: Out-of-scope queries with web search
  - **ClarificationAgent**: Ambiguous query clarification (cafe/meeting room distinction)
  - **MainQAWorkflow**: Integration and coordination of all agents
- **🎯 Ambiguity Resolution Feature** - "Cafe hours?" → "Engineer Cafe or Saino Cafe?"
- **💬 Memory-based Follow-ups** - Supports "What about the other one?" queries
- **🧹 Legacy Code Removal** - Completely removed old EnhancedQAAgent (2,342 lines)

### 📚 Previous Updates

#### ✅ RAG System Complete Modernization & Test Evaluation Reform (2025/07/02)
- **🧠 Enhanced RAG Full Deployment** - Entity recognition & priority scoring in BusinessInfoAgent, FacilityAgent, RealtimeAgent
- **🎯 Context-Dependent Routing** - Accurate routing for context-dependent queries like "Is it the same hours on Saturday?"
- **🏢 Basement Facility Search Accuracy** - Full support for MTG/Focus/Under/Makers spaces, fixed Memory Agent false detection
- **📊 Test Evaluation System Overhaul** - Rigid keyword matching → Semantic evaluation, success rate improved from 28.6% → 100%
- **🔄 Memory System Integration** - SimplifiedMemorySystem with 3-minute conversation continuity, proper sessionId inheritance
- **⚡ Performance Improvements** - RouterAgent 94.1% accuracy, average response time 2.9s, Enhanced RAG entity recognition

#### ✅ Previous Improvements - RAG System Fixes Completed
- **🔧 Embedding Model Unification** - All entries unified to OpenAI text-embedding-3-small (1536 dimensions)
- **📝 Saino Cafe Information Fix** - Updated closed days to accurate "Last Monday of each month"
- **🏛️ Akarenga Cultural Center Added** - Added operating hours, closed days, admission fees
- **✨ Search Accuracy Improved** - Consistent embedding space for accurate search results

### 📚 Previous Updates

#### ✅ Speech Recognition Accuracy Improvements (STT Misrecognition Measures)
- **🎯 Voice Correction System** - Auto-correction of common misrecognition patterns ("jikatsukishuu space" → "concentration space")
- **📝 Custom Correction Dictionary** - Accurate recognition of Engineer Cafe-specific terms and facility names
- **🔄 Context-aware Correction** - Misrecognition correction based on context
- **📊 Correction Statistics Tracking** - Accumulation and analysis of misrecognition patterns

#### ✅ Conversation Memory System Enhancement
- **🧠 SimplifiedMemorySystem** - Unified memory architecture for conversation continuity
- **💬 Natural Memory Dialogue** - Accurate responses to questions like "What did I ask earlier?"
- **⏱️ 3-Minute Short-term Memory** - Maintains recent conversation history for context
- **🎭 Emotion Context Retention** - Natural responses by remembering emotional context

#### ✅ Production Monitoring System Implementation
- **📊 Real-time Dashboard** - Performance monitoring at `/api/monitoring/dashboard`
- **🚨 Alert System** - Automatic detection of performance degradation and error rate spikes
- **📈 Metrics Accumulation** - Detailed tracking of RAG search, external APIs, cache efficiency
- **🔍 Knowledge Base Health Check** - Health verification at `/api/health/knowledge`

#### ✅ Automated Knowledge Base Update System
- **🔄 CRON Auto-update** - Sync with external data sources every 6 hours
- **📅 Connpass Event Integration** - Automatic import of Engineer Cafe events
- **🗓️ Google Calendar Integration** - Schedule sync via OAuth2
- **🧹 Expired Data Cleanup** - Automatic cleanup of old event information

#### ✅ Response Precision System Improvements
- **🎯 Specific Request Detection** - Auto-identification of specific questions about hours, pricing, location
- **📏 Response Length Limiting** - 1-sentence answers for specific questions to eliminate verbosity
- **🔍 Information Filtering** - Exclude unrelated information, provide only necessary data
- **🌐 Multi-language Pattern Support** - Support for specific request patterns in both Japanese and English

#### ✅ Complete Audio System Refactoring (HTML Audio → Web Audio API Migration Completed)
- **🔧 Complete Audio System Refactoring** - Fully migrated from HTML Audio Element to Web Audio API (2024)
- **📱 Autoplay Policy Compliance** - Audio system that bypasses browser restrictions
- **🔄 Unified Audio Service** - AudioPlaybackService standardizes all audio operations
- **👆 User Interaction Management** - Full audio functionality activation with first screen tap
- **🎵 Mobile-First Design** - Optimized for tablets with intelligent fallback mechanisms

#### 📱 Device Compatibility Status
| Device | Audio Playback | Lip-sync | Recommendation |
|--------|----------------|----------|----------------|
| **PC/Mac Browsers** | ✅ Full Support | ✅ Full Support | 🟢 Recommended |
| **iPad/iOS Safari** | ✅ **Fixed** | ⚠️ Limited | 🟢 **Now Recommended** |
| **Android Tablets** | ✅ Full Support | ⚠️ Limited | 🟢 Recommended |

**iPad/iOS Improvements:**
- ✅ Audio playback errors completely resolved (Web Audio API implementation)
- ✅ Audio functionality automatically enabled with first screen tap
- ✅ Proper error handling compliant with autoplay policies
- ⚠️ Lip-sync functionality still limited due to browser restrictions

### 🎯 Main Objectives

- **Automated Customer Service**: Voice-guided assistance and Q&A support
- **Multilingual Support**: Japanese and English language support
- **Interactive Presentations**: Voice-controlled slide system
- **3D Character Guide**: Friendly customer service with VRM avatars
- **Background Customization**: Dynamic background changing and customization

### ✨ Key Features

| Feature Category | Feature Details |
|------------------|-----------------|
| 🎤 **Voice Interaction** | Google Cloud STT/TTS, real-time processing, interruption support |
| 🔍 **Multilingual RAG Search** | OpenAI embeddings, Japanese-English cross-language search, basement facility support |
| 🎭 **Emotion Recognition** | Text-based emotion detection, VRM expression control |
| 📊 **Dynamic Slides** | Marp Markdown, voice narration synchronization |
| 🤖 **3D Character** | VRM avatar, emotion-linked expressions & actions, high-speed lip-sync |
| 🌐 **Multilingual Support** | Japanese/English UI switching, multilingual content management |
| 🔧 **Admin Panel** | Knowledge base management, metadata templates, category management |
| 💾 **Conversation Memory** | Supabase persistence, session management, history retention |
| 🔗 **External Integration** | WebSocket reception system integration |
| 🎨 **Background Control** | Dynamic background image changes, gradient support |
| 🔒 **Security** | Service Account authentication, RLS, XSS protection |

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Frontend (Next.js 15)"
        UI[UI Components]
        Voice[Audio Interface]
        Slide[Marp Viewer]
        Char[3D Character]
    end
    
    subgraph "8-Agent Architecture (Mastra Framework)"
        MainQA[MainQAWorkflow<br/>Coordinator]
        Router[RouterAgent<br/>Query Routing]
        Business[BusinessInfoAgent<br/>Hours/Pricing]
        Facility[FacilityAgent<br/>Equipment/Facilities]
        Memory[MemoryAgent<br/>Context Management]
        Event[EventAgent<br/>Calendar/Events]
        General[GeneralKnowledgeAgent<br/>Web Search]
        Clarify[ClarificationAgent<br/>Ambiguity Resolution]
        
        MainQA --> Router
        Router --> Business
        Router --> Facility
        Router --> Memory
        Router --> Event
        Router --> General
        Router --> Clarify
    end
    
    subgraph "External Services"
        GCP[Google Cloud<br/>Speech/TTS]
        Gemini[Gemini 2.5<br/>Flash Preview]
        OpenAI[OpenAI<br/>Embeddings]
        DB[(PostgreSQL<br/>+ pgvector)]
    end
    
    UI --> Voice
    Voice --> MainQA
    Slide --> MainQA
    Char --> MainQA
    MainQA --> GCP
    Business --> Gemini
    Facility --> Gemini
    Memory --> Gemini
    Event --> Gemini
    General --> Gemini
    Clarify --> Gemini
    Business --> DB
    Facility --> DB
    Memory --> DB
    Business --> OpenAI
    Facility --> OpenAI
```

### 🛠️ Technology Stack

#### Core Technologies
- **Framework**: [Mastra 0.10.5](https://mastra.ai/) - AI Agent Development Framework
- **Frontend**: [Next.js 15.3.2](https://nextjs.org/) + [TypeScript 5.8.3](https://www.typescriptlang.org/)
- **AI/ML**: [Google Gemini 2.5 Flash Preview](https://ai.google.dev/)
- **Voice Processing**: [Google Cloud Speech-to-Text/Text-to-Speech](https://cloud.google.com/speech-to-text) + Web Audio API

#### Specialized Technologies
- **3D Character**: [Three.js 0.176.0](https://threejs.org/) + [@pixiv/three-vrm 3.4.0](https://github.com/pixiv/three-vrm)
- **Slide System**: [Marp Core 4.1.0](https://marp.app/) (Markdown Presentation Ecosystem)
- **Database**: [PostgreSQL](https://www.postgresql.org/) + [Supabase 2.49.8](https://supabase.com/)
- **Embeddings**: [Google text-embedding-004](https://cloud.google.com/vertex-ai/docs/generative-ai/embeddings/get-text-embeddings) + [OpenAI text-embedding-3-small](https://platform.openai.com/docs/guides/embeddings)
- **Styling**: [Tailwind CSS v3.4.17](https://tailwindcss.com/) ⚠️ **Important: Using v3**

#### Security & Quality
- **HTML Sanitization**: Custom XSS protection implementation
- **iframe Sandbox**: `allow-scripts allow-same-origin allow-popups allow-forms`
- **Origin Verification**: Trusted origin checking for postMessage communication
- **State Management**: Leveraging React 19.1.0 new features

## ⚠️ Important: Tailwind CSS Version

This project uses **Tailwind CSS v3.4.17**. Do not upgrade to Tailwind CSS v4. Version 4 has breaking changes and different configuration requirements.

### CSS Framework Dependencies
- `tailwindcss@3.4.17` - CSS framework (v3, not v4)
- `postcss@8.4.47` - CSS processor
- `autoprefixer@10.4.20` - Vendor prefix addition

### Installation
```bash
pnpm add -D tailwindcss@3.4.17 postcss@8.4.47 autoprefixer@10.4.20
```

### Required Configuration Files
- `tailwind.config.js` - Tailwind v3 configuration
- `postcss.config.js` - PostCSS configuration
- `src/app/globals.css` - Global styles with Tailwind directives

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **pnpm** 8.0.0 or higher (recommended package manager)
- **PostgreSQL** 14 or higher + pgvector extension
- **Google Cloud Platform** account (with Speech API enabled)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/engineer-cafe-navigator.git
cd engineer-cafe-navigator
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Variables Setup

```bash
# Create .env file
cp .env.example .env
```

Edit the `.env` file:

```env
# 🔑 Google Cloud (Service Account Authentication)
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_CREDENTIALS=./config/service-account-key.json
# API keys are no longer needed (Service Account authentication)

# 🤖 Gemini AI
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-preview-05-20

# 🔍 OpenAI (Embeddings)
OPENAI_API_KEY=your-openai-api-key
# For RAG search system using text-embedding-3-small model

# 🔓 CRON Jobs (Production)
CRON_SECRET=your-cron-secret
# For automated job authentication

# 📅 Google Calendar (Optional)
GOOGLE_CALENDAR_CLIENT_ID=your-calendar-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-calendar-client-secret
# For calendar sync OAuth2 authentication

# 🗄️ Database (Supabase)
POSTGRES_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 🌐 Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# 🔌 External Integration
WEBSOCKET_URL=ws://localhost:8080
RECEPTION_API_URL=http://localhost:8080/api

# 🎛️ Feature Toggles (planned)
# NEXT_PUBLIC_ENABLE_FACIAL_EXPRESSION=false
# NEXT_PUBLIC_USE_WEB_SPEECH_API=false
```

#### Service Account Setup

1. **Create Service Account**:
   ```bash
   # Create Service Account in Google Cloud Console
   # Required permissions: Cloud Speech-to-Text User, Cloud Text-to-Speech User
   ```

2. **Place Key File**:
   ```bash
   # Place downloaded JSON key
   cp ~/Downloads/service-account-key.json ./config/service-account-key.json
   ```

### 4. Database Setup

#### Using Supabase (Recommended)

```bash
# PostgreSQL + pgvector automatically available in Supabase projects
# Run migrations
pnpm supabase migration up
```

#### Using Local PostgreSQL

```bash
# Install PostgreSQL + pgvector (macOS)
brew install postgresql pgvector

# Create database
createdb engineer_cafe_navigator

# Enable pgvector extension
psql engineer_cafe_navigator -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
psql engineer_cafe_navigator < supabase/migrations/20250529005253_init_engineer_cafe_navigator.sql
```

### 5. VRM Character Model Setup

Place VRM files in the following location:

```
public/characters/models/
└── sakura.vrm              # Main guide character
```

> 💡 **How to get VRM models**
> - [VRoid Hub](https://hub.vroid.com/) - Many free models
> - [Booth](https://booth.pm/) - Paid high-quality models
> - [VRoid Studio](https://vroid.com/studio) - Create your own

### 6. Background Images (Optional)

For custom background images:

```
public/backgrounds/
├── IMG_5573.JPG           # Custom background image
├── office.png
└── cafe-interior.jpg
```

> 💡 Background images are automatically detected and selectable in the settings panel

### 7. Start Development Server

```bash
pnpm run dev
```

The application will start at http://localhost:3000 🎉

## 🛠️ Development Commands

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

# Testing Commands
pnpm test:api               # API endpoint tests
pnpm test:rag               # RAG search function tests
pnpm test:external-apis     # External API integration tests

# Monitoring & Health
pnpm monitor:dashboard      # View real-time performance metrics
pnpm health:check           # Run system health checks
```

## 📁 Project Structure

```
engineer-cafe-navigator/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   │   ├── voice/route.ts        # Voice processing API
│   │   │   ├── marp/route.ts         # Slide API
│   │   │   ├── character/route.ts    # Character API
│   │   │   ├── slides/route.ts       # Slide control API
│   │   │   ├── external/route.ts     # External API integration
│   │   │   └── qa/route.ts           # Q&A API
│   │   ├── components/               # React Components
│   │   │   ├── AudioControls.tsx     # Audio control component
│   │   │   ├── BackgroundSelector.tsx # Background selection component
│   │   │   ├── CharacterAvatar.tsx   # VRM character display
│   │   │   ├── LanguageSelector.tsx  # Language switching
│   │   │   ├── MarpViewer.tsx        # Marp slide viewer
│   │   │   ├── SlideDebugPanel.tsx   # Slide debug panel
│   │   │   └── VoiceInterface.tsx    # Voice interface
│   │   ├── globals.css               # Global styles
│   │   └── page.tsx                  # Main page
│   ├── mastra/                       # Mastra configuration
│   │   ├── agents/                   # AI Agents (8-Agent Architecture)
│   │   │   ├── router-agent.ts       # Query routing and classification
│   │   │   ├── business-info-agent.ts # Hours, pricing, location info
│   │   │   ├── facility-agent.ts     # Equipment and facility info
│   │   │   ├── memory-agent.ts       # Conversation context management
│   │   │   ├── event-agent.ts        # Calendar and event queries
│   │   │   ├── general-knowledge-agent.ts # General queries via web search
│   │   │   ├── clarification-agent.ts # Ambiguity resolution
│   │   │   ├── realtime-agent.ts     # Real-time voice interactions
│   │   │   ├── slide-narrator.ts     # Slide narration
│   │   │   └── welcome-agent.ts      # Welcome messages
│   │   ├── workflows/                # Workflow orchestration
│   │   │   └── main-qa-workflow.ts   # Main workflow coordinating 8 agents
│   │   ├── tools/                    # Mastra Tools
│   │   │   ├── character-control.ts  # Character control
│   │   │   ├── external-api.ts       # External API integration
│   │   │   ├── language-switch.ts    # Language switching
│   │   │   ├── marp-renderer.ts      # Marp renderer
│   │   │   ├── narration-loader.ts   # Narration loading
│   │   │   ├── page-transition.ts    # Page transitions
│   │   │   └── slide-control.ts      # Slide control
│   │   ├── voice/                    # Voice services
│   │   │   └── google-cloud-voice.ts # Google Cloud voice API
│   │   ├── types/                    # Mastra type definitions
│   │   └── index.ts                  # Mastra configuration file
│   ├── slides/                       # Slide content
│   │   ├── engineer-cafe.md          # Main slide file
│   │   ├── themes/                   # Custom themes
│   │   │   ├── default.css           # Default theme
│   │   │   └── engineer-cafe.css     # Custom theme
│   │   ├── narration/                # Narration JSON
│   │   │   ├── engineer-cafe-ja.json # Japanese narration
│   │   │   └── engineer-cafe-en.json # English narration
│   │   └── assets/images/            # Slide images
│   ├── characters/                   # Character assets
│   │   ├── animations/               # Animations
│   │   │   └── greetings.json        # Greeting animations
│   │   └── expressions/              # Expression data
│   ├── lib/                          # Common libraries
│   │   ├── audio/                    # Audio subsystem
│   │   │   ├── audio-playback-service.ts  # Unified audio service
│   │   │   ├── mobile-audio-service.ts    # Mobile-optimized audio
│   │   │   ├── audio-interaction-manager.ts # User interaction handling
│   │   │   └── web-audio-player.ts        # Core Web Audio API player
│   │   ├── lip-sync-analyzer.ts      # Lip-sync analysis (cache enabled)
│   │   ├── lip-sync-cache.ts         # Lip-sync cache system
│   │   ├── marp-processor.ts         # Marp processing
│   │   ├── narration-manager.ts      # Narration management
│   │   ├── simplified-memory.ts      # Unified memory system
│   │   ├── supabase.ts              # Supabase configuration
│   │   ├── supabase-memory.ts       # Supabase memory management
│   │   ├── voice-recorder.ts         # Voice recording
│   │   ├── vrm-utils.ts             # VRM utilities
│   │   ├── knowledge-base-updater.ts # Automated knowledge base updates
│   │   ├── stt-correction.ts         # STT misrecognition correction
│   │   └── websocket-manager.ts      # WebSocket management
│   └── types/                        # Type definitions
│       └── supabase.ts              # Supabase type definitions
├── public/
│   ├── characters/models/            # VRM models
│   │   └── sakura.vrm               # Main character
│   └── backgrounds/                  # Background images (auto-detected)
├── supabase/                         # Supabase configuration
│   ├── config.toml                   # Supabase config file
│   └── migrations/                   # Database migrations
├── config/                           # Configuration files
├── .env                              # Environment variables
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
└── tsconfig.json
```

## 🤖 8-Agent Architecture Details

### MainQAWorkflow (Coordinator)
The central orchestrator that manages all specialized agents and routes queries appropriately.

- **Responsibility**: Coordinates query processing across 8 specialized agents
- **Key Features**: 
  - Unified entry point for all Q&A requests
  - Manages conversation context and session state
  - Handles agent selection based on RouterAgent decisions

### Specialized Agents

#### 1. RouterAgent
- **Purpose**: Analyzes queries and routes them to appropriate agents
- **Features**:
  - Context-dependent routing ("Is it the same on Saturday?")
  - Memory-aware classification
  - Request type extraction (hours, pricing, location)
  - Ambiguity detection for clarification needs

#### 2. BusinessInfoAgent
- **Handles**: Operating hours, pricing, location, access information
- **Enhanced RAG**: Entity-aware search with priority scoring
- **Examples**: 
  - "What are the Engineer Cafe hours?"
  - "How much does it cost?"
  - "Where is it located?"

#### 3. FacilityAgent  
- **Handles**: Equipment, facilities, basement spaces, Wi-Fi
- **Special Focus**: Basement facility detection and categorization
- **Examples**:
  - "Tell me about the basement meeting spaces"
  - "What equipment is available?"
  - "How do I connect to Wi-Fi?"

#### 4. MemoryAgent
- **Purpose**: Manages conversation history and context
- **Features**:
  - 3-minute conversation window
  - Handles "What did I ask earlier?" queries
  - Emotion context preservation
  - Session continuity management

#### 5. EventAgent
- **Handles**: Calendar events, workshops, schedules
- **Integration**: Google Calendar API and Connpass events
- **Examples**:
  - "What events are happening today?"
  - "Are there any workshops this week?"

#### 6. GeneralKnowledgeAgent
- **Purpose**: Handles out-of-scope queries via web search
- **Features**: 
  - Gemini with grounding for real-time information
  - General knowledge queries
  - Current events and news

#### 7. ClarificationAgent
- **Purpose**: Resolves ambiguous queries
- **Key Clarifications**:
  - Cafe distinction (Engineer Cafe vs Saino Cafe)
  - Meeting room types (Paid 2F rooms vs Free basement spaces)
- **Memory Integration**: Supports follow-up queries like "What about the other one?"

#### 8. RealtimeAgent
- **Purpose**: Voice interaction processing
- **Features**:
  - Real-time speech processing
  - Emotion detection
  - Character animation control
  - Memory-aware responses

### Integration Flow

```
User Query → RealtimeAgent → MainQAWorkflow → RouterAgent
                                  ↓
                    [Route to Appropriate Agent]
                                  ↓
                    Agent Processing (with Enhanced RAG)
                                  ↓
                    Response Generation → TTS → User
```

## 🎯 Hybrid Voice Recognition Approach

### Overview
Engineer Cafe Navigator adopts a hybrid approach with Google Cloud STT and Web Speech API to achieve cost reduction and quality improvement.

### Voice Recognition Implementation
- **Google Cloud STT (Service Account Authentication)**: Provides high-accuracy voice recognition (implemented)
- **MediaRecorder API**: High-quality voice recording in WebM/Opus format (implemented)

### Text-based Emotion Recognition (Implemented)
- **EmotionManager**: Emotion detection through Japanese/English keyword analysis
- **VRM Expression Control**: 6 types of emotional expressions (neutral, happy, sad, angry, relaxed, surprised)
- **Context Integration**: Emotion judgment considering conversation history

### Future Expansion Plans
The following features are planned for future versions:

- **Web Speech API**: Browser-native voice recognition (currently using Google Cloud STT)
- **Facial Expression Recognition**: Camera-based facial expression detection using face-api.js
- **Enhanced Voice API**: `/api/voice/enhanced` endpoint

### Browser Compatibility
- **Google Cloud STT**: Works on all modern browsers
- **MediaRecorder API**: Full support on Chrome, Firefox, Edge; partial support on Safari
- **Three.js VRM**: Supported on all modern browsers

## ⚡ Performance Requirements

### Response Time Goals

| Process | Target Time | Implementation Status |
|---------|-------------|---------------------|
| Voice Recognition Start | < 200ms | ✅ Google Cloud STT |
| AI Response Generation | < 800ms | ✅ Gemini 2.5 Flash |
| Voice Synthesis | < 300ms | ✅ Google Cloud TTS |
| Lip-sync Analysis | < 50ms | ✅ Intelligent Cache |
| **Total Response Time** | **< 1.3s** | 🔄 Optimizing |

### Performance Optimization

#### Lip-sync Cache System
- **First Analysis**: 1-3 seconds (optimized algorithms, down from 4-8s)
- **Cache Retrieval**: 10-50ms (99% speed improvement)
- **Storage**: LocalStorage + memory hybrid
- **Auto Management**: 7-day expiry, 10MB limit
- **Mobile Performance**: Special optimizations for tablets

#### Memory System Performance
- **Context Retrieval**: < 100ms for 3-minute conversation window
- **Knowledge Base Search**: < 300ms with OpenAI embeddings
- **Memory Cleanup**: Automatic TTL-based expiration
- **Concurrent Operations**: Thread-safe with optimistic locking

### Concurrent Users

- **Expected**: Maximum 10 users
- **Peak Support**: 20 users
- **Implementation**: Mastra agent parallel processing

## 🎮 Usage

### Basic Operation Flow

1. **Language Selection**: Choose Japanese/English on first access
2. **Start Voice Interaction**: Click microphone button to speak
3. **Slide Guidance**: AI automatically progresses and explains slides
4. **Q&A Support**: Say "I have a question" to switch to Q&A mode
5. **Character Integration**: Character responds to voice input

### Voice Command Examples

| Japanese | English | Action |
|----------|---------|--------|
| "次のスライド" | "Next slide" | Advance slide |
| "前に戻って" | "Go back" | Go to previous slide |
| "最初から" | "Start over" | Go to first slide |
| "質問があります" | "I have a question" | Switch to Q&A mode |
| "料金について詳しく" | "Tell me about pricing" | Provide detailed information |

## 🔌 API Specifications

### Voice Processing API

#### POST /api/voice

Processes voice data and generates AI responses

**Request:**
```json
{
  "action": "process_voice",
  "audioData": "base64-encoded-audio",
  "sessionId": "session_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "transcript": "User speech text",
  "response": "AI response text",
  "audioResponse": "base64-encoded-audio",
  "shouldUpdateCharacter": true,
  "characterAction": "greeting"
}
```

### Slide Control API

#### POST /api/marp

Renders and displays Marp slides

**Request:**
```json
{
  "action": "render_with_narration",
  "slideFile": "engineer-cafe",
  "theme": "engineer-cafe"
}
```

#### POST /api/slides

Slide navigation and voice guidance

**Request:**
```json
{
  "action": "next",
  "slideFile": "engineer-cafe",
  "language": "ja"
}
```

### Character Control API

#### POST /api/character

Controls 3D character expressions and actions

**Request:**
```json
{
  "action": "setExpression",
  "expression": "friendly",
  "transition": true
}
```

## 🚀 Deployment & Operations

### Deploy to Vercel

```bash
# Install Vercel CLI
pnpm install -g vercel

# Initialize project
vercel

# Production deployment
vercel --prod
```

### Environment Variables (Production)

Set the following in Vercel dashboard:

```bash
GOOGLE_CLOUD_PROJECT_ID=prod-project-id
GOOGLE_CLOUD_CREDENTIALS=./config/service-account-key.json
GOOGLE_GENERATIVE_AI_API_KEY=prod-gemini-key
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXTAUTH_SECRET=secure-production-secret
```

### Recommended Production Databases

- **[Neon](https://neon.tech/)**: Serverless PostgreSQL
- **[Supabase](https://supabase.com/)**: OSS Firebase alternative
- **[Railway](https://railway.app/)**: Easy scaling

> 💡 All services support pgvector extension

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### 🎤 Voice Recognition Not Working

**Symptoms**: No response when pressing microphone button

**Solutions**:
```bash
# 1. Check microphone access permissions
# Browser settings > Privacy > Microphone

# 2. Verify HTTPS (production environment)
# localhost is exempt so HTTP works

# 3. Check Service Account permissions
gcloud projects get-iam-policy $GOOGLE_CLOUD_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*"

# 4. Verify Google Cloud API enablement
gcloud services list --enabled --filter="name:(speech|texttospeech)"
```

#### 🔐 Service Account Authentication Error

**Symptoms**: "Could not refresh access token" error

**Solutions**:
```bash
# 1. Check Service Account key file
ls -la config/service-account-key.json

# 2. Grant required permissions
gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/speech.client"

# 3. Enable APIs
gcloud services enable speech.googleapis.com texttospeech.googleapis.com

# 4. Check environment variables
cat .env | grep GOOGLE_CLOUD
```

#### 🗣️ STT Misrecognition (Japanese)

**Symptoms**: Common words like "営業時間" recognized as "A時間" or similar

**Solutions**:
```bash
# The system automatically corrects common misrecognitions:
# - A時間/えー時間 → 営業時間
# - リョウキン → 料金
# - ばっしょ → 場所
# - B1/B-1 → 地下1階

# To add new corrections:
# Edit src/lib/stt-correction.ts and add patterns to STT_CORRECTIONS

# Check correction logs:
grep "STT correction applied" logs/app.log
```

#### 🤖 Character Not Displaying

**Symptoms**: 3D character area is blank

**Solutions**:
```bash
# 1. Check VRM file placement
ls src/characters/models/

# 2. Check browser WebGL support
# Check webgl.disabled in about:config

# 3. Check memory usage
# Use Performance tab in developer tools
```

#### 📊 Slides Not Displaying

**Symptoms**: Slide area shows error

**Solutions**:
```bash
# 1. Check Markdown file syntax
# Manually verify Marp file syntax

# 2. Check asset files
ls src/slides/assets/images/

# 3. Check theme files
ls src/slides/themes/
```

#### 🎯 Clarification Not Working

**Symptoms**: Questions about "cafe" or "meeting rooms" return direct answers instead of asking for clarification

**Solutions**:
```bash
# 1. Verify ClarificationAgent is registered
grep -n "ClarificationAgent" src/mastra/workflows/main-qa-workflow.ts

# 2. Check RouterAgent clarification detection
grep -n "cafe-clarification-needed" src/mastra/agents/router-agent.ts

# 3. Test clarification directly
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the cafe hours?", "language": "en"}'

# Expected response should ask: "Engineer Cafe or Saino Cafe?"
```

#### 💬 Memory Follow-up Not Working

**Symptoms**: "What about the other one?" returns generic response instead of remembering previous clarification

**Solutions**:
```bash
# 1. Check memory system sessionId propagation
# Verify sessionId is passed between agents

# 2. Test memory retrieval
curl http://localhost:3000/api/memory/recent?sessionId=test_session

# 3. Verify SimplifiedMemorySystem is storing clarification context
# Check agent_memory table in Supabase
```

### Debug Commands

```bash
# Overall health check
curl http://localhost:3000/api/voice?action=status
curl http://localhost:3000/api/character?action=health
curl http://localhost:3000/api/marp?action=health

# Check logs
# Currently available commands
pnpm run dev         # Start development server
pnpm run build       # Build
pnpm run lint        # ESLint check

# Monitoring
curl http://localhost:3000/api/monitoring/dashboard # Performance dashboard
curl http://localhost:3000/api/health/knowledge    # Knowledge base health check

# Memory System Check
curl http://localhost:3000/api/memory/status       # Memory system status
curl http://localhost:3000/api/memory/cleanup      # Force memory cleanup
```

## 🔐 Security

### Data Protection

- **Voice Data**: Immediately deleted after processing
- **Conversation Logs**: Encrypted storage (Mastra Memory)
- **Personal Information**: GDPR and Personal Information Protection Law compliant

### Security Measures

#### XSS (Cross-Site Scripting) Protection
```typescript
// HTML sanitization
const sanitizeHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Remove script tags
  const scripts = doc.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  // Remove event handlers
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(element => {
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        element.removeAttribute(attr.name);
      }
    });
  });
  
  return doc.documentElement.outerHTML;
};
```

#### iframe Sandboxing
```html
<iframe
  srcDoc={sanitizedHtml}
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
  title="Slide presentation"
>
```

#### postMessage Origin Verification
```typescript
const handleMessage = (event: MessageEvent) => {
  const allowedOrigins = [
    window.location.origin,
    'null', // For iframe srcDoc content
  ];
  
  if (!allowedOrigins.includes(event.origin)) {
    console.warn('Rejected message from untrusted origin:', event.origin);
    return;
  }
  
  // Process message...
};
```

### API Security

```typescript
// Input validation
const schema = z.object({
  audioData: z.string().max(10000000), // 10MB limit
  sessionId: z.string().uuid(),
});

// Rate limiting
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

## 📊 KPIs & Success Metrics

### Usage Metrics

- ✅ **Monthly Sessions**: Target 100 sessions
- ✅ **Average Session Duration**: 3-5 minutes
- ✅ **Completion Rate**: 80% or higher

### Quality Metrics

- ✅ **User Satisfaction**: 4.0/5.0 or higher
- ✅ **Voice Recognition Accuracy**: 95% or higher
- ✅ **System Downtime**: Less than 1 hour per month

### Business Metrics

- ✅ **Staff Workload Reduction**: 50%
- ✅ **New Registration Completion Rate**: +10% improvement
- ✅ **Multilingual Support Efficiency**: 80% reduction

## 🏭 Production Features

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
  - STT correction rates and patterns
  - Memory system performance
  - Audio playback success rates

#### **Alert System**
- **Webhook Integration**: `/api/alerts/webhook`
- **Alert Types**:
  - Performance degradation (>2s response time)
  - Error rate spikes (>5% error rate)
  - Knowledge base health issues
  - External API failures
  - Memory system overload
  - Audio service failures

#### **Metrics Storage**
- **Tables**:
  - `rag_search_metrics`: Search performance tracking
  - `external_api_metrics`: API usage and costs
  - `knowledge_base_metrics`: Knowledge base health
  - `system_metrics`: Overall system performance
  - `stt_correction_metrics`: Speech recognition accuracy
- **Retention**: 30 days for detailed metrics, 1 year for aggregated data
- **Dashboards**: Real-time Grafana dashboards for production monitoring

### Automated Knowledge Base Updates

#### **CRON Job System**
- **Update Frequency**: Every 6 hours (0:00, 6:00, 12:00, 18:00 JST)
- **Authentication**: Secured with CRON_SECRET environment variable
- **Endpoints**:
  - `/api/cron/update-knowledge-base`: Syncs external data sources
  - `/api/cron/update-slides`: Updates presentation content
  - `/api/cron/cleanup-memory`: Cleans expired memory entries
  - `/api/cron/generate-reports`: Daily performance reports

#### **External Data Sources**
- **Connpass Events**: 
  - Automatic import of Engineer Cafe events
  - Event deduplication and validation
  - Multi-language content generation
- **Google Calendar**: 
  - OAuth2 integration for schedule sync
  - Real-time availability updates
  - Special hours and holiday detection
- **Website Scraping**: 
  - Placeholder for future content updates
  - News and announcement sync

#### **Update Features**
- **Incremental Updates**: Only processes changed data
- **Rollback Capability**: Automatic rollback on failure
- **Notification System**: Slack/Discord webhooks for update status
- **Validation Pipeline**: Content validation before insertion
- **Performance Monitoring**: Update duration and success rate tracking

### Enhanced Memory System Features

#### **SimplifiedMemorySystem Architecture**
- **3-Minute Context Window**: Recent conversation retention
- **Agent Isolation**: Separate namespaces for different agents
- **Memory-Aware Questions**: Automatic detection of "What did I ask?" queries
- **Emotion Tracking**: Preserves emotional context across conversations

#### **Memory Operations**
- **Atomic Updates**: Thread-safe with optimistic locking
- **Batch Processing**: Efficient bulk operations
- **Auto-cleanup**: TTL-based expiration via Supabase
- **Conflict Resolution**: Last-write-wins with version tracking

#### **Performance Characteristics**
- **Write Performance**: < 50ms for memory updates
- **Read Performance**: < 100ms for context retrieval
- **Memory Limit**: 100 messages per agent namespace
- **TTL**: 3 minutes (configurable per agent)

### Response Precision System

#### **Intelligent Response Filtering**
- **Specific Request Detection**: Identifies queries for営業時間, 料金, 場所 etc.
- **1-Sentence Responses**: Limits responses to essential information only
- **Context Filtering**: Ignores unrelated information in knowledge base
- **Multi-language Support**: Works with both Japanese and English queries

#### **Response Quality Metrics**
- **Average Response Length**: Reduced from 3000+ to <100 characters for specific queries
- **User Satisfaction**: 95%+ for information accuracy
- **Response Time**: <500ms for specific information requests

### Complete Audio System Refactoring

#### **AudioPlaybackService** (New in 2024)
- **Unified Interface**: Single API for all audio playback needs
- **Optional Lip-sync**: Integrated lip-sync analysis
- **Error Recovery**: Automatic retry with fallback
- **Performance**: Optimized for mobile devices

#### **Web Audio API Migration**
- **Removed**: All HTML Audio Element dependencies
- **Added**: Complete Web Audio API implementation
- **Benefits**: Better mobile compatibility, lower latency
- **Fallback**: Automatic degradation when needed

## 🗺️ Roadmap

### 📅 Phase 1 (Completed): MVP Implementation
- [x] Basic voice interaction system
- [x] Slide presentations
- [x] 3D character integration
- [x] Multilingual support (Japanese/English)
- [x] Production monitoring
- [x] Automated knowledge base updates

### 📅 Phase 2 (Completed): Advanced Interaction
- [x] Improved conversation context understanding
- [x] Emotion recognition & expression
- [x] Customizable characters
- [x] SimplifiedMemorySystem with 3-minute context

### 📅 Phase 3 (Future): Extended Features
- [ ] Reservation system integration
- [ ] QR code reading
- [ ] AR/VR experience
- [ ] Mobile application

### 📅 Phase 4 (Advanced): AI Enhancement
- [ ] Personalized responses
- [ ] Learning-based conversation system
- [ ] Predictive guidance
- [ ] Multimodal input

## 🤝 Contributing

### How to Contribute

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

### Coding Standards

```bash
# Run ESLint + Prettier
pnpm run lint
pnpm run format

# Available test commands:
pnpm run test:api           # API endpoint tests
pnpm run test:rag           # RAG search function tests
pnpm run test:external-apis # External API integration tests
```

### Issue Reporting

Please report bugs and improvement suggestions via [Issues](https://github.com/your-org/engineer-cafe-navigator/issues).

## 📜 License

This project is published under the [MIT License](LICENSE).

## 📞 Contact & Support

### Project Team

- **Development Lead**: [Terisuke](mailto:company@cor-jp.com)
- **Engineer Cafe**: [cafe@example.com](mailto:info@engineer-cafe.jp)

### Technical Support

- **Issues**: [GitHub Issues](https://github.com/your-org/engineer-cafe-navigator/issues)
- **Discussion**: [GitHub Discussions](https://github.com/your-org/engineer-cafe-navigator/discussions)
- **Discord**: [Development Community](https://discord.gg/your-invite)

## 📖 Detailed Documentation

### Technical Documentation
- **[📚 Documentation Index](docs/README.md)** - Complete documentation index
- **[📖 API Specification](docs/API.md)** - Complete REST API specification
- **[🔒 Security Guide](docs/SECURITY.md)** - Security measures & threat analysis
- **[🛠️ Development Guide](docs/DEVELOPMENT.md)** - Technical specifications for developers
- **[🚀 Deployment Guide](docs/DEPLOYMENT.md)** - Production environment deployment procedures
- **[📊 Monitoring Guide](docs/MONITORING.md)** - Performance monitoring & alert setup
- **[🔄 Automation Guide](docs/AUTOMATION.md)** - CRON & external integration setup
- **[🧠 Memory System Guide](docs/MEMORY.md)** - SimplifiedMemorySystem architecture
- **[🎤 Audio System Guide](docs/AUDIO.md)** - Web Audio API implementation

### Security Highlights
- ✅ **XSS Protection**: HTML sanitization implemented
- ✅ **iframe Protection**: Sandboxing + Origin verification
- ✅ **Communication Encryption**: HTTPS + Security headers
- ✅ **Input Validation**: Zod schema validation
- ✅ **Privacy**: Data protection through UI state synchronization

---

<div align="center">

**Built with ❤️ by Engineer Cafe Team**

[🏠 Home](https://engineer-cafe.fukuoka.jp) • [📚 Documentation](docs/README.md) • [🚀 Demo](https://engineer-cafe-navigator.vercel.app)

</div>