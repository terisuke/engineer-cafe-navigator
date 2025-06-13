import { knowledgeBaseUtils } from '@/lib/knowledge-base-utils';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await knowledgeBaseUtils.getStats();
    const healthy = stats.total > 0;

    return NextResponse.json({
      healthy,
      stats,
      recommendation: healthy ? 'OK' : 'Knowledge base is empty. Please seed data.'
    });
  } catch (error) {
    console.error('[HealthCheck] Failed to get knowledge stats:', error);
    return NextResponse.json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 