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
```

## ⚠️ CRITICAL: Tailwind CSS Version

**This project uses Tailwind CSS v3.4.17. DO NOT upgrade to v4.**
- Tailwind CSS v4 has breaking changes and is incompatible
- Always use: `tailwindcss@3.4.17`, `postcss@8.4.47`, `autoprefixer@10.4.20`
- PostCSS config must use `tailwindcss: {}`, NOT `@tailwindcss/postcss: {}`

## High-Level Architecture

### Technology Stack
- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript
- **AI Framework**: Mastra 0.9.4 for agent orchestration
- **AI Model**: Google Gemini 2.5 Flash Preview (for responses)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions for vector search)
- **Voice**: Google Cloud Speech-to-Text/Text-to-Speech
- **3D Graphics**: Three.js with @pixiv/three-vrm
- **Database**: PostgreSQL with pgvector extension
- **Backend Services**: Supabase

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
   - Knowledge base with vector embeddings (1536 dimensions, OpenAI)
   - Multi-language support (Japanese/English content)
   - Agent memory for state persistence

### Key API Endpoints

- **POST /api/voice**: Voice processing (speech recognition, AI response, TTS)
- **GET /api/backgrounds**: Get available background images
- **POST /api/marp**: Marp markdown slide rendering
- **POST /api/slides**: Slide navigation with narration
- **POST /api/character**: VRM character control
- **POST /api/qa**: Q&A interactions
- **POST /api/external**: External system integration
- **GET/POST /admin/knowledge**: Knowledge base management interface

### Environment Configuration

Required environment variables:
- `GOOGLE_CLOUD_PROJECT_ID`: GCP project for speech services
- `GOOGLE_GENERATIVE_AI_API_KEY`: Gemini API key for AI responses
- `OPENAI_API_KEY`: OpenAI API key for embeddings (1536 dimensions)
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Supabase access
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side Supabase access
- Service account key at `config/service-account-key.json`

### Database Schema

The application uses Supabase with the following main tables:
- `conversation_sessions`: Visitor sessions with language and mode
- `conversation_history`: Chat messages with audio URLs
- `knowledge_base`: RAG knowledge with vector embeddings
- `agent_memory`: Key-value storage for agent state
- `conversation_analytics`: Usage metrics and analytics

All tables have Row Level Security (RLS) enabled with service role access.

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
- **OpenAI Embeddings**: Uses text-embedding-3-small model for semantic search
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
- **3D Character Animations**: Synchronized with voice output and emotion detection
- **Slide Presentations**: Marp-based slides with voice narration
- **Admin Knowledge Management**: Structured metadata editing with dropdowns and templates
- **Hybrid AI Architecture**: Gemini for responses, OpenAI for embeddings
- **Cross-language RAG**: Questions in one language can retrieve answers from content in either language
- **Voice Recognition**: Google Cloud STT with Service Account authentication
- **WebSocket Support**: For external system integration
- **No Test Framework**: Currently configured for production deployment