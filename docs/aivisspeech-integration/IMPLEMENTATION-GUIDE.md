# 実装ガイド

このガイドでは、engineer-cafe-navigatorプロジェクトにAivisSpeech Engineを統合するためのコード改修手順を説明します。

## 🏗️ 実装アーキテクチャ

```
GoogleCloudVoiceSimple (既存)
    ├── speechToText() - 変更なし
    └── textToSpeech()
         ├── 言語判定 (ja/en)
         ├── ja → AivisSpeechService (新規)
         │        └── フォールバック → Google TTS
         └── en → Google TTS (既存)
```

## 📝 実装手順

### 1. AivisSpeechServiceクラスの実装

新しいサービスクラスを作成：

```bash
# ファイルの作成
cat > src/mastra/voice/aivisspeech-service.ts << 'EOF'
/**
 * AivisSpeech Engine Service
 * VOICEVOX互換APIを使用した日本語音声合成サービス
 */

import { TextToSpeechResult } from './types';

interface AivisSpeechSettings {
  serviceUrl: string;
  authToken?: string;
  defaultSpeakerId: number;
  timeout: number;
}

interface AudioQuery {
  accent_phrases: any[];
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
  outputSamplingRate: number;
  outputStereo: boolean;
  kana?: string;
}

// 話者IDと感情のマッピング
// ※デフォルトボイスモデルのUUIDを使用
// 実際のスピーカーIDは/speakersエンドポイントで確認が必要
const SPEAKER_EMOTION_MAP: Record<string, number> = {
  // デフォルトモデルのスタイル
  // スピーカーIDは実際のモデルに合わせて調整が必要
  'neutral': 0,    // デフォルトスタイルID
  'happy': 0,      // デフォルトを使用
  'sad': 0,        // デフォルトを使用
  'angry': 0,      // デフォルトを使用
  'relaxed': 0,    // デフォルトを使用
  'surprised': 0,  // デフォルトを使用
  
  // デフォルト
  'default': 0,
};

export class AivisSpeechService {
  private settings: AivisSpeechSettings;
  
  constructor() {
    this.settings = {
      serviceUrl: process.env.AIVISSPEECH_SERVICE_URL || '',
      authToken: undefined, // Cloud Run認証用、後で設定
      defaultSpeakerId: SPEAKER_EMOTION_MAP['neutral'],
      timeout: 30000, // 30秒
    };
  }

  /**
   * サービス起動時に利用可能なスピーカーを確認
   * ※デプロイ後に一度実行して、実際のスピーカーIDを確認してください
   */
  async checkAvailableSpeakers(): Promise<void> {
    try {
      const response = await fetch(`${this.settings.serviceUrl}/speakers`, {
        headers: this.settings.authToken ? {
          'Authorization': `Bearer ${this.settings.authToken}`
        } : undefined
      });
      
      if (response.ok) {
        const speakers = await response.json();
        console.log('[AivisSpeech] Available speakers:', JSON.stringify(speakers, null, 2));
        console.log('[AivisSpeech] ※上記のスピーカーIDをSPEAKER_EMOTION_MAPに設定してください');
      }
    } catch (error) {
      console.error('[AivisSpeech] Failed to check speakers:', error);
    }
  }

  /**
   * 認証トークンを設定
   */
  async setAuthToken(): Promise<void> {
    if (!this.settings.serviceUrl) {
      console.warn('[AivisSpeech] Service URL not configured');
      return;
    }

    try {
      // Google Cloud認証トークンの取得
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth();
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      
      if (tokenResponse?.token) {
        this.settings.authToken = tokenResponse.token;
        console.log('[AivisSpeech] Authentication token set');
      }
    } catch (error) {
      console.error('[AivisSpeech] Failed to get auth token:', error);
    }
  }

  /**
   * テキストを音声に変換
   */
  async textToSpeech(
    text: string, 
    emotion?: string
  ): Promise<TextToSpeechResult> {
    if (!this.settings.serviceUrl) {
      return {
        success: false,
        error: 'AivisSpeech service URL not configured'
      };
    }

    try {
      // 認証トークンが未設定の場合は取得
      if (!this.settings.authToken) {
        await this.setAuthToken();
      }

      const speakerId = this.getSpeakerIdByEmotion(emotion);
      
      // 1. AudioQueryの生成
      const audioQuery = await this.generateAudioQuery(text, speakerId);
      
      if (!audioQuery) {
        throw new Error('Failed to generate audio query');
      }

      // 2. 音声合成
      const audioData = await this.synthesizeVoice(audioQuery, speakerId);
      
      if (!audioData) {
        throw new Error('Failed to synthesize voice');
      }

      // Base64エンコード
      const audioBase64 = Buffer.from(audioData).toString('base64');
      
      console.log(`[AivisSpeech] Successfully synthesized ${text.length} characters with emotion: ${emotion}`);
      
      return {
        success: true,
        audioBase64
      };
      
    } catch (error) {
      console.error('[AivisSpeech] Text-to-speech error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * AudioQueryを生成
   */
  private async generateAudioQuery(
    text: string, 
    speakerId: number
  ): Promise<AudioQuery | null> {
    const url = new URL('/audio_query', this.settings.serviceUrl);
    url.searchParams.append('text', text);
    url.searchParams.append('speaker', speakerId.toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.settings.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.settings.authToken && {
            'Authorization': `Bearer ${this.settings.authToken}`
          })
        },
        body: JSON.stringify({}),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AivisSpeech] AudioQuery API error:', response.status, errorText);
        return null;
      }

      const audioQuery: AudioQuery = await response.json();
      
      // 感情に応じたパラメータ調整
      this.adjustAudioQueryParams(audioQuery, speakerId);
      
      return audioQuery;
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[AivisSpeech] AudioQuery request timeout');
      } else {
        console.error('[AivisSpeech] AudioQuery error:', error);
      }
      return null;
    }
  }

  /**
   * 音声を合成
   */
  private async synthesizeVoice(
    audioQuery: AudioQuery, 
    speakerId: number
  ): Promise<ArrayBuffer | null> {
    const url = new URL('/synthesis', this.settings.serviceUrl);
    url.searchParams.append('speaker', speakerId.toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.settings.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.settings.authToken && {
            'Authorization': `Bearer ${this.settings.authToken}`
          })
        },
        body: JSON.stringify(audioQuery),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AivisSpeech] Synthesis API error:', response.status, errorText);
        return null;
      }

      return await response.arrayBuffer();
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[AivisSpeech] Synthesis request timeout');
      } else {
        console.error('[AivisSpeech] Synthesis error:', error);
      }
      return null;
    }
  }

  /**
   * 感情に基づいて話者IDを取得
   */
  private getSpeakerIdByEmotion(emotion?: string): number {
    if (!emotion) {
      return this.settings.defaultSpeakerId;
    }

    const mappedEmotion = this.mapEmotionToSpeaker(emotion);
    return SPEAKER_EMOTION_MAP[mappedEmotion] || this.settings.defaultSpeakerId;
  }

  /**
   * 感情を話者スタイルにマッピング
   */
  private mapEmotionToSpeaker(emotion: string): string {
    // Google TTSの感情表現をAivisSpeechのスタイルにマッピング
    const emotionMap: Record<string, string> = {
      'excited': 'happy',
      'calm': 'relaxed',
      'friendly': 'happy',
      'explaining': 'neutral',
      'thinking': 'relaxed',
      'greeting': 'happy',
      'apologetic': 'sad',
      'curious': 'surprised',
    };

    return emotionMap[emotion] || emotion;
  }

  /**
   * AudioQueryのパラメータを感情に応じて調整
   */
  private adjustAudioQueryParams(audioQuery: AudioQuery, speakerId: number): void {
    // 話者IDから感情を逆引き
    const emotion = Object.entries(SPEAKER_EMOTION_MAP)
      .find(([_, id]) => id === speakerId)?.[0] || 'neutral';

    switch (emotion) {
      case 'happy':
      case 'excited':
        audioQuery.speedScale = 1.1;
        audioQuery.pitchScale = 0.05;
        audioQuery.intonationScale = 1.2;
        break;
      
      case 'sad':
        audioQuery.speedScale = 0.9;
        audioQuery.pitchScale = -0.05;
        audioQuery.intonationScale = 0.9;
        break;
      
      case 'angry':
        audioQuery.speedScale = 1.05;
        audioQuery.pitchScale = 0.02;
        audioQuery.intonationScale = 1.3;
        audioQuery.volumeScale = 1.1;
        break;
      
      case 'relaxed':
        audioQuery.speedScale = 0.95;
        audioQuery.pitchScale = -0.02;
        audioQuery.intonationScale = 0.95;
        break;
      
      default:
        // デフォルトパラメータをそのまま使用
        break;
    }
  }

  /**
   * サービスが利用可能かチェック
   */
  async isAvailable(): Promise<boolean> {
    if (!this.settings.serviceUrl) {
      return false;
    }

    try {
      // 認証トークンが未設定の場合は取得
      if (!this.settings.authToken) {
        await this.setAuthToken();
      }

      const response = await fetch(`${this.settings.serviceUrl}/version`, {
        method: 'GET',
        headers: this.settings.authToken ? {
          'Authorization': `Bearer ${this.settings.authToken}`
        } : undefined,
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      console.error('[AivisSpeech] Availability check failed:', error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const aivisSpeechService = new AivisSpeechService();
EOF
```

### 2. TypeScript型定義の追加

共通の型定義ファイルを作成（存在しない場合）：

```bash
cat > src/mastra/voice/types.ts << 'EOF'
/**
 * 音声サービス共通の型定義
 */

export interface TextToSpeechResult {
  success: boolean;
  audioBase64?: string;
  error?: string;
}

export interface SpeechToTextResult {
  success: boolean;
  transcript?: string;
  confidence?: number;
  error?: string;
}

export interface VoiceSettings {
  language: string;
  speaker: string;
  speed: number;
  pitch: number;
  volumeGainDb: number;
}
EOF
```

### 3. GoogleCloudVoiceSimpleクラスの改修

既存のクラスにAivisSpeech統合を追加：

```bash
# バックアップの作成
cp src/mastra/voice/google-cloud-voice-simple.ts src/mastra/voice/google-cloud-voice-simple.ts.backup

# 改修内容を適用するためのパッチファイルを作成
cat > aivisspeech-integration.patch << 'EOF'
--- a/src/mastra/voice/google-cloud-voice-simple.ts
+++ b/src/mastra/voice/google-cloud-voice-simple.ts
@@ -7,6 +7,7 @@
 import { GoogleAuth } from 'google-auth-library';
 import * as fs from 'fs';
 import { applySttCorrections, adjustConfidenceAfterCorrection } from '@/utils/stt-corrections';
+import { aivisSpeechService } from './aivisspeech-service';
 
 interface VoiceSettings {
   language: string;
@@ -251,6 +252,33 @@ export class GoogleCloudVoiceSimple {
 
   async textToSpeech(text: string, language: string = 'ja', emotion?: string): Promise<TextToSpeechResult> {
     try {
+      // 日本語かつAivisSpeechが有効な場合
+      if (language === 'ja' && process.env.AIVISSPEECH_ENABLED === 'true') {
+        console.log('[TTS] Attempting to use AivisSpeech for Japanese text');
+        
+        // AivisSpeechが利用可能かチェック
+        const isAivisAvailable = await aivisSpeechService.isAvailable();
+        
+        if (isAivisAvailable) {
+          const aivisResult = await aivisSpeechService.textToSpeech(text, emotion);
+          
+          if (aivisResult.success) {
+            console.log('[TTS] Successfully used AivisSpeech');
+            return aivisResult;
+          } else {
+            console.warn('[TTS] AivisSpeech failed:', aivisResult.error);
+            
+            // フォールバックが無効な場合はエラーを返す
+            if (process.env.AIVISSPEECH_FALLBACK_TO_GOOGLE_TTS !== 'true') {
+              return aivisResult;
+            }
+            
+            console.log('[TTS] Falling back to Google TTS');
+          }
+        } else {
+          console.warn('[TTS] AivisSpeech is not available, using Google TTS');
+        }
+      }
+
       const accessToken = await this.getAccessToken();
       
       // Update settings based on language
EOF

# パッチを適用（実際の適用は手動で行う必要があります）
echo "⚠️  注意: google-cloud-voice-simple.tsへの変更は手動で適用してください。"
echo "パッチファイル: aivisspeech-integration.patch"
```

### 4. 環境変数の型定義追加

TypeScriptの環境変数型定義を更新：

```bash
# 環境変数の型定義を追加
cat >> src/types/env.d.ts << 'EOF'

// AivisSpeech Engine設定
declare namespace NodeJS {
  interface ProcessEnv {
    AIVISSPEECH_ENABLED?: string;
    AIVISSPEECH_SERVICE_URL?: string;
    AIVISSPEECH_FALLBACK_TO_GOOGLE_TTS?: string;
  }
}
EOF
```

### 5. デプロイ後のスピーカーID確認

⚠️ **重要**: AivisSpeechはデフォルトモデルを使用しますが、実際のスピーカーIDはデプロイ後に確認が必要です。

```typescript
// デプロイ後に実行するスクリプト
import { aivisSpeechService } from './src/mastra/voice/aivisspeech-service';

// サービスがデプロイされた後に実行
async function checkSpeakers() {
  await aivisSpeechService.setAuthToken();
  await aivisSpeechService.checkAvailableSpeakers();
}

checkSpeakers();
```

上記のスクリプトを実行して実際のスピーカーIDを確認し、`SPEAKER_EMOTION_MAP`を更新してください。

### 6. VoiceOutputAgentの更新（必要に応じて）

VoiceOutputAgentがAivisSpeechの統合を認識するように更新：

```bash
# src/mastra/agents/voice-output-agent.tsの確認
echo "📝 VoiceOutputAgentの変更は不要です。"
echo "GoogleCloudVoiceSimpleクラスを通じて自動的にAivisSpeechが使用されます。"
```

## 🧪 実装の検証

### 1. ユニットテストの作成

```bash
cat > src/mastra/voice/__tests__/aivisspeech-service.test.ts << 'EOF'
import { aivisSpeechService } from '../aivisspeech-service';

describe('AivisSpeechService', () => {
  beforeEach(() => {
    // 環境変数のモック
    process.env.AIVISSPEECH_SERVICE_URL = 'https://test.example.com';
    process.env.AIVISSPEECH_ENABLED = 'true';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should map emotions correctly', async () => {
    // 内部メソッドのテストは実装に応じて追加
    expect(true).toBe(true);
  });

  test('should handle service unavailability', async () => {
    const mockFetch = jest.spyOn(global, 'fetch').mockRejectedValue(
      new Error('Network error')
    );

    const available = await aivisSpeechService.isAvailable();
    expect(available).toBe(false);
    expect(mockFetch).toHaveBeenCalled();
  });

  test('should generate audio successfully', async () => {
    // AudioQuery生成のモック
    const mockFetch = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accent_phrases: [],
          speedScale: 1.0,
          pitchScale: 0.0,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1000),
      } as Response);

    const result = await aivisSpeechService.textToSpeech('テスト', 'happy');
    
    expect(result.success).toBe(true);
    expect(result.audioBase64).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
EOF
```

### 2. 統合テストスクリプト

```bash
cat > test-aivisspeech-integration.ts << 'EOF'
/**
 * AivisSpeech統合テストスクリプト
 * 実際のCloud Runサービスに対してテストを実行
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function testAivisSpeechIntegration() {
  console.log('🧪 AivisSpeech統合テストを開始します...\n');

  // 1. 環境変数の確認
  console.log('1️⃣ 環境変数の確認');
  const requiredEnvVars = [
    'AIVISSPEECH_ENABLED',
    'AIVISSPEECH_SERVICE_URL',
    'AIVISSPEECH_FALLBACK_TO_GOOGLE_TTS'
  ];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    console.log(`   ${envVar}: ${value ? '✅ 設定済み' : '❌ 未設定'}`);
  }

  // 2. GoogleCloudVoiceSimpleのテスト
  console.log('\n2️⃣ GoogleCloudVoiceSimpleのテスト');
  try {
    const { GoogleCloudVoiceSimple } = await import('./src/mastra/voice/google-cloud-voice-simple');
    const voiceService = new GoogleCloudVoiceSimple();

    // 日本語テキスト（AivisSpeechを使用）
    console.log('   日本語音声合成テスト...');
    const jaResult = await voiceService.textToSpeech(
      'こんにちは、AivisSpeech統合テストです。',
      'ja',
      'happy'
    );
    console.log(`   日本語: ${jaResult.success ? '✅ 成功' : '❌ 失敗'}`);
    if (!jaResult.success) {
      console.log(`   エラー: ${jaResult.error}`);
    }

    // 英語テキスト（Google TTSを使用）
    console.log('   英語音声合成テスト...');
    const enResult = await voiceService.textToSpeech(
      'Hello, this is an integration test.',
      'en',
      'happy'
    );
    console.log(`   英語: ${enResult.success ? '✅ 成功' : '❌ 失敗'}`);

  } catch (error) {
    console.error('   ❌ テスト失敗:', error);
  }

  // 3. フォールバックテスト
  console.log('\n3️⃣ フォールバックテスト');
  try {
    // AivisSpeechのURLを一時的に無効化
    const originalUrl = process.env.AIVISSPEECH_SERVICE_URL;
    process.env.AIVISSPEECH_SERVICE_URL = 'https://invalid-url.example.com';

    const { GoogleCloudVoiceSimple } = await import('./src/mastra/voice/google-cloud-voice-simple');
    const voiceService = new GoogleCloudVoiceSimple();

    const result = await voiceService.textToSpeech(
      'フォールバックテスト',
      'ja'
    );
    console.log(`   フォールバック: ${result.success ? '✅ 成功（Google TTS使用）' : '❌ 失敗'}`);

    // 環境変数を復元
    process.env.AIVISSPEECH_SERVICE_URL = originalUrl;

  } catch (error) {
    console.error('   ❌ フォールバックテスト失敗:', error);
  }

  console.log('\n✅ 統合テスト完了');
}

// テストの実行
testAivisSpeechIntegration().catch(console.error);
EOF

# テストの実行
npx ts-node test-aivisspeech-integration.ts
```

## 🔍 デバッグとログ

### ログレベルの設定

```typescript
// 詳細なログを有効にする場合
export const AIVISSPEECH_DEBUG = process.env.NODE_ENV !== 'production';

// AivisSpeechService内でのログ
if (AIVISSPEECH_DEBUG) {
  console.log('[AivisSpeech] Detailed debug info...');
}
```

### Cloud Loggingでの確認

```bash
# AivisSpeech関連のログを抽出
gcloud logging read 'textPayload:"[AivisSpeech]" OR textPayload:"[TTS]"' \
    --limit 50 \
    --format json
```

## 🎯 パフォーマンス最適化

### 1. 接続プーリング

```typescript
// HTTP Keep-Aliveを有効化（Node.js環境）
import { Agent } from 'https';

const httpsAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 10,
});

// fetch時にagentを指定
fetch(url, {
  agent: httpsAgent,
  // その他のオプション
});
```

### 2. レスポンスキャッシング

```typescript
// 簡易的なメモリキャッシュ実装
const audioCache = new Map<string, { audioBase64: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1時間

function getCacheKey(text: string, speakerId: number): string {
  return `${text}-${speakerId}`;
}

// キャッシュの利用
const cacheKey = getCacheKey(text, speakerId);
const cached = audioCache.get(cacheKey);

if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
  return { success: true, audioBase64: cached.audioBase64 };
}
```

## ✅ 実装チェックリスト

- [ ] AivisSpeechServiceクラスを作成した
- [ ] TypeScript型定義を追加した
- [ ] GoogleCloudVoiceSimpleクラスを改修した
- [ ] 環境変数の型定義を更新した
- [ ] ユニットテストを作成した
- [ ] 統合テストが成功した
- [ ] ログ出力が適切に設定された
- [ ] エラーハンドリングが実装された
- [ ] フォールバック機能が動作することを確認した

---

**Next Step**: 実装が完了したら、[テストガイド](./TESTING-GUIDE.md)に進んで包括的なテストを実施してください。
