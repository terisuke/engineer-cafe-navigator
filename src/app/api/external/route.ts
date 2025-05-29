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
    const externalTool = navigator.getTool('externalApi');
    
    if (!externalTool) {
      return NextResponse.json(
        { error: 'External API tool not available' },
        { status: 500 }
      );
    }

    const { 
      action, 
      data, 
      endpoint, 
      message, 
      recipient, 
      urgency 
    } = await request.json();

    const result = await externalTool.execute({
      action,
      data,
      endpoint,
      message,
      recipient,
      urgency,
    });
    
    return NextResponse.json({
      success: result.success,
      result: result.result,
      error: result.error,
    });
  } catch (error) {
    console.error('External API error:', error);
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
    const externalTool = navigator.getTool('externalApi');

    if (!externalTool) {
      return NextResponse.json(
        { error: 'External API tool not available' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'connection_status':
        const status = await externalTool.getConnectionStatus();
        
        return NextResponse.json({
          success: true,
          ...status,
        });

      case 'event_info':
        const eventResult = await externalTool.execute({
          action: 'getEventInfo',
        });
        
        return NextResponse.json({
          success: eventResult.success,
          result: eventResult.result,
          error: eventResult.error,
        });

      case 'room_availability':
        const roomResult = await externalTool.execute({
          action: 'checkRoomAvailability',
        });
        
        return NextResponse.json({
          success: roomResult.success,
          result: roomResult.result,
          error: roomResult.error,
        });

      case 'health':
        const connectionStatus = await externalTool.getConnectionStatus();
        
        return NextResponse.json({
          success: true,
          status: 'healthy',
          connections: connectionStatus,
          configured: {
            websocket: !!config.external.websocketUrl,
            receptionApi: !!config.external.receptionApiUrl,
          },
        });

      case 'test_reception_api':
        // Test connection to reception API
        const testResult = await externalTool.execute({
          action: 'callReceptionApi',
          endpoint: 'health',
        });
        
        return NextResponse.json({
          success: testResult.success,
          connected: testResult.success,
          result: testResult.result,
          error: testResult.error,
        });

      default:
        return NextResponse.json(
          { error: 'Action parameter required' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('External API GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const navigator = getEngineerCafeNavigator(config);
    const externalTool = navigator.getTool('externalApi');
    
    if (!externalTool) {
      return NextResponse.json(
        { error: 'External API tool not available' },
        { status: 500 }
      );
    }

    const { sessionId, activity, details } = await request.json();

    const result = await externalTool.execute({
      action: 'logVisitorActivity',
      data: {
        sessionId,
        activity,
        details,
      },
    });
    
    return NextResponse.json({
      success: result.success,
      result: result.result,
      error: result.error,
    });
  } catch (error) {
    console.error('External API PUT error:', error);
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
    const externalTool = navigator.getTool('externalApi');
    
    if (!externalTool) {
      return NextResponse.json(
        { error: 'External API tool not available' },
        { status: 500 }
      );
    }

    // Close all external connections
    await externalTool.closeConnections();
    
    return NextResponse.json({
      success: true,
      message: 'External connections closed',
    });
  } catch (error) {
    console.error('External API DELETE error:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
