# Fix for Double TTS Call Issue

## Problem Description
The application was making two TTS (Text-to-Speech) API calls when using the ClarificationAgent:
1. First call: Successful voice processing with ClarificationAgent response
2. Second call: Error handler triggered with `sessionId: undefined`

## Root Causes Identified

### 1. Missing sessionId in Error Handler
The error handler's TTS call (lines 490-499) was missing the sessionId parameter, causing `sessionId: undefined` in logs.

### 2. Potential State Update Error
After successful audio playback, state updates were happening outside the try-catch block, potentially causing errors that triggered the main catch block.

### 3. No Persistent Session ID
A new sessionId was generated for each API call instead of maintaining one per conversation session.

## Changes Made

### 1. Added Persistent Session ID
```typescript
// Added at line 47
const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`);
```

### 2. Updated All API Calls to Use Persistent sessionId
- Updated `process_voice` call (line 404)
- Updated `text_to_speech` calls (lines 184, 360, 503)
- All API calls now use the same sessionId throughout the conversation

### 3. Added sessionId to Error Handler TTS Call
```typescript
// Line 503
sessionId: sessionId
```

### 4. Improved Error Handling for Audio Playback
```typescript
// Lines 470-474
try {
  await playAudioWithLipSync(result.audioResponse);
} catch (audioError) {
  console.error('[processVoiceInput] Audio playback error:', audioError);
}
```

### 5. Enhanced Error Logging
Added stack trace logging to better understand what triggers the catch block:
```typescript
console.error('[processVoiceInput] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
```

## Benefits
1. **Consistent Session Tracking**: All API calls within a conversation now share the same sessionId
2. **Better Error Isolation**: Audio playback errors won't trigger the main error handler
3. **Improved Debugging**: Enhanced error logging helps identify the root cause of failures
4. **No More Undefined sessionId**: Error responses now include proper sessionId

## Testing
To test the fix:
1. Start the development server: `pnpm dev`
2. Use voice input to trigger the ClarificationAgent
3. Check the console logs - there should be no second TTS call with undefined sessionId
4. Verify that the sessionId remains consistent throughout the conversation