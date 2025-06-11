import { NextRequest, NextResponse } from 'next/server';
import { getEngineerCafeNavigator } from '@/mastra';
import { Config } from '@/mastra/types/config';

// Configuration (same as voice route)
const config: Config = {
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
    credentials: process.env.GOOGLE_CLOUD_CREDENTIALS!,
    speechApiKey: process.env.GOOGLE_SPEECH_API_KEY!,
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
    const navigator = getEngineerCafeNavigator(config);
    const slideNarrator = navigator.getAgent('narrator');
    const slideControlTool = navigator.getTool('slideControl');
    
    if (!slideNarrator || !slideControlTool) {
      return NextResponse.json(
        { error: 'Slide agents/tools not available' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, slideNumber, slideFile, language, question, enabled, interval } = body;

    switch (action) {
      case 'next':
        const nextResult = await slideNarrator.nextSlide();
        
        if (nextResult.success && nextResult.audioBuffer) {
          const audioBase64 = Buffer.from(nextResult.audioBuffer).toString('base64');
          return NextResponse.json({
            success: true,
            slideNumber: nextResult.slideNumber,
            narration: nextResult.narration,
            audioResponse: audioBase64,
            characterAction: nextResult.characterAction,
            transitionMessage: nextResult.transitionMessage,
          });
        }
        
        return NextResponse.json({
          success: false,
          message: nextResult.transitionMessage,
        });

      case 'previous':
        const prevResult = await slideNarrator.previousSlide();
        
        if (prevResult.success && prevResult.audioBuffer) {
          const audioBase64 = Buffer.from(prevResult.audioBuffer).toString('base64');
          return NextResponse.json({
            success: true,
            slideNumber: prevResult.slideNumber,
            narration: prevResult.narration,
            audioResponse: audioBase64,
            characterAction: prevResult.characterAction,
            transitionMessage: prevResult.transitionMessage,
          });
        }
        
        return NextResponse.json({
          success: false,
          message: prevResult.transitionMessage,
        });

      case 'goto':
        if (!slideNumber) {
          return NextResponse.json(
            { error: 'Slide number required for goto action' },
            { status: 400 }
          );
        }

        const gotoResult = await slideNarrator.gotoSlide(slideNumber);
        
        if (gotoResult.success && gotoResult.audioBuffer) {
          const audioBase64 = Buffer.from(gotoResult.audioBuffer).toString('base64');
          return NextResponse.json({
            success: true,
            slideNumber: gotoResult.slideNumber,
            narration: gotoResult.narration,
            audioResponse: audioBase64,
            characterAction: gotoResult.characterAction,
          });
        }
        
        return NextResponse.json({
          success: false,
          error: 'Failed to navigate to slide',
        });

      case 'load_narration':
        if (!slideFile || !language) {
          return NextResponse.json(
            { error: 'Slide file and language required' },
            { status: 400 }
          );
        }

        await slideNarrator.loadNarration(slideFile, language);
        
        return NextResponse.json({
          success: true,
          message: 'Narration loaded successfully',
        });

      case 'narrate_current':
        if (!slideFile || !language) {
          return NextResponse.json(
            { error: 'Slide file and language required for narration' },
            { status: 400 }
          );
        }

        console.log(`[SLIDES API] Narrating slide ${slideNumber} in language: ${language}`);
        
        // Ensure narration is loaded before attempting to narrate
        await slideNarrator.loadNarration(slideFile, language);
        
        // Store the language in memory for TTS to use
        await slideNarrator.memory.set('language', language);
        console.log(`[SLIDES API] Set language in narrator memory: ${language}`);
        
        const narrateResult = await slideNarrator.narrateSlide(slideNumber);
        const audioBase64 = Buffer.from(narrateResult.audioBuffer).toString('base64');
        
        return NextResponse.json({
          success: true,
          slideNumber: narrateResult.slideNumber,
          narration: narrateResult.narration,
          audioResponse: audioBase64,
          characterAction: narrateResult.characterAction,
        });

      case 'answer_question':
        if (!question) {
          return NextResponse.json(
            { error: 'Question text required' },
            { status: 400 }
          );
        }

        const answer = await slideNarrator.answerSlideQuestion(question);
        
        // Convert answer to speech
        const voiceService = navigator.getTool('voiceService');
        let answerAudio = null;
        if (voiceService) {
          const currentLanguage = await slideNarrator.memory.get('language') || 'ja';
          const audioBuffer = await voiceService.textToSpeech(answer, { language: currentLanguage });
          answerAudio = Buffer.from(audioBuffer).toString('base64');
        }
        
        return NextResponse.json({
          success: true,
          answer,
          audioResponse: answerAudio,
        });

      case 'set_autoplay':
        await slideNarrator.setAutoPlay(enabled, interval);
        
        return NextResponse.json({
          success: true,
          autoPlay: enabled,
          interval,
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Slides API error:', error);
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
    const slideNarrator = navigator.getAgent('narrator');
    const slideControlTool = navigator.getTool('slideControl');

    switch (action) {
      case 'current_slide':
        if (!slideNarrator) {
          return NextResponse.json(
            { error: 'Slide narrator not available' },
            { status: 500 }
          );
        }

        const slideInfo = await slideNarrator.getCurrentSlideInfo();
        
        return NextResponse.json({
          success: true,
          ...slideInfo,
        });

      case 'slide_progress':
        if (!slideControlTool) {
          return NextResponse.json(
            { error: 'Slide control tool not available' },
            { status: 500 }
          );
        }

        const progress = await slideControlTool.getSlideProgress();
        
        return NextResponse.json({
          success: true,
          ...progress,
        });

      case 'slide_list':
        const slideFile = searchParams.get('slideFile') || 'engineer-cafe';
        const marpTool = navigator.getTool('marpRenderer');
        
        if (!marpTool) {
          return NextResponse.json(
            { error: 'Marp renderer not available' },
            { status: 500 }
          );
        }

        const slideList = await marpTool.getSlideList(`src/slides/${slideFile}.md`);
        
        return NextResponse.json({
          success: slideList.success,
          slides: slideList.slides,
          error: slideList.error,
        });

      case 'autoplay_status':
        if (!slideNarrator) {
          return NextResponse.json(
            { error: 'Slide narrator not available' },
            { status: 500 }
          );
        }

        const autoPlay = await slideNarrator.memory.get('autoPlay') || false;
        const interval = await slideNarrator.memory.get('autoPlayInterval') || 30000;
        
        return NextResponse.json({
          success: true,
          autoPlay,
          interval,
        });

      default:
        return NextResponse.json(
          { error: 'Action parameter required' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Slides API GET error:', error);
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
