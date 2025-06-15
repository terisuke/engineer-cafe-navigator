import { NextResponse } from 'next/server';

// Metadata templates based on actual data analysis
const metadataTemplates = {
  '設備': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'Facilities': {
    title: '',
    importance: 'high', 
    tags: [],
    last_updated: new Date().toISOString(),
  },
  '基本情報': {
    title: '',
    importance: 'critical',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'General': {
    title: '',
    importance: 'critical',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  '料金': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'Pricing': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'イベント': {
    title: '',
    importance: 'medium',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'Events': {
    title: '',
    importance: 'medium',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'アクセス': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'Access': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'slides': {
    title: '',
    importance: 'critical',
    slideNumber: 1,
  },
  'engineer-cafe': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: new Date().toISOString(),
    category: 'engineer-cafe',
    source: 'engineercafe-structured-data',
  },
  'meeting-rooms': {
    title: '',
    importance: 'high',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'saino-cafe': {
    title: '',
    importance: 'medium',
    tags: [],
    last_updated: new Date().toISOString(),
  },
  'default': {
    title: '',
    importance: 'medium',
    tags: [],
    last_updated: new Date().toISOString(),
  }
};

export async function GET() {
  try {
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