# Enhanced Voice API Documentation

## Overview

The Enhanced Voice API (`/api/voice/enhanced`) extends the standard voice processing capabilities by incorporating facial expression recognition for emotion-aware responses.

## Endpoint

```
POST /api/voice/enhanced
```

## Request Body

```typescript
interface EnhancedVoiceRequest {
  action: 'process_text';
  text: string;
  language?: 'ja' | 'en';
  sessionId?: string;
  expression?: FacialExpression;
  expressionConfidence?: number;
}

enum FacialExpression {
  Neutral = "neutral",
  Happy = "happy",
  Sad = "sad",
  Angry = "angry",
  Fearful = "fearful",
  Disgusted = "disgusted",
  Surprised = "surprised",
  Unknown = "unknown"
}
```

### Parameters

- **action** (required): Must be `'process_text'` for text processing with expression context
- **text** (required): The user's input text to process
- **language** (optional): Language code (`'ja'` or `'en'`). Defaults to session language
- **sessionId** (optional): Session identifier for conversation continuity
- **expression** (optional): Detected facial expression from the user
- **expressionConfidence** (optional): Confidence level of expression detection (0-1)

## Response

```typescript
interface EnhancedVoiceResponse {
  success: boolean;
  transcript: string;
  response: string;
  audioResponse: string; // Base64 encoded audio
  shouldUpdateCharacter: boolean;
  characterAction?: string;
  emotion?: string;
  sessionId: string;
  detectedExpression?: FacialExpression;
  expressionConfidence?: number;
}
```

### Response Fields

- **success**: Whether the request was processed successfully
- **transcript**: The original user input text
- **response**: AI-generated response text
- **audioResponse**: Base64-encoded TTS audio of the response
- **shouldUpdateCharacter**: Whether the 3D character should update
- **characterAction**: Suggested character animation/action
- **emotion**: Character's emotion for the response
- **sessionId**: Current session ID for continuity
- **detectedExpression**: Echo of the input expression (for confirmation)
- **expressionConfidence**: Echo of the input confidence (for confirmation)

## Expression Context Behavior

The API adjusts responses based on detected facial expressions:

### Happy Expression
- Response tone: Enthusiastic, positive
- Character emotion: Happy
- Example: More energetic greetings and confirmations

### Sad Expression  
- Response tone: Empathetic, supportive
- Character emotion: Concerned
- Example: Gentler responses with encouragement

### Angry Expression
- Response tone: Calm, understanding
- Character emotion: Neutral/Concerned
- Example: De-escalating language, patient explanations

### Surprised Expression
- Response tone: Informative, reassuring
- Character emotion: Neutral/Happy
- Example: Clear explanations, acknowledging surprise

### Neutral/Unknown Expression
- Response tone: Standard professional
- Character emotion: Neutral
- Example: Default conversational tone

## Example Requests

### Basic Text Processing
```json
{
  "action": "process_text",
  "text": "エンジニアカフェについて教えてください",
  "language": "ja"
}
```

### With Expression Context
```json
{
  "action": "process_text",
  "text": "How do I join Engineer Cafe?",
  "language": "en",
  "expression": "happy",
  "expressionConfidence": 0.85
}
```

### Full Context Request
```json
{
  "action": "process_text",
  "text": "料金について詳しく知りたいです",
  "language": "ja",
  "sessionId": "session_123456",
  "expression": "sad",
  "expressionConfidence": 0.72
}
```

## Error Handling

### Common Errors

```json
{
  "error": "Realtime agent not available",
  "status": 500
}
```

```json
{
  "error": "Internal server error",
  "details": "Error message details",
  "status": 500
}
```

## Integration with Frontend

### VoiceInterface Component Usage

```typescript
// In VoiceInterface.tsx
const processTextInput = async (text: string) => {
  const apiEndpoint = isFacialExpressionEnabled 
    ? '/api/voice/enhanced' 
    : '/api/voice';
  
  const requestBody = {
    action: 'process_text',
    text: text,
    language: currentLanguage,
    sessionId: generateSessionId(),
    // Include expression data if available
    ...(isFacialExpressionEnabled && currentExpression.probability > 0.5 && {
      expression: currentExpression.expression,
      expressionConfidence: currentExpression.probability
    })
  };
  
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  const result = await response.json();
  // Handle response...
};
```

## Fallback Behavior

If expression detection fails or is disabled:
1. The API works exactly like the standard `/api/voice` endpoint
2. No expression context is applied to responses
3. Standard emotion detection from text analysis is used

## Performance Considerations

- Expression context processing adds minimal latency (<50ms)
- Expression confidence threshold of 0.5 prevents false positives
- Caching mechanisms maintain response time targets

## Privacy & Security

- Facial expression data is NOT stored or logged
- Expression data is only used for the current request
- Camera access requires explicit user permission
- Feature can be completely disabled via environment variables