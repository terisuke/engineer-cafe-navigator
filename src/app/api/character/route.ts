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
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17',
  },
  database: {
    url: process.env.POSTGRES_URL!,
  },
  nextAuth: {
    url: process.env.NEXTAUTH_URL!,
    secret: process.env.NEXTAUTH_SECRET!,
  },
  vercel: {
    url: process.env.VERCEL_URL,
  },
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

    const { 
      action, 
      expression, 
      animation, 
      position, 
      rotation, 
      modelPath, 
      duration, 
      transition 
    } = await request.json();

    const result = await characterTool.execute({
      action,
      expression,
      animation,
      position,
      rotation,
      modelPath,
      duration,
      transition,
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
    const characterTool = navigator.getTool('characterControl');

    if (!characterTool) {
      return NextResponse.json(
        { error: 'Character control tool not available' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'current_state':
        const state = await characterTool.getCurrentState();
        
        return NextResponse.json({
          success: true,
          state,
        });

      case 'supported_features':
        const features = await characterTool.getSupportedFeatures();
        
        return NextResponse.json({
          success: true,
          ...features,
        });

      case 'preload_animations':
        const { animations } = await request.json();
        
        if (!animations || !Array.isArray(animations)) {
          return NextResponse.json(
            { error: 'animations array required' },
            { status: 400 }
          );
        }

        const preloadResult = await characterTool.preloadAnimations(animations);
        
        return NextResponse.json({
          success: preloadResult.success,
          loaded: preloadResult.loaded,
          failed: preloadResult.failed,
        });

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
    const characterTool = navigator.getTool('characterControl');
    
    if (!characterTool) {
      return NextResponse.json(
        { error: 'Character control tool not available' },
        { status: 500 }
      );
    }

    const { animations } = await request.json();

    if (!animations || !Array.isArray(animations)) {
      return NextResponse.json(
        { error: 'animations array required' },
        { status: 400 }
      );
    }

    const preloadResult = await characterTool.preloadAnimations(animations);
    
    return NextResponse.json({
      success: preloadResult.success,
      loaded: preloadResult.loaded,
      failed: preloadResult.failed,
    });
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
