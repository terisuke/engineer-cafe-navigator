import { NextResponse } from 'next/server';

// Build metadata templates with current timestamp
function buildMetadataTemplates() {
  const now = new Date().toISOString();
  
  return {
  '設備': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: now,
  },
  'Facilities': {
    title: '',
    importance: 'high', 
    tags: [],
    last_updated: now,
  },
  '基本情報': {
    title: '',
    importance: 'critical',
    tags: [],
    last_updated: now,
  },
  'General': {
    title: '',
    importance: 'critical',
    tags: [],
    last_updated: now,
  },
  '料金': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: now,
  },
  'Pricing': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: now,
  },
  'イベント': {
    title: '',
    importance: 'medium',
    tags: [],
    last_updated: now,
  },
  'Events': {
    title: '',
    importance: 'medium',
    tags: [],
    last_updated: now,
  },
  'アクセス': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: now,
  },
  'Access': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: now,
  },
  'slides': {
    title: '',
    importance: 'critical',
    slideNumber: 1,
    last_updated: now,
  },
  'engineer-cafe': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: now,
    category: 'engineer-cafe',
    source: 'engineercafe-structured-data',
  },
  'meeting-rooms': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: now,
  },
  'saino-cafe': {
    title: '',
    importance: 'medium',
    tags: [],
    last_updated: now,
  },
  'default': {
    title: '',
    importance: 'medium',
    tags: [],
    last_updated: now,
  }
  };
}

export async function GET() {
  try {
    const metadataTemplates = buildMetadataTemplates();
    
    return NextResponse.json({
      templates: metadataTemplates,
      availableCategories: Object.keys(metadataTemplates).filter(k => k !== 'default'),
    });
  } catch (error) {
    console.error('Failed to get metadata templates:', error);
    return NextResponse.json(
      { error: 'Failed to get metadata templates' },
      { status: 500 }
    );
  }
}