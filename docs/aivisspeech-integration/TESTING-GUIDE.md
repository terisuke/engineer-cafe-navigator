# テストガイド

このガイドでは、AivisSpeech Engine統合の包括的なテスト方法について説明します。

## 🧪 テスト戦略

### テストレベル

1. **単体テスト**: 個別コンポーネントの動作確認
2. **統合テスト**: システム間の連携確認
3. **E2Eテスト**: 実際のユーザーシナリオでの動作確認
4. **パフォーマンステスト**: レスポンス時間とスループットの測定
5. **フェイルオーバーテスト**: 障害時のフォールバック動作確認

## 📝 単体テスト

### 1. AivisSpeechServiceのテスト

```bash
# テストファイルの実行
npm test src/mastra/voice/__tests__/aivisspeech-service.test.ts

# カバレッジレポートの生成
npm test -- --coverage src/mastra/voice/aivisspeech-service.ts
```

### 2. モックを使用したテスト例

```typescript
// src/mastra/voice/__tests__/aivisspeech-service-mock.test.ts
import { aivisSpeechService } from '../aivisspeech-service';

describe('AivisSpeechService with Mocks', () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
    process.env.AIVISSPEECH_SERVICE_URL = 'https://mock.example.com';
  });

  test('should handle 500 error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    });

    const result = await aivisSpeechService.textToSpeech('テスト');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to generate audio query');
  });

  test('should handle network timeout', async () => {
    mockFetch.mockImplementationOnce(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 100)
      )
    );

    const result = await aivisSpeechService.textToSpeech('タイムアウトテスト');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network timeout');
  });

  test('should apply emotion-specific parameters', async () => {
    // AudioQuery生成の成功レスポンス
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accent_phrases: [],
          speedScale: 1.0,
          pitchScale: 0.0,
          intonationScale: 1.0,
          volumeScale: 1.0,
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1000)
      });

    await aivisSpeechService.textToSpeech('感情テスト', 'happy');

    // 2回目の呼び出し（synthesis）で送信されたデータを確認
    const synthesisCall = mockFetch.mock.calls[1];
    const bodyData = JSON.parse(synthesisCall[1].body);
    
    expect(bodyData.speedScale).toBe(1.1);
    expect(bodyData.intonationScale).toBe(1.2);
  });
});
```

## 🔄 統合テスト

### 1. 実際のCloud Runサービスとの統合テスト

```bash
# 統合テストスクリプトの作成
cat > scripts/test-aivisspeech-integration.sh << 'EOF'
#!/bin/bash

echo "🧪 AivisSpeech統合テストスイート"
echo "================================="

# 環境変数の読み込み
source .env.local

# カラー出力の設定
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# テスト結果の集計
TESTS_PASSED=0
TESTS_FAILED=0

# テスト関数
run_test() {
    local test_name="$1"
    local command="$2"
    
    echo -n "🔍 ${test_name}... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAILED${NC}"
        ((TESTS_FAILED++))
    fi
}

# 1. サービスの可用性テスト
echo -e "\n${YELLOW}1. サービス可用性テスト${NC}"
run_test "AivisSpeech Engine接続" "curl -s -f -H 'Authorization: Bearer $(gcloud auth print-identity-token)' ${AIVISSPEECH_SERVICE_URL}/version"

# 2. 音声合成APIテスト
echo -e "\n${YELLOW}2. 音声合成APIテスト${NC}"

# テスト用テキストと話者ID
TEST_TEXT="統合テストです"
# デフォルトモデルのスピーカーIDを使用（実際のIDは/speakersエンドポイントで確認）
SPEAKER_ID="0"
TOKEN=$(gcloud auth print-identity-token)

# AudioQuery生成テスト
run_test "AudioQuery生成" "curl -s -f -X POST -H 'Authorization: Bearer ${TOKEN}' -H 'Content-Type: application/json' '${AIVISSPEECH_SERVICE_URL}/audio_query?text=${TEST_TEXT}&speaker=${SPEAKER_ID}' -d '{}'"

# 3. 言語別テスト
echo -e "\n${YELLOW}3. 言語別音声合成テスト${NC}"

# Node.jsスクリプトで実際の統合をテスト
cat > test-language-integration.js << 'SCRIPT'
const https = require('https');
const { GoogleCloudVoiceSimple } = require('./dist/mastra/voice/google-cloud-voice-simple');

async function testLanguageIntegration() {
    const voiceService = new GoogleCloudVoiceSimple();
    
    // 日本語テスト（AivisSpeech使用）
    const jaResult = await voiceService.textToSpeech('日本語のテストです', 'ja', 'happy');
    if (!jaResult.success) throw new Error('Japanese TTS failed');
    
    // 英語テスト（Google TTS使用）
    const enResult = await voiceService.textToSpeech('English test', 'en', 'happy');
    if (!enResult.success) throw new Error('English TTS failed');
    
    return true;
}

testLanguageIntegration()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
SCRIPT

run_test "日本語音声合成（AivisSpeech）" "node test-language-integration.js"

# 4. フォールバックテスト
echo -e "\n${YELLOW}4. フォールバックテスト${NC}"

# AivisSpeechを一時的に無効化してテスト
export AIVISSPEECH_SERVICE_URL="https://invalid-url"
run_test "フォールバック動作" "node -e \"
const { GoogleCloudVoiceSimple } = require('./dist/mastra/voice/google-cloud-voice-simple');
const vs = new GoogleCloudVoiceSimple();
vs.textToSpeech('フォールバック', 'ja').then(r => process.exit(r.success ? 0 : 1));
\""

# 環境変数を復元
source .env.local

# 5. パフォーマンステスト
echo -e "\n${YELLOW}5. パフォーマンステスト${NC}"

# レスポンス時間測定
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${AIVISSPEECH_SERVICE_URL}/audio_query?text=test&speaker=${SPEAKER_ID}" \
    -d '{}')

echo "   AudioQuery生成時間: ${RESPONSE_TIME}秒"

if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    echo -e "   ${GREEN}✅ パフォーマンス基準を満たしています${NC}"
    ((TESTS_PASSED++))
else
    echo -e "   ${RED}❌ レスポンスが遅い（2秒以上）${NC}"
    ((TESTS_FAILED++))
fi

# テスト結果のサマリー
echo -e "\n================================="
echo "テスト結果サマリー"
echo -e "成功: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "失敗: ${RED}${TESTS_FAILED}${NC}"
echo "================================="

# クリーンアップ
rm -f test-language-integration.js

exit $TESTS_FAILED
EOF

chmod +x scripts/test-aivisspeech-integration.sh
```

### 2. エンドツーエンド（E2E）テスト

```typescript
// e2e/aivisspeech-e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('AivisSpeech E2E Tests', () => {
  test('should synthesize Japanese speech using AivisSpeech', async ({ page }) => {
    // engineer-cafe-navigatorアプリケーションにアクセス
    await page.goto('http://localhost:3000');
    
    // 言語を日本語に設定
    await page.click('[data-testid="language-selector"]');
    await page.click('[data-testid="language-ja"]');
    
    // テキスト入力
    await page.fill('[data-testid="message-input"]', 'こんにちは、エンジニアカフェへようこそ');
    
    // 送信ボタンをクリック
    await page.click('[data-testid="send-button"]');
    
    // 音声再生が開始されることを確認
    await expect(page.locator('audio')).toBeVisible({ timeout: 5000 });
    
    // ネットワークリクエストを確認
    const aivisRequest = page.waitForRequest(request => 
      request.url().includes('aivisspeech-engine') && 
      request.url().includes('/synthesis')
    );
    
    await expect(aivisRequest).toBeTruthy();
  });

  test('should fallback to Google TTS when AivisSpeech fails', async ({ page }) => {
    // AivisSpeechを無効化（環境変数で制御）
    await page.addInitScript(() => {
      window.AIVISSPEECH_ENABLED = 'false';
    });
    
    await page.goto('http://localhost:3000');
    
    // 日本語でメッセージ送信
    await page.fill('[data-testid="message-input"]', 'フォールバックテスト');
    await page.click('[data-testid="send-button"]');
    
    // Google TTSへのリクエストを確認
    const googleRequest = page.waitForRequest(request => 
      request.url().includes('texttospeech.googleapis.com')
    );
    
    await expect(googleRequest).toBeTruthy();
  });
});
```

## 📊 パフォーマンステスト

### 1. 負荷テストスクリプト

```bash
# Apache Benchを使用した負荷テスト
cat > scripts/performance-test.sh << 'EOF'
#!/bin/bash

echo "📊 AivisSpeech パフォーマンステスト"
echo "===================================="

SERVICE_URL="${AIVISSPEECH_SERVICE_URL}"
TOKEN=$(gcloud auth print-identity-token)

# 1. レイテンシテスト（単一リクエスト）
echo -e "\n1. レイテンシテスト"
for i in {1..5}; do
    echo -n "   試行 $i: "
    time curl -s -X POST \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        "${SERVICE_URL}/audio_query?text=テスト&speaker=888753760" \
        -d '{}' > /dev/null
done

# 2. 並行リクエストテスト
echo -e "\n2. 並行リクエストテスト (10並列, 100リクエスト)"

# テスト用のリクエストファイルを作成
cat > test-request.txt << REQ
POST /audio_query?text=並行テスト&speaker=888753760 HTTP/1.1
Host: ${SERVICE_URL#https://}
Authorization: Bearer ${TOKEN}
Content-Type: application/json
Content-Length: 2

{}
REQ

# Apache Benchで負荷テスト
ab -n 100 -c 10 -T 'application/json' -u test-request.txt "${SERVICE_URL}/audio_query?text=test&speaker=888753760"

# 3. 長文テスト
echo -e "\n3. 長文処理テスト"
LONG_TEXT=$(python3 -c "print('これは長文のテストです。' * 20)")

time curl -s -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${SERVICE_URL}/audio_query?text=${LONG_TEXT}&speaker=888753760" \
    -d '{}' > /dev/null

echo -e "\nパフォーマンステスト完了"

# クリーンアップ
rm -f test-request.txt
EOF

chmod +x scripts/performance-test.sh
```

### 2. メトリクス収集スクリプト

```typescript
// scripts/collect-metrics.ts
import { CloudMonitoringClient } from '@google-cloud/monitoring';

async function collectAivisSpeechMetrics() {
  const client = new CloudMonitoringClient();
  const projectId = process.env.GCP_PROJECT_ID;
  
  const request = {
    name: client.projectPath(projectId!),
    filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="aivisspeech-engine"',
    interval: {
      endTime: {
        seconds: Date.now() / 1000,
      },
      startTime: {
        seconds: Date.now() / 1000 - 3600, // 過去1時間
      },
    },
  };

  const [timeSeries] = await client.listTimeSeries(request);
  
  console.log('📊 AivisSpeech メトリクス（過去1時間）');
  console.log('=====================================');
  
  timeSeries.forEach(ts => {
    const metricType = ts.metric?.type?.split('/').pop();
    const latestValue = ts.points?.[0]?.value?.doubleValue || 0;
    
    console.log(`${metricType}: ${latestValue}`);
  });
}

collectAivisSpeechMetrics().catch(console.error);
```

## 🚨 障害シミュレーション

### 1. Cloud Runサービスの停止テスト

```bash
# サービスを一時的に停止
gcloud run services update aivisspeech-engine \
    --region ${REGION} \
    --max-instances 0

# アプリケーションの動作確認（フォールバックが機能するか）
npm run dev
# ブラウザでテスト

# サービスを復旧
gcloud run services update aivisspeech-engine \
    --region ${REGION} \
    --max-instances 10
```

### 2. ネットワーク遅延シミュレーション

```bash
# toxiproxyを使用した遅延注入
docker run -d --name toxiproxy -p 8474:8474 -p 10101:10101 shopify/toxiproxy

# プロキシの設定
curl -X POST http://localhost:8474/proxies \
    -d '{
      "name": "aivisspeech",
      "listen": "0.0.0.0:10101",
      "upstream": "aivisspeech-engine.run.app:443"
    }'

# 500msの遅延を追加
curl -X POST http://localhost:8474/proxies/aivisspeech/toxics \
    -d '{
      "type": "latency",
      "name": "slow_network",
      "attributes": {"latency": 500}
    }'
```

## ✅ テストチェックリスト

### 基本機能テスト
- [ ] 日本語テキストがAivisSpeechで音声合成される
- [ ] 英語テキストがGoogle TTSで音声合成される
- [ ] 感情パラメータが正しく適用される
- [ ] 長文（500文字以上）が処理できる

### エラーハンドリングテスト
- [ ] AivisSpeechが利用不可の場合、Google TTSにフォールバックする
- [ ] ネットワークエラー時に適切なエラーメッセージが表示される
- [ ] タイムアウト時に処理が中断される
- [ ] 認証エラーが適切に処理される

### パフォーマンステスト
- [ ] AudioQuery生成が2秒以内に完了する
- [ ] 音声合成全体が5秒以内に完了する
- [ ] 10並列リクエストを処理できる
- [ ] メモリ使用量が4GiB以内に収まる

### 統合テスト
- [ ] VoiceOutputAgentからAivisSpeechが呼び出される
- [ ] RealtimeAgentが正しく音声を処理する
- [ ] CharacterControlAgentと連携してリップシンクが動作する

## 📈 継続的なモニタリング

### アラート設定

```yaml
# monitoring/alerts.yaml
alertPolicy:
  displayName: "AivisSpeech High Latency"
  conditions:
    - displayName: "Response time > 3s"
      conditionThreshold:
        filter: |
          resource.type="cloud_run_revision"
          AND resource.labels.service_name="aivisspeech-engine"
          AND metric.type="run.googleapis.com/request_latencies"
        comparison: COMPARISON_GT
        thresholdValue: 3000
        duration: 300s
  notificationChannels:
    - projects/${PROJECT_ID}/notificationChannels/${CHANNEL_ID}
```

---

**Next Step**: テストが完了したら、[トラブルシューティング](./TROUBLESHOOTING.md)を確認して、問題が発生した場合の対処方法を理解してください。
