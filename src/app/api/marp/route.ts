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
    const marpTool = navigator.getTool('marpRenderer');
    
    if (!marpTool) {
      return NextResponse.json(
        { error: 'Marp renderer not available' },
        { status: 500 }
      );
    }

    const { action, slideFile, theme, outputFormat, slideNumber } = await request.json();

    switch (action) {
      case 'render':
        if (!slideFile) {
          return NextResponse.json(
            { error: 'Slide file required' },
            { status: 400 }
          );
        }

        const renderResult = await marpTool.execute({
          slideFile: `src/slides/${slideFile}.md`,
          theme,
          outputFormat: outputFormat || 'html',
        });
        
        console.log(`Rendered ${slideFile} with ${renderResult.slideCount} slides`);
        
        return NextResponse.json({
          success: renderResult.success,
          html: renderResult.html,
          slideData: renderResult.slideData,
          slideCount: renderResult.slideCount,
          error: renderResult.error,
        });

      case 'preview':
        if (!slideFile || slideNumber === undefined) {
          return NextResponse.json(
            { error: 'Slide file and slide number required' },
            { status: 400 }
          );
        }

        const previewResult = await marpTool.renderSlidePreview(
          `src/slides/${slideFile}.md`,
          slideNumber
        );
        
        return NextResponse.json({
          success: previewResult.success,
          preview: previewResult.preview,
          error: previewResult.error,
        });

      case 'get_slide_list':
        if (!slideFile) {
          return NextResponse.json(
            { error: 'Slide file required' },
            { status: 400 }
          );
        }

        const listResult = await marpTool.getSlideList(`src/slides/${slideFile}.md`);
        
        return NextResponse.json({
          success: listResult.success,
          slides: listResult.slides,
          error: listResult.error,
        });

      case 'render_with_narration':
        if (!slideFile) {
          return NextResponse.json(
            { error: 'Slide file required' },
            { status: 400 }
          );
        }

        // Render slides
        const slidesResult = await marpTool.execute({
          slideFile: `src/slides/${slideFile}.md`,
          theme,
          outputFormat: 'both',
        });

        if (!slidesResult.success) {
          return NextResponse.json({
            success: false,
            error: slidesResult.error,
          });
        }
        
        console.log(`Rendered ${slideFile} with narration: ${slidesResult.slideCount} slides`);

        // Load narration data
        const narrationTool = navigator.getTool('narrationLoader');
        let narrationData = null;
        
        if (narrationTool) {
          const language = 'ja'; // Default to Japanese, could be parameterized
          const narrationResult = await narrationTool.execute({
            slideFile,
            language,
            action: 'load',
          });
          
          if (narrationResult.success) {
            narrationData = narrationResult.narrationData;
          }
        }

        return NextResponse.json({
          success: true,
          html: slidesResult.html,
          slideData: slidesResult.slideData,
          narrationData,
          slideCount: slidesResult.slideCount,
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Marp API error:', error);
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
    const slideFile = searchParams.get('slideFile');
    const slideNumber = searchParams.get('slideNumber');

    const navigator = getEngineerCafeNavigator(config);
    const marpTool = navigator.getTool('marpRenderer');

    if (!marpTool) {
      return NextResponse.json(
        { error: 'Marp renderer not available' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'render':
        if (!slideFile) {
          return NextResponse.json(
            { error: 'slideFile parameter required' },
            { status: 400 }
          );
        }

        const theme = searchParams.get('theme') || undefined;
        const outputFormat = searchParams.get('outputFormat') || 'html';

        const renderResult = await marpTool.execute({
          slideFile: `src/slides/${slideFile}.md`,
          theme,
          outputFormat: outputFormat as 'html' | 'json' | 'both',
        });
        
        // If HTML output, return as HTML response
        if (outputFormat === 'html' && renderResult.success && renderResult.html) {
          return new NextResponse(renderResult.html, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
        
        return NextResponse.json({
          success: renderResult.success,
          html: renderResult.html,
          slideData: renderResult.slideData,
          slideCount: renderResult.slideCount,
          error: renderResult.error,
        });

      case 'preview':
        if (!slideFile || !slideNumber) {
          return NextResponse.json(
            { error: 'slideFile and slideNumber parameters required' },
            { status: 400 }
          );
        }

        const previewResult = await marpTool.renderSlidePreview(
          `src/slides/${slideFile}.md`,
          parseInt(slideNumber)
        );
        
        return NextResponse.json({
          success: previewResult.success,
          preview: previewResult.preview,
          error: previewResult.error,
        });

      case 'list':
        if (!slideFile) {
          return NextResponse.json(
            { error: 'slideFile parameter required' },
            { status: 400 }
          );
        }

        const listResult = await marpTool.getSlideList(`src/slides/${slideFile}.md`);
        
        return NextResponse.json({
          success: listResult.success,
          slides: listResult.slides,
          error: listResult.error,
        });

      case 'available_themes':
        // List available themes
        try {
          const fs = require('fs').promises;
          const path = require('path');
          
          const themesDir = path.resolve('src/slides/themes');
          const themeFiles = await fs.readdir(themesDir);
          const themes = themeFiles
            .filter((file: string) => file.endsWith('.css'))
            .map((file: string) => file.replace('.css', ''));

          return NextResponse.json({
            success: true,
            themes,
          });
        } catch (error) {
          return NextResponse.json({
            success: true,
            themes: ['default', 'engineer-cafe'],
          });
        }

      case 'available_slides':
        // List available slide files
        try {
          const fs = require('fs').promises;
          const path = require('path');
          
          const slidesDir = path.resolve('src/slides');
          const slideFiles = await fs.readdir(slidesDir);
          const slides = slideFiles
            .filter((file: string) => file.endsWith('.md'))
            .map((file: string) => file.replace('.md', ''));

          return NextResponse.json({
            success: true,
            slides,
          });
        } catch (error) {
          return NextResponse.json({
            success: true,
            slides: ['engineer-cafe'],
          });
        }

      case 'health':
        return NextResponse.json({
          success: true,
          status: 'healthy',
          marpVersion: require('@marp-team/marp-core/package.json').version,
        });

      default:
        return NextResponse.json(
          { error: 'Action parameter required' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Marp API GET error:', error);
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
