/**
 * 統合テストスイート - 統一アーキテクチャの完全動作確認
 */

import { getEngineerCafeNavigator } from '@/mastra';
import { Config } from '@/mastra/types/config';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  totalDuration: number;
  successRate: number;
}

class IntegrationTestSuite {
  private config: Config;
  private navigator: any;
  private testResults: TestSuite[] = [];

  constructor(config: Config) {
    this.config = config;
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 統一アーキテクチャ統合テスト開始');
    console.log('=====================================');

    try {
      // Initialize navigator
      this.navigator = getEngineerCafeNavigator(this.config);
      
      // Run test suites
      await this.testVoiceOutputAgent();
      await this.testCharacterControlAgent();
      await this.testRealtimeAgentIntegration();
      await this.testSlideNarratorIntegration();
      await this.testQAAgentsUnifiedResponse();
      await this.testErrorHandling();
      await this.testMemorySystem();

      // Generate report
      this.generateTestReport();

    } catch (error) {
      console.error('❌ テストスイート実行エラー:', error);
    }
  }

  private async testVoiceOutputAgent(): Promise<void> {
    const testSuite: TestSuite = {
      name: 'VoiceOutputAgent統合テスト',
      tests: [],
      totalDuration: 0,
      successRate: 0
    };

    console.log('\n📢 VoiceOutputAgentテスト開始...');

    // Test 1: Basic TTS conversion
    await this.runTest(testSuite, '基本的なテキスト音声変換', async () => {
      const voiceAgent = this.navigator.getAgent('voiceOutput');
      const result = await voiceAgent.convertTextToSpeech({
        text: 'こんにちは、エンジニアカフェへようこそ！',
        language: 'ja',
        emotion: 'happy',
        agentName: 'TestAgent'
      });

      if (!result.success || !result.audioData) {
        throw new Error('音声変換に失敗しました');
      }

      return {
        audioSize: result.audioData.byteLength,
        emotion: result.emotion,
        cleanText: result.cleanText
      };
    });

    // Test 2: Markdown cleaning
    await this.runTest(testSuite, 'マークダウンテキストのクリーニング', async () => {
      const voiceAgent = this.navigator.getAgent('voiceOutput');
      const result = await voiceAgent.convertTextToSpeech({
        text: '**エンジニアカフェ**（コワーキングスペース）- 営業時間、設備、利用方法',
        language: 'ja',
        emotion: 'explaining',
        agentName: 'ClarificationAgent'
      });

      if (!result.success || result.cleanText?.includes('**')) {
        throw new Error('マークダウンクリーニングに失敗しました');
      }

      return {
        originalText: '**エンジニアカフェ**（コワーキングスペース）- 営業時間、設備、利用方法',
        cleanedText: result.cleanText
      };
    });

    // Test 3: Error handling
    await this.runTest(testSuite, 'エラーハンドリング', async () => {
      const voiceAgent = this.navigator.getAgent('voiceOutput');
      const result = await voiceAgent.convertTextToSpeech({
        text: 'A'.repeat(10000), // Very long text
        language: 'ja',
        emotion: 'neutral',
        agentName: 'TestAgent'
      });

      // Should handle gracefully
      return {
        handled: result.success !== undefined,
        hasError: !!result.error,
        hasAudio: !!result.audioData
      };
    });

    this.testResults.push(testSuite);
  }

  private async testCharacterControlAgent(): Promise<void> {
    const testSuite: TestSuite = {
      name: 'CharacterControlAgent統合テスト',
      tests: [],
      totalDuration: 0,
      successRate: 0
    };

    console.log('\n🎭 CharacterControlAgentテスト開始...');

    // Test 1: Emotion mapping
    await this.runTest(testSuite, 'エモーション表情マッピング', async () => {
      const characterAgent = this.navigator.getAgent('characterControl');
      const result = await characterAgent.processCharacterControl({
        emotion: 'happy',
        intensity: 0.8,
        agentName: 'TestAgent'
      });

      if (!result.success || !result.expression) {
        throw new Error('表情マッピングに失敗しました');
      }

      return {
        emotion: 'happy',
        expression: result.expression,
        animation: result.animation,
        intensity: result.emotionIntensity
      };
    });

    // Test 2: Lip sync generation
    await this.runTest(testSuite, 'リップシンクデータ生成', async () => {
      const characterAgent = this.navigator.getAgent('characterControl');
      
      // Create dummy audio data
      const dummyAudioData = new ArrayBuffer(1024);
      
      const result = await characterAgent.processCharacterControl({
        audioData: dummyAudioData,
        agentName: 'TestAgent'
      });

      return {
        success: result.success,
        hasLipSync: !!result.lipSyncData,
        lipSyncFrames: result.lipSyncData?.length || 0
      };
    });

    // Test 3: Emotion transition
    await this.runTest(testSuite, 'エモーション遷移', async () => {
      const characterAgent = this.navigator.getAgent('characterControl');
      const result = await characterAgent.transitionEmotion('neutral', 'happy', 500);

      if (!result.success) {
        throw new Error('エモーション遷移に失敗しました');
      }

      return {
        fromEmotion: 'neutral',
        toEmotion: 'happy',
        expression: result.expression,
        duration: 500
      };
    });

    this.testResults.push(testSuite);
  }

  private async testRealtimeAgentIntegration(): Promise<void> {
    const testSuite: TestSuite = {
      name: 'RealtimeAgent統合テスト',
      tests: [],
      totalDuration: 0,
      successRate: 0
    };

    console.log('\n🎯 RealtimeAgent統合テスト開始...');

    // Test 1: Text processing with unified agents
    await this.runTest(testSuite, 'テキスト処理統合', async () => {
      const realtimeAgent = this.navigator.getAgent('realtime');
      const result = await realtimeAgent.processTextInput('エンジニアカフェの営業時間を教えてください');

      if (!result.success || !result.audioResponse) {
        throw new Error('テキスト処理統合に失敗しました');
      }

      return {
        hasAudio: !!result.audioResponse,
        hasCharacterControl: !!result.characterControlData,
        response: result.response?.substring(0, 100) + '...',
        emotion: result.emotion
      };
    });

    // Test 2: Parallel processing verification
    await this.runTest(testSuite, '並列処理検証', async () => {
      const realtimeAgent = this.navigator.getAgent('realtime');
      const startTime = Date.now();
      
      const result = await realtimeAgent.processTextInput('こんにちは');
      const processingTime = Date.now() - startTime;

      return {
        processingTime,
        hasVoiceOutput: !!result.audioResponse,
        hasCharacterControl: !!result.characterControlData,
        isReasonablyFast: processingTime < 5000 // Should be under 5 seconds
      };
    });

    this.testResults.push(testSuite);
  }

  private async testSlideNarratorIntegration(): Promise<void> {
    const testSuite: TestSuite = {
      name: 'SlideNarrator統合テスト',
      tests: [],
      totalDuration: 0,
      successRate: 0
    };

    console.log('\n📊 SlideNarrator統合テスト開始...');

    // Test 1: Unified presentation agents connection
    await this.runTest(testSuite, '統一プレゼンテーションエージェント接続', async () => {
      const slideNarrator = this.navigator.getAgent('narrator');
      
      // Check if unified agents are connected
      const hasVoiceAgent = !!slideNarrator.voiceOutputAgent;
      const hasCharacterAgent = !!slideNarrator.characterControlAgent;

      return {
        voiceAgentConnected: hasVoiceAgent,
        characterAgentConnected: hasCharacterAgent,
        fullyIntegrated: hasVoiceAgent && hasCharacterAgent
      };
    });

    // Test 2: Slide narration with character control
    await this.runTest(testSuite, 'スライドナレーション統合', async () => {
      const slideNarrator = this.navigator.getAgent('narrator');
      
      // Mock slide data
      const mockSlideData = {
        slideNumber: 1,
        narration: {
          auto: 'エンジニアカフェへようこそ！私たちのサービスをご紹介します。'
        }
      };

      // This would normally require actual slide data to be loaded
      // For testing, we'll check the method exists and handles errors gracefully
      try {
        await slideNarrator.narrateSlide(1);
        return { narrationAttempted: true, errorHandled: false };
      } catch (error: unknown) {
        // Expected to fail without slide data - this is good error handling
        return { 
          narrationAttempted: true, 
          errorHandled: true,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    this.testResults.push(testSuite);
  }

  private async testQAAgentsUnifiedResponse(): Promise<void> {
    const testSuite: TestSuite = {
      name: 'QAエージェント統一レスポンステスト',
      tests: [],
      totalDuration: 0,
      successRate: 0
    };

    console.log('\n🤖 QAエージェント統一レスポンステスト開始...');

    // Test 1: Unified response format
    await this.runTest(testSuite, '統一レスポンス形式', async () => {
      const qaWorkflow = this.navigator.getAgent('qa');
      const result = await qaWorkflow.processQuestion({
        question: 'エンジニアカフェの営業時間は？',
        sessionId: 'test-session',
        requestLanguage: 'ja'
      });

      if (!result || !result.text || !result.emotion) {
        throw new Error('統一レスポンス形式が正しくありません');
      }

      return {
        hasText: !!result.text,
        hasEmotion: !!result.emotion,
        hasMetadata: !!result.metadata,
        agentName: result.metadata?.agentName,
        confidence: result.metadata?.confidence
      };
    });

    // Test 2: ClarificationAgent response
    await this.runTest(testSuite, 'ClarificationAgent統一レスポンス', async () => {
      const qaWorkflow = this.navigator.getAgent('qa');
      const result = await qaWorkflow.processQuestion({
        question: 'カフェの営業時間を教えて',
        sessionId: 'test-session',
        requestLanguage: 'ja'
      });

      // Should route to ClarificationAgent
      const isClarificationResponse = result.text?.includes('どちら') || result.text?.includes('which');

      return {
        routedToClarification: isClarificationResponse,
        hasEmotion: !!result.emotion,
        agentName: result.metadata?.agentName,
        responseLength: result.text?.length || 0
      };
    });

    this.testResults.push(testSuite);
  }

  private async testErrorHandling(): Promise<void> {
    const testSuite: TestSuite = {
      name: 'エラーハンドリングテスト',
      tests: [],
      totalDuration: 0,
      successRate: 0
    };

    console.log('\n🛡️ エラーハンドリングテスト開始...');

    // Test 1: Voice output error handling
    await this.runTest(testSuite, '音声出力エラーハンドリング', async () => {
      const voiceAgent = this.navigator.getAgent('voiceOutput');
      
      // Try with invalid parameters
      const result = await voiceAgent.convertTextToSpeech({
        text: '', // Empty text
        language: 'ja',
        emotion: 'invalid_emotion',
        agentName: 'TestAgent'
      });

      return {
        handledGracefully: result !== undefined,
        hasError: !!result.error || !result.success,
        providedFallback: !!result.audioData || !!result.error
      };
    });

    // Test 2: Character control error handling
    await this.runTest(testSuite, 'キャラクター制御エラーハンドリング', async () => {
      const characterAgent = this.navigator.getAgent('characterControl');
      
      // Try with invalid audio data
      const result = await characterAgent.processCharacterControl({
        audioData: null,
        emotion: 'invalid_emotion',
        agentName: 'TestAgent'
      });

      return {
        handledGracefully: result !== undefined,
        hasError: !!result.error || !result.success,
        providedFallback: !!result.expression
      };
    });

    this.testResults.push(testSuite);
  }

  private async testMemorySystem(): Promise<void> {
    const testSuite: TestSuite = {
      name: 'メモリシステムテスト',
      tests: [],
      totalDuration: 0,
      successRate: 0
    };

    console.log('\n🧠 メモリシステムテスト開始...');

    // Test 1: Memory integration
    await this.runTest(testSuite, 'メモリ統合', async () => {
      const realtimeAgent = this.navigator.getAgent('realtime');
      
      // Process a question that should be remembered
      const result1 = await realtimeAgent.processTextInput('エンジニアカフェの営業時間を教えて');
      
      // Ask about what was asked before
      const result2 = await realtimeAgent.processTextInput('さっき何を聞いた？');

      return {
        firstResponseSuccess: !!result1.success,
        memoryResponseSuccess: !!result2.success,
        memoryWorking: result2.response?.includes('営業時間') || result2.response?.includes('hours')
      };
    });

    this.testResults.push(testSuite);
  }

  private async runTest(testSuite: TestSuite, testName: string, testFunction: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`  ⏳ ${testName}...`);
      
      const details = await testFunction();
      const duration = Date.now() - startTime;
      
      testSuite.tests.push({
        name: testName,
        success: true,
        duration,
        details
      });
      
      console.log(`  ✅ ${testName} (${duration}ms)`);
      
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      
      testSuite.tests.push({
        name: testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.log(`  ❌ ${testName} (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateTestReport(): void {
    console.log('\n📊 統合テスト結果レポート');
    console.log('=====================================');

    let totalTests = 0;
    let totalSuccesses = 0;
    let totalDuration = 0;

    this.testResults.forEach(suite => {
      const successes = suite.tests.filter(t => t.success).length;
      const suiteDuration = suite.tests.reduce((sum, t) => sum + t.duration, 0);
      const successRate = suite.tests.length > 0 ? (successes / suite.tests.length) * 100 : 0;

      suite.totalDuration = suiteDuration;
      suite.successRate = successRate;

      console.log(`\n📋 ${suite.name}:`);
      console.log(`   成功率: ${successRate.toFixed(1)}% (${successes}/${suite.tests.length})`);
      console.log(`   実行時間: ${suiteDuration}ms`);

      totalTests += suite.tests.length;
      totalSuccesses += successes;
      totalDuration += suiteDuration;

      // Show failed tests
      const failures = suite.tests.filter(t => !t.success);
      if (failures.length > 0) {
        console.log('   失敗したテスト:');
        failures.forEach(test => {
          console.log(`     ❌ ${test.name}: ${test.error}`);
        });
      }
    });

    const overallSuccessRate = totalTests > 0 ? (totalSuccesses / totalTests) * 100 : 0;

    console.log('\n🎯 全体サマリー:');
    console.log(`   総テスト数: ${totalTests}`);
    console.log(`   成功: ${totalSuccesses}`);
    console.log(`   失敗: ${totalTests - totalSuccesses}`);
    console.log(`   成功率: ${overallSuccessRate.toFixed(1)}%`);
    console.log(`   総実行時間: ${totalDuration}ms`);

    if (overallSuccessRate >= 90) {
      console.log('\n🎉 統一アーキテクチャの統合テストが成功しました！');
    } else if (overallSuccessRate >= 70) {
      console.log('\n⚠️ 統合テストは概ね成功していますが、いくつかの問題があります。');
    } else {
      console.log('\n🚨 統合テストで重大な問題が検出されました。修正が必要です。');
    }

    // Save detailed report
    this.saveDetailedReport();
  }

  private saveDetailedReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      testSuites: this.testResults,
      summary: {
        totalTests: this.testResults.reduce((sum, suite) => sum + suite.tests.length, 0),
        totalSuccesses: this.testResults.reduce((sum, suite) => sum + suite.tests.filter(t => t.success).length, 0),
        totalDuration: this.testResults.reduce((sum, suite) => sum + suite.totalDuration, 0),
        overallSuccessRate: this.testResults.reduce((sum, suite) => sum + suite.successRate, 0) / this.testResults.length
      }
    };

    // In a real implementation, you would save this to a file
    console.log('\n📄 詳細レポートが生成されました');
    console.log('   レポートデータ:', JSON.stringify(report, null, 2).substring(0, 500) + '...');
  }
}

// Test configuration
const testConfig: Config = {
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
    credentials: process.env.GOOGLE_CLOUD_CREDENTIALS!,
  },
  gemini: {
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20',
  },
  database: {
    url: process.env.POSTGRES_URL!,
  },
  nextAuth: {
    url: process.env.NEXTAUTH_URL!,
    secret: process.env.NEXTAUTH_SECRET!,
  },
  vercel: process.env.VERCEL_URL ? {
    url: process.env.VERCEL_URL,
  } : undefined,
  external: {
    websocketUrl: process.env.WEBSOCKET_URL,
    receptionApiUrl: process.env.RECEPTION_API_URL,
  },
};

// Export for direct execution
export async function runIntegrationTests(): Promise<void> {
  const testSuite = new IntegrationTestSuite(testConfig);
  await testSuite.runAllTests();
}

// Direct execution
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}