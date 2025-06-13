#!/usr/bin/env tsx

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface MarkdownFile {
  filePath: string;
  content: string;
  frontmatter: any;
  category: string;
  subcategory: string;
}

function parseFrontmatter(content: string): { frontmatter: any; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = match[1];
  const body = match[2];
  
  const frontmatter: any = {};
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/"/g, ''));
      }
      
      frontmatter[key] = value;
    }
  });

  return { frontmatter, body };
}

function getAllMarkdownFiles(dir: string): MarkdownFile[] {
  const files: MarkdownFile[] = [];
  
  function walkDir(currentDir: string, relativePath: string = '') {
    const items = readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDir(fullPath, join(relativePath, item));
      } else if (item.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(content);
        
        const pathParts = relativePath.split('/').filter(p => p);
        const category = pathParts[0] || 'general';
        const subcategory = item.replace('.md', '');
        
        files.push({
          filePath: fullPath,
          content: body.trim(),
          frontmatter,
          category,
          subcategory,
        });
      }
    }
  }
  
  walkDir(dir);
  return files;
}

async function addToKnowledgeBaseViaAPI(entry: any) {
  const response = await fetch('http://localhost:3001/api/admin/knowledge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return await response.json();
}

async function importMarkdownViaAPI() {
  const markdownDir = join(process.cwd(), 'data/knowledge-base/markdown');
  
  console.log('🔍 Scanning markdown files...');
  const markdownFiles = getAllMarkdownFiles(markdownDir);
  console.log(`📁 Found ${markdownFiles.length} markdown files`);

  let successful = 0;
  let failed = 0;

  for (const file of markdownFiles) {
    try {
      console.log(`📝 Importing: ${file.category}/${file.subcategory}`);
      
      const language = file.frontmatter.language || 'ja';
      
      const entry = {
        content: file.content,
        category: file.category,
        subcategory: file.subcategory,
        language: language as 'ja' | 'en',
        source: file.frontmatter.source || 'markdown-import',
        metadata: {
          title: file.frontmatter.title,
          tags: file.frontmatter.tags || [],
          importance: file.frontmatter.importance || 'medium',
          last_updated: file.frontmatter.last_updated || new Date().toISOString().split('T')[0],
          original_file: file.filePath,
        },
      };

      const result = await addToKnowledgeBaseViaAPI(entry);
      
      if (result.success) {
        console.log(`✅ Successfully imported: ${file.category}/${file.subcategory} (ID: ${result.id})`);
        successful++;
      } else {
        console.error(`❌ Failed to import ${file.category}/${file.subcategory}: ${result.error}`);
        failed++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file.filePath}:`, error);
      failed++;
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Total: ${markdownFiles.length}`);

  if (successful > 0) {
    console.log('\n🎉 Knowledge base import completed!');
    console.log('You can now test the RAG system at http://localhost:3001/admin/knowledge');
  }
}

if (require.main === module) {
  importMarkdownViaAPI()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Import failed:', error);
      process.exit(1);
    });
}