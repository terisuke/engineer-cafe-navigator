import { NextRequest, NextResponse } from 'next/server';
import { MarpRendererTool } from '@/mastra/tools/marp-renderer';

export async function GET(request: NextRequest) {
  try {
    const marpTool = new MarpRendererTool();
    
    // Test parsing the engineer-cafe slides
    const result = await marpTool.execute({
      slideFile: 'src/slides/engineer-cafe.md',
      theme: 'engineer-cafe',
      outputFormat: 'json',
    });
    
    if (result.success && result.slideData) {
      return NextResponse.json({
        success: true,
        slideCount: result.slideCount,
        slides: result.slideData.slides.map((slide: any) => ({
          number: slide.slideNumber,
          title: slide.title,
          hasNotes: !!slide.notes,
          contentLength: slide.content.length,
        })),
        metadata: result.slideData.metadata,
      });
    }
    
    return NextResponse.json({
      success: false,
      error: result.error,
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}