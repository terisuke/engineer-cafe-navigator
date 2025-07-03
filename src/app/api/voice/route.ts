import { getEngineerCafeNavigator } from '@/mastra';
import { Config } from '@/mastra/types/config';
import { NextRequest, NextResponse } from 'next/server';

// Configuration (in production, load from environment variables)
const config: Config = {
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
    credentials: process.env.GOOGLE_CLOUD_CREDENTIALS!,
    // speechApiKey is not needed with service account
    translateApiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
  },
  gemini: {
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20',
  },
  database: {
    url: process.env.POSTGRES_URL!,
  },
  nextAuth: {
    url: process.env.NEXTAUTH_URL!,
    secret: process.env.NEXTAUTH_SECRET!,
  },
  vercel: process.env.VERCEL_URL ? {
    url: process.env.VERCEL_URL,
  } : undefined,
  external: {
    websocketUrl: process.env.WEBSOCKET_URL,
    receptionApiUrl: process.env.RECEPTION_API_URL,
  },
};

export async function POST(request: NextRequest) {
  try {
    // Parse and log request body
    const body = await request.json();
    console.log('Voice API Request:', {
      action: body.action,
      hasAudioData: !!body.audioData,
      sessionId: body.sessionId,
      language: body.language,
      hasText: !!body.text,
      timestamp: new Date().toISOString()
    });
    
    // Validate required action field
    if (!body.action) {
      console.error('400 Error - Missing action field');
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }
    
    const navigator = getEngineerCafeNavigator(config);
    const realtimeAgent = navigator.getAgent('realtime');
    
    if (!realtimeAgent) {
      return NextResponse.json(
        { error: 'Realtime agent not available' },
        { status: 500 }
      );
    }

    const { action, audioData, sessionId, language, text } = body;

    switch (action) {
      case 'start_session': {
        const newSessionId = await realtimeAgent.startSession(body.visitorId, body.language || 'ja');
        return NextResponse.json({
          success: true,
          sessionId: newSessionId,
        });
      }
      case 'speech_to_text': {
        // Validate required fields for speech_to_text
        if (!audioData) {
          console.error('400 Error - Missing audioData for speech_to_text');
          return NextResponse.json(
            { error: 'Missing required field: audioData' },
            { status: 400 }
          );
        }
        // Convert base64 audio to ArrayBuffer
        const audioBuffer = Buffer.from(audioData, 'base64').buffer;
        const result = await realtimeAgent.speechToText(audioBuffer, language || 'ja');
        return NextResponse.json({
          success: result.success,
          transcript: result.transcript,
          confidence: result.confidence,
          error: result.error,
          startTime: Date.now()
        });
      }
      case 'process_voice': {
        // Validate required fields for process_voice
        if (!audioData) {
          console.error('400 Error - Missing audioData for process_voice');
          return NextResponse.json(
            { error: 'Missing required field: audioData' },
            { status: 400 }
          );
        }
        // Ensure session is active
        if (sessionId && !realtimeAgent.getCurrentSessionId()) {
          await realtimeAgent.startSession(undefined, language || 'ja');
        }
        // If transcript already provided (optional field), pass undefined to avoid duplicate STT
        if (text && text.trim()) {
          const result = await realtimeAgent.processTextInput(text);
          const audioResponseBase64 = Buffer.from(result.audioResponse!).toString('base64');
          return NextResponse.json({
            success: true,
            transcript: text,
            response: result.response,
            responseText: result.response, // Add for compatibility with page.tsx
            audioResponse: audioResponseBase64,
            shouldUpdateCharacter: result.shouldUpdateCharacter,
            characterAction: result.characterAction,
            emotion: result.emotion,
            primaryEmotion: result.primaryEmotion,
            sessionId: realtimeAgent.getCurrentSessionId(),
          });
        }

        // Convert base64 audio to ArrayBuffer and let agent handle STT internally
        const audioBuffer = Buffer.from(audioData, 'base64').buffer;
        const result = await realtimeAgent.processVoiceInput(audioBuffer, language || 'ja');
        
        // Check if audioResponse is valid before accessing its properties
        if (!result.audioResponse || !(result.audioResponse instanceof ArrayBuffer)) {
          console.error('[Voice API] Invalid audioResponse:', {
            audioResponse: result.audioResponse,
            type: typeof result.audioResponse,
            isArrayBuffer: result.audioResponse instanceof ArrayBuffer
          });
          return NextResponse.json({
            success: false,
            error: 'Audio response generation failed',
            transcript: result.transcript,
            response: result.response,
          }, { status: 500 });
        }
        
        // result.audioResponseはArrayBufferなので、Buffer.fromで扱うためUint8Arrayに変換する
        console.log('[Voice API] Converting Uint8Array audio to base64:', {
          audioResponseSize: result.audioResponse.byteLength,
          firstFewBytes: result.audioResponse.byteLength > 0 ? Array.from(new Uint8Array(result.audioResponse.slice(0, 10))) : 'NO DATA'
        });
        const audioResponseBase64 = Buffer.from(new Uint8Array(result.audioResponse)).toString('base64');
        console.log('[Voice API] Base64 conversion result:', {
          base64Length: audioResponseBase64.length,
          base64Prefix: audioResponseBase64.substring(0, 50),
          isEmpty: audioResponseBase64.length === 0
        });
        return NextResponse.json({
          success: true,
          transcript: result.transcript,
          response: result.response,
          responseText: result.response, // Add for compatibility with page.tsx
          audioResponse: audioResponseBase64,
          shouldUpdateCharacter: result.shouldUpdateCharacter,
          characterAction: result.characterAction,
          emotion: result.emotion,
          primaryEmotion: result.primaryEmotion, // Add primaryEmotion from agent
          emotionTags: result.emotionTags, // Add emotion tags
          sessionId: realtimeAgent.getCurrentSessionId(),
        });
      }
      case 'end_session': {
        await realtimeAgent.endSession();
        return NextResponse.json({
          success: true,
          message: 'Session ended',
        });
      }
      case 'set_language': {
        await realtimeAgent.setLanguage(language);
        const languageTool = navigator.getTool('languageSwitch');
        if (languageTool) {
          const switchResult = await languageTool.execute({
            action: 'switchLanguage',
            language,
          });
          return NextResponse.json({
            success: switchResult.success,
            result: switchResult.result,
            error: switchResult.error,
          });
        }
        return NextResponse.json({
          success: true,
          message: 'Language updated',
        });
      }
      case 'get_conversation_state': {
        const state = realtimeAgent.getConversationState();
        const summary = await realtimeAgent.getConversationSummary();
        return NextResponse.json({
          success: true,
          state,
          summary,
        });
      }
      case 'clear_conversation': {
        await realtimeAgent.clearConversationHistory();
        await realtimeAgent.setConversationState('idle');
        return NextResponse.json({
          success: true,
          message: 'Conversation cleared',
        });
      }
      case 'handle_interruption': {
        await realtimeAgent.handleInterruption();
        return NextResponse.json({
          success: true,
          message: 'Interruption handled',
        });
      }
      case 'text_to_speech': {
        // Ensure session is active for TTS
        if (sessionId && !realtimeAgent.getCurrentSessionId()) {
          await realtimeAgent.startSession(undefined, language || 'ja');
        }
        // Set language for TTS
        if (language) {
          await realtimeAgent.setLanguage(language);
        }
        // Generate TTS audio
        const ttsResult = await realtimeAgent.generateTTSAudio(text);
        console.log('[Voice API] Converting TTS result to base64:', {
          ttsResultType: typeof ttsResult,
          ttsResultSize: ttsResult instanceof ArrayBuffer ? ttsResult.byteLength : 'Not ArrayBuffer'
        });
        const ttsAudioBase64 = Buffer.from(ttsResult).toString('base64');
        console.log('[Voice API] TTS Base64 conversion result:', {
          base64Length: ttsAudioBase64.length,
          base64Prefix: ttsAudioBase64.substring(0, 50),
          isEmpty: ttsAudioBase64.length === 0
        });
        return NextResponse.json({
          success: true,
          audioResponse: ttsAudioBase64,
          text: text,
        });
      }
      case 'process_text': {
        // Process text input with optional streaming
        if (!text) {
          return NextResponse.json(
            { error: 'Missing required field: text' },
            { status: 400 }
          );
        }
        // Ensure session is active
        if (sessionId && !realtimeAgent.getCurrentSessionId()) {
          await realtimeAgent.startSession(undefined, language || 'ja');
        }
        // Check if streaming is requested
        const useStreaming = body.streaming === true;
        if (useStreaming) {
          // Use streaming TTS for better responsiveness
          const streamResult = await realtimeAgent.processTextInputStreaming(text);
          // Collect audio chunks into array for response
          const audioChunks: string[] = [];
          for await (const chunk of streamResult.audioChunks) {
            const chunkBase64 = Buffer.from(chunk.chunk).toString('base64');
            audioChunks.push(chunkBase64);
          }
          return NextResponse.json({
            success: true,
            transcript: text,
            response: streamResult.response,
            audioChunks, // Array of base64 audio chunks
            shouldUpdateCharacter: streamResult.shouldUpdateCharacter,
            characterAction: streamResult.characterAction,
            emotion: streamResult.emotion,
            primaryEmotion: streamResult.primaryEmotion,
            sessionId: realtimeAgent.getCurrentSessionId(),
            streaming: true,
          });
        } else {
          // Use regular processing
          const result = await realtimeAgent.processTextInput(text);
          const audioResponseBase64 = Buffer.from(result.audioResponse).toString('base64');
          return NextResponse.json({
            success: true,
            transcript: text,
            response: result.response,
            audioResponse: audioResponseBase64,
            shouldUpdateCharacter: result.shouldUpdateCharacter,
            characterAction: result.characterAction,
            emotion: result.emotion,
            primaryEmotion: result.primaryEmotion,
            sessionId: realtimeAgent.getCurrentSessionId(),
          });
        }
      }
      case 'detect_language': {
        const languageSwitch = navigator.getTool('languageSwitch');
        if (languageSwitch) {
          const detection = await languageSwitch.execute({
            action: 'detectLanguage',
            text,
          });
          return NextResponse.json({
            success: detection.success,
            result: detection.result,
            error: detection.error,
          });
        }
        return NextResponse.json(
          { error: 'Language detection tool not available' },
          { status: 500 }
        );
      }
      default: {
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const navigator = getEngineerCafeNavigator(config);

    switch (action) {
      case 'status':
        const realtimeAgent = navigator.getAgent('realtime');
        const state = realtimeAgent?.getConversationState() || 'unknown';
        
        return NextResponse.json({
          success: true,
          status: 'active',
          conversationState: state,
          timestamp: new Date().toISOString(),
        });

      case 'supported_languages':
        const languageTool = navigator.getTool('languageSwitch');
        
        if (languageTool) {
          const languages = await languageTool.execute({
            action: 'getAvailableLanguages',
          });
          
          return NextResponse.json({
            success: languages.success,
            result: languages.result,
            error: languages.error,
          });
        }
        
        return NextResponse.json(
          { error: 'Language tool not available' },
          { status: 500 }
        );

      default:
        return NextResponse.json(
          { error: 'Action parameter required' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Voice API GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
