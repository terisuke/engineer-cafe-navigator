import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBaseUtils, KnowledgeBaseEntry } from '@/lib/knowledge-base-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await knowledgeBaseUtils.getById(id);

    if (!entry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Failed to get knowledge entry:', error);
    return NextResponse.json(
      { error: 'Failed to get knowledge entry' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates: Partial<KnowledgeBaseEntry> = await request.json();

    const result = await knowledgeBaseUtils.updateEntry(id, updates);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to update entry' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to update knowledge entry:', error);
    return NextResponse.json(
      { error: 'Failed to update knowledge entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await knowledgeBaseUtils.deleteEntry(id);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to delete entry' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to delete knowledge entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge entry' },
      { status: 500 }
    );
  }
}