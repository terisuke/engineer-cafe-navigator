import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBaseUpdater } from '@/jobs/update-knowledge-base';
import { ragMetrics } from '@/lib/monitoring/rag-metrics';

/**
 * CRON endpoint for automated knowledge base updates
 * This endpoint is called by Vercel CRON or external schedulers
 */
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel CRON
  const authHeader = request.headers.get('authorization');
  
  if (process.env.NODE_ENV === 'production') {
    // In production, verify the CRON secret
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }
  
  const startTime = Date.now();
  
  try {
    console.log('[CRON] Starting knowledge base update...');
    
    // Check if required services are configured
    const hasGoogleCalendar = process.env.GOOGLE_CALENDAR_CLIENT_ID && 
                             process.env.GOOGLE_CALENDAR_CLIENT_SECRET && 
                             process.env.GOOGLE_CALENDAR_REDIRECT_URI;
    
    if (!hasGoogleCalendar) {
      console.warn('[CRON] Google Calendar OAuth2 not configured, some features will be limited');
    }
    
    // Run the update
    await knowledgeBaseUpdater.runUpdate();
    
    const duration = Date.now() - startTime;
    
    // Track metrics
    await ragMetrics.trackKnowledgeBaseOperation({
      operation: 'batch_import',
      category: 'automated_update',
      count: 1,
      duration,
      success: true,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Knowledge base update completed',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[CRON] Knowledge base update failed:', error);
    
    // Track error metrics
    await ragMetrics.trackKnowledgeBaseOperation({
      operation: 'batch_import',
      category: 'automated_update',
      count: 0,
      duration,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      {
        error: 'Knowledge base update failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Manual trigger endpoint (for testing)
 */
export async function POST(request: NextRequest) {
  // This endpoint can be used to manually trigger updates during development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Manual triggers not allowed in production' },
      { status: 403 }
    );
  }
  
  return GET(request);
}