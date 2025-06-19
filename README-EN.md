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

### 🆕 Latest Updates (2025/06/19)

#### ✅ Completed Features
- **🎯 Production Monitoring** - Real-time performance monitoring and alert system
- **🔄 Automated Knowledge Base Updates** - Connpass/Google Calendar sync every 6 hours
- **📊 Metrics Collection** - Detailed tracking of RAG search, cache efficiency, API usage
- **🔐 Google Embeddings API Support** - text-embedding-004 (768 dimensions) and OpenAI (1536 dimensions) hybrid
- **OpenAI Embedding Integration** - Unified RAG search system with OpenAI text-embedding-3-small (1536 dimensions)
- **Multilingual RAG Search** - English questions can retrieve Japanese content and vice versa
- **Knowledge Base Management UI** - Data management at `/admin/knowledge` with metadata templates
- **Complete Basement Space Support** - Voice search for 4 types of basement facilities (MTG, Focus, Under, Makers)
- **Cross-language Search** - Retrieve optimal information from both languages regardless of question language
- **Service Account Authentication** - Secure authentication without API keys
- **Supabase Memory Adapter Integration** - Persistent conversation history and session management
- **Emotion Recognition & VRM Expression Control** - Automatic facial expression changes via text analysis
- **🚀 Lip-sync Cache System** - Intelligent audio analysis caching for 99% speed improvement (4-8s → 10-50ms)
- **🧠 SimplifiedMemorySystem** - Unified memory architecture with 3-minute conversation context retention

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
    
    subgraph "Backend (Mastra + API Routes)"
        Agent[Mastra Agents]
        Tools[Mastra Tools]
        Memory[Agent Memory]
    end
    
    subgraph "External Services"
        GCP[Google Cloud<br/>Speech/TTS]
        Gemini[Gemini 2.5<br/>Flash Preview]
        DB[(PostgreSQL<br/>+ pgvector)]
    end
    
    UI --> Voice
    Voice --> Agent
    Slide --> Tools
    Char --> Tools
    Agent --> GCP
    Agent --> Gemini
    Memory --> DB
    Tools --> DB
```

### 🛠️ Technology Stack

#### Core Technologies
- **Framework**: [Mastra 0.10.5](https://mastra.ai/) - AI Agent Development Framework
- **Frontend**: [Next.js 15.3.2](https://nextjs.org/) + [TypeScript 5.8.3](https://www.typescriptlang.org/)
- **AI/ML**: [Google Gemini 2.5 Flash Preview](https://ai.google.dev/)
- **Voice Processing**: [Google Cloud Speech-to-Text/Text-to-Speech](https://cloud.google.com/speech-to-text)

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
│   │   ├── agents/                   # AI Agents
│   │   │   ├── qa-agent.ts           # Q&A agent
│   │   │   ├── realtime-agent.ts     # Real-time agent
│   │   │   ├── slide-narrator.ts     # Slide narrator
│   │   │   └── welcome-agent.ts      # Welcome agent
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
│   │   ├── audio-player.ts           # Audio playback
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
- **First Analysis**: 4-8 seconds (audio waveform analysis)
- **Cache Retrieval**: 10-50ms (99% speed improvement)
- **Storage**: LocalStorage + memory hybrid
- **Auto Management**: 7-day expiry, 10MB limit

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

#### **Alert System**
- **Webhook Integration**: `/api/alerts/webhook`
- **Alert Types**:
  - Performance degradation
  - Error rate spikes
  - Knowledge base health issues
  - External API failures

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

- **Development Lead**: [Your Name](mailto:your.email@example.com)
- **Engineer Cafe**: [cafe@example.com](mailto:cafe@example.com)

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

### Security Highlights
- ✅ **XSS Protection**: HTML sanitization implemented
- ✅ **iframe Protection**: Sandboxing + Origin verification
- ✅ **Communication Encryption**: HTTPS + Security headers
- ✅ **Input Validation**: Zod schema validation
- ✅ **Privacy**: Data protection through UI state synchronization

---

<div align="center">

**Built with ❤️ by Engineer Cafe Team**

[🏠 Home](https://engineer-cafe.fukuoka.jp) • [📚 Documentation](docs/README.md) • [🚀 Demo](https://demo.engineer-cafe-navigator.vercel.app)

</div>