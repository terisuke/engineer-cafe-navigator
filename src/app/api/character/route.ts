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
    const characterTool = navigator.getTool('characterControl');
    
    if (!characterTool) {
      return NextResponse.json(
        { error: 'Character control tool not available' },
        { status: 500 }
      );
    }

    // Check if request has a body
    const contentLength = request.headers.get('content-length');
    if (!contentLength || contentLength === '0') {
      return NextResponse.json(
        { error: 'Request body is empty' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          details: jsonError instanceof Error ? jsonError.message : 'JSON parse failed',
        },
        { status: 400 }
      );
    }

    const { 
      action, 
      expression, 
      animation, 
      position, 
      rotation, 
      modelPath, 
      duration, 
      transition,
      emotion,
      text,
      language
    } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action parameter is required' },
        { status: 400 }
      );
    }

    const result = await characterTool.execute({
      action,
      expression,
      animation,
      position,
      rotation,
      modelPath,
      duration,
      transition,
      emotion,
      text,
      language,
    });
    
    return NextResponse.json({
      success: result.success,
      result: result.result,
      error: result.error,
    });
  } catch (error) {
    console.error('Character API error:', error);
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
    const characterTool = navigator.getTool('characterControl') as any;

    if (!characterTool) {
      return NextResponse.json(
        { error: 'Character control tool not available' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'current_state':
        if (characterTool.getCurrentState) {
          const state = await characterTool.getCurrentState();
          
          return NextResponse.json({
            success: true,
            state,
          });
        } else {
          // Fallback if method doesn't exist
          return NextResponse.json({
            success: true,
            state: {
              expression: 'neutral',
              animation: 'idle',
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              model: '/characters/models/engineer-guide.vrm',
            },
          });
        }

      case 'supported_features':
        if (characterTool.getSupportedFeatures) {
          const features = await characterTool.getSupportedFeatures();
          
          return NextResponse.json({
            success: true,
            ...features,
          });
        } else {
          // Fallback with default features
          return NextResponse.json({
            success: true,
            expressions: [
              'neutral', 'happy', 'sad', 'angry', 'surprised', 
              'thinking', 'speaking', 'listening', 'greeting', 'explaining'
            ],
            animations: [
              'idle', 'greeting', 'waving', 'pointing', 'explaining', 
              'thinking', 'nodding', 'bowing', 'presenting', 'listening'
            ],
            capabilities: [
              'expression-blending', 'animation-layering', 'smooth-transitions',
              'position-control', 'rotation-control', 'model-switching'
            ],
          });
        }

      case 'preload_animations':
        // For GET requests, animations should be passed as query parameters
        const animationsParam = searchParams.get('animations');
        
        if (!animationsParam) {
          return NextResponse.json(
            { error: 'animations parameter required' },
            { status: 400 }
          );
        }
        
        const animations = animationsParam.split(',');
        
        if (characterTool.preloadAnimations) {
          const preloadResult = await characterTool.preloadAnimations(animations);
          
          return NextResponse.json({
            success: preloadResult.success,
            loaded: preloadResult.loaded,
            failed: preloadResult.failed,
          });
        } else {
          // Fallback if method doesn't exist
          return NextResponse.json({
            success: true,
            loaded: animations,
            failed: [],
          });
        }

      case 'available_models':
        // List available VRM models
        try {
          const fs = require('fs').promises;
          const path = require('path');
          
          const modelsDir = path.resolve('src/characters/models');
          const modelFiles = await fs.readdir(modelsDir);
          const models = modelFiles
            .filter((file: string) => file.endsWith('.vrm'))
            .map((file: string) => ({
              name: file.replace('.vrm', ''),
              path: `/characters/models/${file}`,
              filename: file,
            }));

          return NextResponse.json({
            success: true,
            models,
          });
        } catch (error) {
          return NextResponse.json({
            success: true,
            models: [
              {
                name: 'engineer-guide',
                path: '/characters/models/engineer-guide.vrm',
                filename: 'engineer-guide.vrm',
              },
              {
                name: 'engineer-greeter',
                path: '/characters/models/engineer-greeter.vrm',
                filename: 'engineer-greeter.vrm',
              },
            ],
          });
        }

      case 'health':
        return NextResponse.json({
          success: true,
          status: 'healthy',
          characterSystem: 'VRM',
          renderer: 'Three.js',
        });

      default:
        return NextResponse.json(
          { error: 'Action parameter required' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Character API GET error:', error);
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
    const characterTool = navigator.getTool('characterControl') as any;
    
    if (!characterTool) {
      return NextResponse.json(
        { error: 'Character control tool not available' },
        { status: 500 }
      );
    }

    // Check if request has a body
    const contentLength = request.headers.get('content-length');
    if (!contentLength || contentLength === '0') {
      return NextResponse.json(
        { error: 'Request body is empty' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          details: jsonError instanceof Error ? jsonError.message : 'JSON parse failed',
        },
        { status: 400 }
      );
    }

    const { animations } = body;

    if (!animations || !Array.isArray(animations)) {
      return NextResponse.json(
        { error: 'animations array required' },
        { status: 400 }
      );
    }

    if (characterTool.preloadAnimations) {
      const preloadResult = await characterTool.preloadAnimations(animations);
      
      return NextResponse.json({
        success: preloadResult.success,
        loaded: preloadResult.loaded,
        failed: preloadResult.failed,
      });
    } else {
      // Fallback if method doesn't exist
      return NextResponse.json({
        success: true,
        loaded: animations,
        failed: [],
      });
    }
  } catch (error) {
    console.error('Character API PUT error:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
