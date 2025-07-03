# Unified Response System Implementation

## Overview

Successfully implemented a unified response format for all Q&A agents to ensure consistent processing by VoiceOutputAgent and CharacterControlAgent.

## Key Changes

### 1. New Unified Response Type
Created `/src/mastra/types/unified-response.ts` with:
- `UnifiedAgentResponse` interface
- Helper functions for creating responses and converting to specific agent formats
- Standardized metadata structure

### 2. Updated All Q&A Agents

All agents now return `UnifiedAgentResponse` instead of plain strings:

- **MemoryAgent**: Returns responses with emotion and memory context metadata
- **ClarificationAgent**: Returns helpful clarification messages with confidence scores
- **BusinessInfoAgent**: Returns business info with enhanced RAG metadata and source tracking
- **FacilityAgent**: Returns facility information with technical/guiding emotions
- **EventAgent**: Returns event info with calendar/knowledge base source tracking
- **GeneralKnowledgeAgent**: Returns general responses with confidence based on sources

### 3. Enhanced MainQAWorkflow

Updated `MainQAWorkflow` to:
- Process `UnifiedAgentResponse` from agents
- Return enhanced `QAWorkflowResult` with emotion and detailed metadata
- Maintain backward compatibility with existing API structure

### 4. Updated API Response

The `/api/qa` endpoint now returns:
```typescript
{
  success: true,
  answer: string,
  emotion: string,          // NEW: For character control
  category: string,
  requestType: string | null,
  confidence: number,
  processingTime: number,
  agentName: string,        // NEW: Source agent identification
  sources: string[],        // NEW: Data sources used
  audioResponse: string,
  hasAudio: boolean,
  metadata: {               // Enhanced metadata
    routedTo: string,
    category: string,
    requestType: string | null,
    language: SupportedLanguage,
    confidence: number,
    processingTime: number,
    agentName: string,
    sources?: string[],
    processingInfo?: {
      filtered?: boolean,
      contextInherited?: boolean,
      enhancedRag?: boolean
    }
  }
}
```

## Benefits

### 1. Consistent Voice Output
VoiceOutputAgent can now extract standardized information:
```typescript
const voiceRequest = toVoiceOutputRequest(agentResponse, sessionId);
// Contains: text, language, emotion, sessionId, agentName
```

### 2. Enhanced Character Control
CharacterControlAgent gets rich metadata for better animations:
```typescript
const characterRequest = toCharacterControlRequest(agentResponse);
// Contains: emotion, text, agentName for contextual animations
```

### 3. Better Analytics
Detailed metadata enables:
- Source tracking (knowledge_base, enhanced_rag, web_search, etc.)
- Confidence scoring per agent
- Processing information (filtering, context inheritance, etc.)
- Agent performance monitoring

### 4. Emotion-Aware Responses
Each agent provides contextual emotions:
- `helpful`, `informative`, `guiding` for informational responses
- `excited` for events, `technical` for Wi-Fi info
- `apologetic` for errors, `confused` for clarification needs

## Example Response Flow

1. **User asks**: "エンジニアカフェの営業時間は？"
2. **RouterAgent** routes to **BusinessInfoAgent**
3. **BusinessInfoAgent** returns:
   ```typescript
   {
     text: "エンジニアカフェの営業時間は9:00〜22:00です。",
     emotion: "informative",
     metadata: {
       agentName: "BusinessInfoAgent",
       confidence: 0.85,
       language: "ja",
       category: "business_hours",
       requestType: "hours",
       sources: ["enhanced_rag"],
       processingInfo: {
         filtered: true,
         enhancedRag: true
       }
     }
   }
   ```

4. **VoiceOutputAgent** and **CharacterControlAgent** process the unified response consistently

## Implementation Quality

- **Type Safety**: Full TypeScript interfaces ensure compile-time checking
- **Backward Compatibility**: Existing API consumers receive same data structure
- **Extensibility**: Easy to add new metadata fields without breaking changes  
- **Performance**: Minimal overhead with efficient helper functions
- **Maintainability**: Centralized response creation reduces code duplication

## Next Steps

The unified response system is now ready for:
1. Integration with voice output pipeline
2. Enhanced character animation control
3. Advanced analytics and monitoring
4. A/B testing different emotional responses
5. Confidence-based response filtering

All Q&A agents now provide consistent, rich responses that enable seamless processing by downstream services.