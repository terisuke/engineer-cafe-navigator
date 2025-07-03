#!/usr/bin/env node

/**
 * Test script to check available VRM expressions
 * This script helps identify why "surprised" expression is not available
 */

import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as fs from 'fs';
import * as path from 'path';

async function checkVRMExpressions() {
  console.log('=== VRM Expression Checker ===\n');
  
  const modelPath = path.join(__dirname, '../../public/characters/models/sakura.vrm');
  
  if (!fs.existsSync(modelPath)) {
    console.error(`Error: VRM model not found at ${modelPath}`);
    return;
  }
  
  try {
    // Read the file
    const buffer = fs.readFileSync(modelPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    // Create loader
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    
    // Load VRM
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.parse(
        arrayBuffer,
        '',
        (gltf) => resolve(gltf),
        (error) => reject(error)
      );
    });
    
    const vrm = gltf.userData.vrm as VRM;
    
    if (!vrm) {
      console.error('Failed to load VRM from file');
      return;
    }
    
    console.log('VRM Model loaded successfully!\n');
    
    // Check expression manager
    const expressionManager = vrm.expressionManager;
    if (!expressionManager) {
      console.error('Expression manager not available');
      return;
    }
    
    // Get available expressions
    console.log('Available expressions in the VRM model:');
    console.log('=====================================');
    
    const availableExpressions = Object.keys(expressionManager.expressionMap);
    availableExpressions.forEach((expr, index) => {
      console.log(`${index + 1}. ${expr}`);
    });
    
    console.log('\nTotal expressions found:', availableExpressions.length);
    
    // Check specifically for expected expressions
    console.log('\nChecking for expected expressions:');
    console.log('==================================');
    const expectedExpressions = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'relaxed'];
    
    expectedExpressions.forEach(expr => {
      const exists = availableExpressions.includes(expr);
      console.log(`${expr}: ${exists ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });
    
    // Check for viseme expressions
    console.log('\nChecking for viseme expressions:');
    console.log('================================');
    const visemeExpressions = ['aa', 'ih', 'ou', 'ee', 'oh'];
    
    visemeExpressions.forEach(expr => {
      const exists = availableExpressions.includes(expr);
      console.log(`${expr}: ${exists ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });
    
    // Check for other common VRM expressions
    console.log('\nChecking for other common expressions:');
    console.log('=====================================');
    const otherExpressions = ['blink', 'blinkLeft', 'blinkRight', 'lookUp', 'lookDown', 'lookLeft', 'lookRight'];
    
    otherExpressions.forEach(expr => {
      const exists = availableExpressions.includes(expr);
      console.log(`${expr}: ${exists ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });
    
    // If surprised is not found, suggest alternatives
    if (!availableExpressions.includes('surprised')) {
      console.log('\n⚠️  "surprised" expression not found in VRM model!');
      console.log('\nPossible alternatives:');
      
      // Look for similar expressions
      const surpriseAlternatives = availableExpressions.filter(expr => 
        expr.toLowerCase().includes('surpris') || 
        expr.toLowerCase().includes('shock') ||
        expr.toLowerCase().includes('wow') ||
        expr.toLowerCase().includes('amaz')
      );
      
      if (surpriseAlternatives.length > 0) {
        surpriseAlternatives.forEach(alt => {
          console.log(`- ${alt}`);
        });
      } else {
        console.log('No similar expressions found. The model may not support surprised expression.');
        console.log('\nSuggestions:');
        console.log('1. Use a different expression (e.g., "happy" with wide eyes)');
        console.log('2. Update the VRM model to include "surprised" expression');
        console.log('3. Map "surprised" to an existing expression in the code');
      }
    }
    
  } catch (error) {
    console.error('Error loading VRM model:', error);
  }
}

// Run the check
console.log('Starting VRM expression check...\n');
checkVRMExpressions().catch(console.error);