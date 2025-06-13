import { NextRequest, NextResponse } from 'next/server';
import { runSlideImport } from '../../../../../scripts/slide-import-lib';

export const dynamic = 'force-dynamic'; // Always run on server

export async function GET(_req: NextRequest) {
  try {
    const result = await runSlideImport();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[update-slides] failed', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
