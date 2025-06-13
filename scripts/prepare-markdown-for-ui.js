#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// マークダウンファイルを管理UIに適した形式に変換
function prepareMarkdownForUI(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: markdownContent } = matter(content);
  
  // 日本語と英語のセクションを分離
  const sections = markdownContent.split(/^## (Japanese|English)$/m);
  
  const prepared = {
    ja: {
      category: frontmatter.category || '',
      subcategory: frontmatter.tags?.[1] || '', // 2番目のタグをサブカテゴリとして使用
      language: 'ja',
      source: frontmatter.source || '',
      metadata: {
        title: frontmatter.title,
        tags: frontmatter.tags,
        importance: frontmatter.importance,
        last_updated: frontmatter.last_updated
      },
      content: ''
    },
    en: {
      category: frontmatter.category || '',
      subcategory: frontmatter.tags?.[1] || '',
      language: 'en',
      source: frontmatter.source || '',
      metadata: {
        title: frontmatter.title,
        tags: frontmatter.tags,
        importance: frontmatter.importance,
        last_updated: frontmatter.last_updated
      },
      content: ''
    }
  };
  
  // セクションを解析
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].includes('Japanese') && sections[i + 1]) {
      prepared.ja.content = sections[i + 1].trim();
    } else if (sections[i].includes('English') && sections[i + 1]) {
      prepared.en.content = sections[i + 1].trim();
    }
  }
  
  return prepared;
}

// 使用例
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node prepare-markdown-for-ui.js <markdown-file>');
  process.exit(1);
}

const prepared = prepareMarkdownForUI(filePath);
console.log('=== Japanese Version ===');
console.log(JSON.stringify(prepared.ja, null, 2));
console.log('\n=== English Version ===');
console.log(JSON.stringify(prepared.en, null, 2));
