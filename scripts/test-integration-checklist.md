# Integration Test Checklist

## 1. Existing Functionality Tests ✅

### Google Cloud TTS (Text-to-Speech)
- [ ] Test Japanese audio generation
- [ ] Test English audio generation
- [ ] Verify audio quality and format
- [ ] Check volume controls work
- [ ] Verify mute functionality

### Mastra Agents
- [ ] WelcomeAgent - Test greeting functionality
- [ ] QAAgent - Test Q&A responses
- [ ] RealtimeAgent - Test real-time conversation
- [ ] SlideNarrator - Test slide narration

### Slide Navigation
- [ ] Marp viewer loads correctly
- [ ] Next/Previous slide navigation works
- [ ] Slide auto-play functionality
- [ ] Narration syncs with slides
- [ ] Keyboard controls (arrow keys)

### VRM Character
- [ ] Character model loads
- [ ] Animations play correctly
- [ ] Expression changes work
- [ ] Lip-sync with audio
- [ ] Background changes apply

### WebSocket Integration
- [ ] Connection establishes
- [ ] External messages received
- [ ] State synchronization works

### Supabase Memory Adapter
- [ ] Conversation history saves
- [ ] Session management works
- [ ] Knowledge base queries function
- [ ] Agent memory persists

## 2. New Feature Tests 🆕

### Web Speech API
- [ ] Recognition starts in Chrome
- [ ] Japanese recognition accuracy
- [ ] English recognition accuracy
- [ ] Auto-stop when user stops speaking
- [ ] Interim transcript display
- [ ] Final transcript processing

### Facial Expression Detection
- [ ] Camera permission request
- [ ] face-api.js models load
- [ ] Expression detection works
- [ ] Expression UI updates
- [ ] Privacy - only when enabled

### Fallback Mechanisms
- [ ] Web Speech → Google STT fallback
- [ ] Camera denial graceful handling
- [ ] Expression detection failure handling
- [ ] Browser incompatibility messages

### Enhanced Voice API
- [ ] /api/voice/enhanced endpoint works
- [ ] Expression data included in requests
- [ ] Emotion-aware responses generated
- [ ] Standard /api/voice still works

## 3. Browser Compatibility 🌐

### Chrome (Primary)
- [ ] All features work
- [ ] Web Speech API active
- [ ] Facial expression works

### Edge
- [ ] Basic functionality
- [ ] Web Speech API active
- [ ] Graceful degradation

### Firefox
- [ ] Basic functionality
- [ ] Google STT fallback works
- [ ] No Web Speech errors

### Safari
- [ ] Basic functionality
- [ ] Partial Web Speech support
- [ ] Graceful degradation

## 4. Performance Tests ⚡

- [ ] Page load time < 3s
- [ ] Voice response time < 1.3s
- [ ] No memory leaks
- [ ] CPU usage reasonable

## 5. Error Scenarios 🚨

- [ ] No microphone available
- [ ] No camera available
- [ ] Network disconnection
- [ ] API rate limits
- [ ] Invalid audio format

## Test Execution Steps

1. **Setup**
   ```bash
   # Default mode (features disabled)
   NEXT_PUBLIC_ENABLE_FACIAL_EXPRESSION=false
   NEXT_PUBLIC_USE_WEB_SPEECH_API=false
   pnpm dev
   ```

2. **Test existing features** (complete section 1)

3. **Enable new features**
   ```bash
   # Enable new features
   NEXT_PUBLIC_ENABLE_FACIAL_EXPRESSION=true
   NEXT_PUBLIC_USE_WEB_SPEECH_API=true
   pnpm dev
   ```

4. **Test new features** (complete section 2)

5. **Browser testing** (complete section 3)

6. **Performance & errors** (complete sections 4-5)

## Sign-off Criteria

- [ ] All existing features work exactly as before
- [ ] New features work with proper fallbacks
- [ ] No console errors in production mode
- [ ] Documentation is complete and accurate
- [ ] Ready for production deployment