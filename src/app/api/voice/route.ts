import { NextRequest, NextResponse } from 'next/server';
import { getEngineerCafeNavigator } from '@/mastra';
import { Config } from '@/mastra/types/config';

// Configuration (in production, load from environment variables)
const config: Config = {
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
    credentials: process.env.GOOGLE_CLOUD_CREDENTIALS!,
    speechApiKey: process.env.GOOGLE_SPEECH_API_KEY!,
    translateApiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
  },
  gemini: {
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17',
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
    const navigator = getEngineerCafeNavigator(config);
    const realtimeAgent = navigator.getAgent('realtime');
    
    if (!realtimeAgent) {
      return NextResponse.json(
        { error: 'Realtime agent not available' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, audioData, sessionId, language, text } = body;

    switch (action) {
      case 'process_voice':
        // Convert base64 audio to ArrayBuffer
        const audioBuffer = Buffer.from(audioData, 'base64').buffer;
        
        const result = await realtimeAgent.processVoiceInput(audioBuffer);
        
        // Convert audio response back to base64
        const audioResponseBase64 = Buffer.from(result.audioResponse).toString('base64');
        
        return NextResponse.json({
          success: true,
          transcript: result.transcript,
          response: result.response,
          audioResponse: audioResponseBase64,
          shouldUpdateCharacter: result.shouldUpdateCharacter,
          characterAction: result.characterAction,
        });

      case 'set_language':
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
        
        return NextResponse.json(
          { error: 'Language switch tool not available' },
          { status: 500 }
        );

      case 'get_conversation_state':
        const state = realtimeAgent.getConversationState();
        const summary = await realtimeAgent.getConversationSummary();
        
        return NextResponse.json({
          success: true,
          state,
          summary,
        });

      case 'clear_conversation':
        await realtimeAgent.clearConversationHistory();
        await realtimeAgent.setConversationState('idle');
        
        return NextResponse.json({
          success: true,
          message: 'Conversation cleared',
        });

      case 'handle_interruption':
        await realtimeAgent.handleInterruption();
        
        return NextResponse.json({
          success: true,
          message: 'Interruption handled',
        });

      case 'detect_language':
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

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
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
