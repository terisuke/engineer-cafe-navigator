import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Get distinct categories
    const { data: categories, error: catError } = await supabaseAdmin
      .from('knowledge_base')
      .select('category')
      .not('category', 'is', null)
      .order('category', { ascending: true });

    if (catError) throw catError;

    // Get distinct subcategories with their categories
    const { data: subcategories, error: subError } = await supabaseAdmin
      .from('knowledge_base')
      .select('category, subcategory')
      .not('subcategory', 'is', null)
      .order('category', { ascending: true })
      .order('subcategory', { ascending: true });

    if (subError) throw subError;

    // Get distinct sources
    const { data: sources, error: srcError } = await supabaseAdmin
      .from('knowledge_base')
      .select('source')
      .not('source', 'is', null)
      .order('source', { ascending: true });

    if (srcError) throw srcError;

    // Process the data
    const uniqueCategories = Array.from(new Set((categories ?? []).map(c => c.category).filter(Boolean)));
    const uniqueSources = Array.from(new Set((sources ?? []).map(s => s.source).filter(Boolean)));
    
    // Group subcategories by category
    const subcategoryGroups = (subcategories ?? []).reduce((acc, item) => {
      if (!item.category || !item.subcategory) return acc;
      
      if (!acc[item.category]) {
        acc[item.category] = new Set();
      }
      acc[item.category].add(item.subcategory);
      return acc;
    }, {} as Record<string, Set<string>>) || {};

    // Convert Sets to Arrays
    const subcategoryMap = Object.fromEntries(
      Object.entries(subcategoryGroups).map(([cat, subs]) => [cat, Array.from(subs)])
    );

    // Get languages
    const { data: languages, error: langError } = await supabaseAdmin
      .from('knowledge_base')
      .select('language')
      .not('language', 'is', null);

    if (langError) throw langError;

    const uniqueLanguages = Array.from(new Set(languages?.map(l => l.language).filter(Boolean)));

    return NextResponse.json({
      categories: uniqueCategories,
      subcategories: subcategoryMap,
      sources: uniqueSources,
      languages: uniqueLanguages,
      stats: {
        totalCategories: uniqueCategories.length,
        totalSubcategories: Object.values(subcategoryMap).reduce((sum, subs) => sum + subs.length, 0),
        totalSources: uniqueSources.length,
        totalLanguages: uniqueLanguages.length,
      }
    });
  } catch (error) {
    console.error('Failed to get categories:', error);
    return NextResponse.json(
      { error: 'Failed to get categories' },
      { status: 500 }
    );
  }
}