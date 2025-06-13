#!/usr/bin/env tsx

/**
 * Import all markdown files under data/knowledge-base/markdown into Supabase knowledge_base table.
 * - Front-matter metadata is preserved.
 * - Supports bilingual markdown that separates sections with `## Japanese` / `## English` headings.
 * - Automatically skips duplicates using knowledgeBaseUtils.checkDuplicate().
 */

import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import { KnowledgeBaseEntry, knowledgeBaseUtils } from '../src/lib/knowledge-base-utils';

async function importMarkdownKnowledge() {
  const baseDir = path.join(process.cwd(), 'data/knowledge-base/markdown');
  const files = fs.readdirSync(baseDir, { recursive: true })
    .filter(f => f.endsWith('.md')) as string[];

  console.log(`📄 Found ${files.length} markdown files`);

  const entries: KnowledgeBaseEntry[] = [];

  for (const relativeFile of files) {
    const filePath = path.join(baseDir, relativeFile);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: front, content } = matter(raw);

    const category: string | undefined = front.category ?? path.dirname(relativeFile).split(path.sep)[0];
    const subcategory: string | undefined = front.subcategory ?? path.basename(relativeFile, '.md');
    const source: string | undefined = front.source ?? 'markdown-import';

    // Split bilingual sections
    const parts = content.split(/^## +(Japanese|English)/m);
    if (parts.length > 1) {
      // parts looks like ["", "Japanese", jpText, "English", enText]
      for (let i = 1; i < parts.length; i += 2) {
        const langLabel = parts[i].trim();
        const body = parts[i + 1]?.trim();
        if (!body) continue;
        const language = langLabel.toLowerCase().startsWith('j') ? 'ja' : 'en';
        entries.push({
          content: body,
          category,
          subcategory,
          language: language as any,
          source,
          metadata: { ...front, title: front.title, importance: front.importance ?? 'medium' },
        });
      }
    } else {
      // No language split -> assume Japanese unless front.language specified
      const language = (front.language ?? 'ja') as 'ja' | 'en';
      entries.push({
        content: content.trim(),
        category,
        subcategory,
        language,
        source,
        metadata: { ...front, title: front.title, importance: front.importance ?? 'medium' },
      });
    }
  }

  console.log(`📝 Prepared ${entries.length} entries for import`);

  const result = await knowledgeBaseUtils.addEntries(entries);
  console.log(`✅ Added: ${result.successful}, ⚠️ duplicates: ${result.duplicates}, ❌ failed: ${result.failed}`);
  if (result.errors.length) {
    console.error(result.errors);
  }

  const stats = await knowledgeBaseUtils.getStats();
  console.log('📊 Current stats:', stats);
}

if (require.main === module) {
  importMarkdownKnowledge().catch(err => {
    console.error('Import failed', err);
    process.exit(1);
  });
}