#!/usr/bin/env tsx

/*
 * Import all narration JSON files under src/slides/narration into the Supabase
 * knowledge_base table.  Each slide narration (auto field) becomes 1 KB entry.
 * Importance is set to "critical" so that RAG search prioritises these facts.
 *
 * Usage:
 *   pnpm tsx scripts/import-slide-narrations.ts
 */

import chokidar from 'chokidar';
import { runSlideImport } from './slide-import-lib';

async function runOnce() {
  console.log('🚀 Starting slide narration import...');
  const result = await runSlideImport();
  console.log(`📊 Import completed: ${result.added} added, ${result.updated} updated, ${result.duplicates} duplicates, ${result.skipped} skipped`);
}

if (process.argv.includes('--watch')) {
  console.log('🔄 Watching narration directory for changes...');
  chokidar.watch('src/slides/narration').on('all', async () => {
    await runOnce();
  });
} else {
  runOnce().catch((e)=>{console.error(e);process.exit(1);});
} 