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

# Testing
pnpm test:api               # Run API endpoint tests
pnpm test:rag               # Test RAG search functionality
pnpm test:external-apis     # Test external API integrations
pnpm test:local             # Run local setup tests
pnpm test:production        # Production deployment tests

# RAG & Knowledge Base
pnpm seed:knowledge         # Seed knowledge base
pnpm migrate:embeddings     # Migrate embeddings
pnpm test:external-data     # Test external data fetcher

# Monitoring & Analysis
pnpm monitor:baseline       # Collect performance baseline
pnpm monitor:migration      # Monitor migration status
pnpm compare:implementations # Compare implementation performance
pnpm validate:production    # Validate production readiness
pnpm check:deployment       # Check deployment readiness
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
- **AI Model**: Google Gemini 2.5 Flash Preview
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
   - Knowledge base with vector embeddings (1536 dimensions)
   - Agent memory for state persistence

### Key API Endpoints

- **POST /api/voice**: Voice processing (speech recognition, AI response, TTS)
- **GET /api/backgrounds**: Get available background images
- **POST /api/marp**: Marp markdown slide rendering
- **POST /api/slides**: Slide navigation with narration
- **POST /api/character**: VRM character control
- **POST /api/qa**: Q&A interactions
- **POST /api/external**: External system integration

### Environment Configuration

Required environment variables:
- `GOOGLE_CLOUD_PROJECT_ID`: GCP project for speech services
- `GOOGLE_GENERATIVE_AI_API_KEY`: Gemini API key
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
2. VRM character models should be placed in `public/characters/models/`
3. Slide content in Marp format goes in `src/slides/`
4. Narration JSON files in `src/slides/narration/`
5. Use Mastra agents for AI interactions
6. Voice processing uses Google Cloud services with base64 audio encoding

### Key Considerations

- The app is designed for multi-language support (Japanese/English)
- Real-time voice interactions with interruption handling
- 3D character animations synchronized with voice output
- Slide presentations with voice narration
- WebSocket support for external system integration
- Voice recognition using Google Cloud STT with Service Account authentication
- Emotion detection from text for character expression control
- No test framework is currently configured
- Enhanced voice API with facial expression is planned but not yet implemented