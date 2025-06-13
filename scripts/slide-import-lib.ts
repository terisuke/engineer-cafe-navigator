import fs from 'fs';
import path from 'path';
import { knowledgeBaseUtils } from '../src/lib/knowledge-base-utils';
import { supabaseAdmin } from '../src/lib/supabase';
import { SupportedLanguage } from '../src/mastra/types/config';

interface NarrationJSON {
  metadata: {
    title: string;
    language: SupportedLanguage;
  };
  slides: Array<{
    slideNumber: number;
    narration: { auto?: string };
  }>;
}

export async function runSlideImport(): Promise<{ added: number; updated: number; duplicates: number; skipped: number }> {
  const narrationDir = path.resolve('src/slides/narration');
  const files = fs.readdirSync(narrationDir).filter((f) => f.endsWith('.json'));

  let added = 0;
  let updated = 0;
  let duplicates = 0;
  let skipped = 0;

  console.log(`🎯 Processing ${files.length} narration files...`);

  for (const file of files) {
    console.log(`📄 Processing file: ${file}`);
    
    const raw = fs.readFileSync(path.join(narrationDir, file), 'utf8');
    const data: NarrationJSON = JSON.parse(raw);
    const { language, title } = data.metadata;
    const subcategory = path.basename(file, '.json');

    for (const slide of data.slides) {
      const content = slide.narration.auto?.trim();
      if (!content) {
        skipped++;
        continue;
      }

      try {
        // Enhanced duplicate check using multiple criteria
        const { data: existing, error } = await supabaseAdmin
          .from('knowledge_base')
          .select('id, content')
          .eq('subcategory', subcategory)
          .eq('language', language)
          .eq('metadata->>slideNumber', slide.slideNumber)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error(`❌ Error checking existing record:`, error);
          continue;
        }

        if (existing) {
          // Check if content has actually changed
          if (existing.content === content) {
            console.log(`⏭️ Skipping unchanged slide ${slide.slideNumber} from ${subcategory}`);
            duplicates++;
            continue;
          }

          // Content has changed, update the record
          const updateResult = await knowledgeBaseUtils.updateEntry(existing.id, {
            content,
            metadata: { 
              title: `${title} - slide ${slide.slideNumber}`, 
              importance: 'critical', 
              slideNumber: slide.slideNumber 
            },
          });

          if (updateResult.success) {
            console.log(`✅ Updated slide ${slide.slideNumber} from ${subcategory}`);
            updated++;
          } else {
            console.error(`❌ Failed to update slide ${slide.slideNumber}:`, updateResult.error);
          }
        } else {
          // No existing record, add new entry
          const addResult = await knowledgeBaseUtils.addEntry({
            content,
            category: 'slides',
            subcategory,
            language,
            source: 'slide-narration',
            metadata: { 
              title: `${title} - slide ${slide.slideNumber}`, 
              importance: 'critical', 
              slideNumber: slide.slideNumber 
            },
          });

          if (addResult.success) {
            if (addResult.isDuplicate) {
              console.log(`⚠️ Duplicate detected for slide ${slide.slideNumber} from ${subcategory}`);
              duplicates++;
            } else {
              console.log(`✅ Added slide ${slide.slideNumber} from ${subcategory}`);
              added++;
            }
          } else {
            console.error(`❌ Failed to add slide ${slide.slideNumber}:`, addResult.error);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing slide ${slide.slideNumber} from ${subcategory}:`, error);
      }
    }
  }

  console.log(`📊 Import completed: ${added} added, ${updated} updated, ${duplicates} duplicates, ${skipped} skipped`);
  return { added, updated, duplicates, skipped };
} 