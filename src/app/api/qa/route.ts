import { NextRequest, NextResponse } from 'next/server';
import { getEngineerCafeNavigator } from '@/mastra';
import { Config } from '@/mastra/types/config';

// Configuration
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
    const body = await request.json();
    const { action, question, sessionId, language, text, fromLanguage, toLanguage, useNewArchitecture } = body;

    const qaAgent = navigator.getAgent('qa');
    
    if (!qaAgent) {
      return NextResponse.json(
        { error: 'Q&A agent not available' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'ask_question':
        if (!question) {
          return NextResponse.json(
            { error: 'Question text required' },
            { status: 400 }
          );
        }

        const result = await qaAgent.processQuestion(question, sessionId, language);
        
        // Convert answer to speech - disabled for testing
        let audioResponse = null;
        // Temporarily disable audio for testing
        /*
        const voiceService = navigator.getTool('voiceService');
        if (voiceService) {
          try {
            const currentLanguage = language || 'ja';
            const audioResult = await voiceService.textToSpeech(answer, { language: currentLanguage });
            // Handle both Buffer and object responses
            const audioBuffer = audioResult.audioContent || audioResult;
            audioResponse = Buffer.from(audioBuffer).toString('base64');
          } catch (audioError) {
            console.error('Audio conversion error:', audioError);
            // Continue without audio
          }
        }
        */

        // Log the interaction
        const externalTool = navigator.getTool('externalApi');
        if (externalTool && sessionId) {
          await externalTool.execute({
            action: 'logVisitorActivity',
            data: {
              sessionId,
              activity: 'qa_interaction',
              details: {
                question,
                answer: result.answer,
                category: result.metadata.category,
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
        
        return NextResponse.json({
          success: true,
          answer: result.answer,
          emotion: result.emotion,
          category: result.metadata.category,
          requestType: result.metadata.requestType,
          confidence: result.metadata.confidence,
          processingTime: result.metadata.processingTime,
          agentName: result.metadata.agentName,
          sources: result.metadata.sources,
          audioResponse,
          hasAudio: !!audioResponse,
          metadata: result.metadata, // Include full metadata for debugging
        });

      case 'escalate_to_staff':
        if (!question) {
          return NextResponse.json(
            { error: 'Question text required for escalation' },
            { status: 400 }
          );
        }

        const escalationResult = "スタッフに問い合わせが送信されました。少々お待ちください。";
        
        // Notify external system
        const externalApi = navigator.getTool('externalApi');
        if (externalApi) {
          await externalApi.execute({
            action: 'notifyStaff',
            message: `Q&A escalation: ${question}`,
            urgency: 'medium',
          });
        }
        
        return NextResponse.json({
          success: true,
          message: escalationResult,
          escalated: true,
        });

      case 'get_fallback_response':
        const fallbackResponse = "申し訳ございません。回答できませんでした。スタッフにお尋ねください。";
        
        return NextResponse.json({
          success: true,
          response: fallbackResponse,
        });

      case 'translate_question':
        
        const languageTool = navigator.getTool('languageSwitch');
        if (!languageTool) {
          return NextResponse.json(
            { error: 'Language translation not available' },
            { status: 500 }
          );
        }

        const translationResult = await languageTool.execute({
          action: 'translateText',
          text,
          fromLanguage,
          language: toLanguage,
        });
        
        return NextResponse.json({
          success: translationResult.success,
          result: translationResult.result,
          error: translationResult.error,
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Q&A API error:', error);
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
    const qaAgent = navigator.getAgent('qa');

    if (!qaAgent) {
      return NextResponse.json(
        { error: 'Q&A agent not available' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'question_categories':
        const categories = [
          {
            id: 'pricing',
            name: 'Pricing & Membership',
            nameJa: '料金・会員制度',
            description: 'Questions about pricing plans and membership options',
            descriptionJa: '料金プランや会員制度に関する質問',
          },
          {
            id: 'facilities',
            name: 'Facilities & Equipment',
            nameJa: '施設・設備',
            description: 'Questions about workspace facilities and available equipment',
            descriptionJa: 'ワークスペースの施設や利用可能な設備に関する質問',
          },
          {
            id: 'access',
            name: 'Access & Location',
            nameJa: 'アクセス・所在地',
            description: 'Questions about location, hours, and access methods',
            descriptionJa: '場所、営業時間、アクセス方法に関する質問',
          },
          {
            id: 'events',
            name: 'Events & Community',
            nameJa: 'イベント・コミュニティ',
            description: 'Questions about events, networking, and community activities',
            descriptionJa: 'イベント、ネットワーキング、コミュニティ活動に関する質問',
          },
          {
            id: 'membership',
            name: 'Membership & Registration',
            nameJa: '会員登録・手続き',
            description: 'Questions about membership registration and processes',
            descriptionJa: '会員登録や手続きに関する質問',
          },
          {
            id: 'technical',
            name: 'Technical Support',
            nameJa: '技術サポート',
            description: 'Questions about internet, equipment, and technical support',
            descriptionJa: 'インターネット、機器、技術サポートに関する質問',
          },
          {
            id: 'general',
            name: 'General Inquiries',
            nameJa: '一般的なお問い合わせ',
            description: 'General questions about Engineer Cafe services',
            descriptionJa: 'エンジニアカフェのサービスに関する一般的な質問',
          },
        ];
        
        return NextResponse.json({
          success: true,
          categories,
        });

      case 'sample_questions':
        const sampleQuestions = {
          ja: [
            '料金プランについて教えてください',
            '営業時間は何時から何時までですか？',
            'Wi-Fiの速度はどのくらいですか？',
            '会議室の予約方法を教えてください',
            'コーヒーは無料ですか？',
            'イベントの予定はありますか？',
          ],
          en: [
            'Can you tell me about the pricing plans?',
            'What are your operating hours?',
            'How fast is the Wi-Fi connection?',
            'How can I book a meeting room?',
            'Is coffee complimentary?',
            'Are there any upcoming events?',
          ],
        };
        
        const language = searchParams.get('language') || 'ja';
        
        return NextResponse.json({
          success: true,
          questions: sampleQuestions[language as keyof typeof sampleQuestions] || sampleQuestions.ja,
        });

      case 'conversation_summary':
        // Get conversation summary from memory
        const conversationHistory: any[] = [];
        const storedLanguage = 'ja';
        
        const summary = conversationHistory.length > 0
          ? `Conversation with ${conversationHistory.length} exchanges`
          : storedLanguage === 'ja' ? 'まだ会話がありません' : 'No conversation yet';
        
        return NextResponse.json({
          success: true,
          summary,
          exchangeCount: Math.floor(conversationHistory.length / 2),
          lastActivity: conversationHistory.length > 0 
            ? conversationHistory[conversationHistory.length - 1].timestamp 
            : null,
        });

      case 'health':
        return NextResponse.json({
          success: true,
          status: 'healthy',
          ragEnabled: true,
          knowledgeBase: 'Engineer Cafe KB',
        });

      default:
        return NextResponse.json(
          { error: 'Action parameter required' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Q&A API GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const navigator = getEngineerCafeNavigator(config);
    const qaAgent = navigator.getAgent('qa');
    
    if (!qaAgent) {
      return NextResponse.json(
        { error: 'Q&A agent not available' },
        { status: 500 }
      );
    }

    // Clear conversation history
    if (qaAgent.memory && qaAgent.memory.clear) {
      qaAgent.memory.clear();
    }
    
    return NextResponse.json({
      success: true,
      message: 'Conversation history cleared',
    });
  } catch (error) {
    console.error('Q&A API DELETE error:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
