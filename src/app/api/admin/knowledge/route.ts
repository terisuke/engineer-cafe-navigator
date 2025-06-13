import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBaseUtils, KnowledgeBaseEntry } from '@/lib/knowledge-base-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const language = searchParams.get('language') as any;
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;

    const result = await knowledgeBaseUtils.getAll({
      page,
      limit,
      language,
      category,
      search,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to get knowledge entries:', error);
    return NextResponse.json(
      { error: 'Failed to get knowledge entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: KnowledgeBaseEntry = await request.json();
    const result = await knowledgeBaseUtils.addEntry(entry);

    if (result.success) {
      return NextResponse.json({ id: result.id, success: true });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to create entry' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to create knowledge entry:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}