#!/usr/bin/env tsx

/**
 * Test script for STT corrections
 * Run with: pnpm tsx scripts/test-stt-corrections.ts
 */

import { applySttCorrections, CORRECTION_RULES, likelyContainsMisrecognition } from '../src/utils/stt-corrections';

// Test cases
const testCases = [
  // Japanese corrections
  { input: 'エンジニア壁の営業時間は何時ですか？', expected: 'エンジニアカフェの営業時間は何時ですか？' },
  { input: '壁の料金を教えてください', expected: 'カフェの料金を教えてください' },
  { input: 'エンジニア壁はどこにありますか？', expected: 'エンジニアカフェはどこにありますか？' },
  { input: '壁で作業できますか？', expected: 'カフェで作業できますか？' },
  { input: '壁に行きたいです', expected: 'カフェに行きたいです' },
  
  // English corrections
  { input: 'What time does engineer confess open?', expected: 'What time does Engineer Cafe open?' },
  { input: 'I want to visit engineer conference', expected: 'I want to visit Engineer Cafe' },
  { input: 'engineer campus is great', expected: 'Engineer Cafe is great' },
  
  // Should NOT be corrected (no context match)
  { input: '壁を塗装する', expected: '壁を塗装する' }, // Painting a wall
  { input: '部屋の壁', expected: '部屋の壁' }, // Room wall
  
  // Mixed context
  { input: 'エンジニア壁の会議室の壁', expected: 'エンジニアカフェの会議室の壁' },
];

console.log('Testing STT Corrections\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = applySttCorrections(testCase.input);
  const isCorrect = result === testCase.expected;
  
  if (isCorrect) {
    passed++;
    console.log(`✅ PASS`);
  } else {
    failed++;
    console.log(`❌ FAIL`);
  }
  
  console.log(`   Input:    "${testCase.input}"`);
  console.log(`   Expected: "${testCase.expected}"`);
  console.log(`   Got:      "${result}"`);
  
  if (likelyContainsMisrecognition(testCase.input)) {
    console.log(`   ⚠️  Likely contains misrecognition`);
  }
  
  console.log('');
}

console.log('='.repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

// Display correction rules
console.log('Active Correction Rules:');
console.log('-'.repeat(80));
for (const rule of CORRECTION_RULES) {
  console.log(`• ${rule.description}`);
  console.log(`  Pattern: ${rule.pattern}`);
  console.log(`  Replace: "${rule.replacement}"`);
  if (rule.context) {
    console.log(`  Context: ${rule.context}`);
  }
  console.log('');
}

process.exit(failed > 0 ? 1 : 0);