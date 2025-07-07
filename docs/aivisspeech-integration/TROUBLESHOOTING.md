# トラブルシューティング

このガイドでは、AivisSpeech Engine統合で発生する可能性のある問題と、その解決方法について説明します。

## 🚨 よくある問題と解決方法

### 1. デプロイ関連の問題

#### ❌ Docker buildxでのビルドエラー

**症状**: 
```
ERROR: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
```

**解決方法**:
```bash
# 正しいディレクトリに移動
cd docs/aivisspeech-integration/docker

# Dockerfileの存在確認
ls -la Dockerfile

# ビルドを再実行
docker buildx build --platform linux/amd64 -t ${IMAGE_URL} --push .
```

#### ❌ Artifact Registryへのプッシュ失敗

**症状**:
```
denied: Permission "artifactregistry.repositories.uploadArtifacts" denied
```

**解決方法**:
```bash
# Docker認証を再設定
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# サービスアカウントの権限確認
gcloud projects get-iam-policy ${PROJECT_ID} \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:*" \
    --format="table(bindings.role)"

# 必要に応じて権限を追加
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/artifactregistry.writer"
```

#### ❌ Cloud Runデプロイエラー

**症状**:
```
ERROR: (gcloud.run.deploy) PERMISSION_DENIED: Permission 'run.services.create' denied
```

**解決方法**:
```bash
# Cloud Run APIが有効か確認
gcloud services list --enabled | grep run.googleapis.com

# 有効でない場合は有効化
gcloud services enable run.googleapis.com

# IAM権限を確認・追加
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/run.admin"
```

### 2. 実行時の問題

#### ❌ AivisSpeechサービスに接続できない

**症状**:
```
[AivisSpeech] Availability check failed: FetchError: Failed to fetch
```

**解決方法**:
```bash
# 1. サービスURLが正しく設定されているか確認
echo $AIVISSPEECH_SERVICE_URL

# 2. Cloud Runサービスのステータス確認
gcloud run services describe aivisspeech-engine \
    --region ${REGION} \
    --format="value(status.conditions[0].message)"

# 3. 認証トークンの確認
TOKEN=$(gcloud auth print-identity-token)
curl -H "Authorization: Bearer ${TOKEN}" ${AIVISSPEECH_SERVICE_URL}/version

# 4. Cloud Runのログを確認
gcloud logging read "resource.type=cloud_run_revision \
    AND resource.labels.service_name=aivisspeech-engine \
    AND severity>=ERROR" \
    --limit 10 \
    --format json
```

#### ❌ 音声合成が失敗する

**症状**:
```
[AivisSpeech] Synthesis API error: 404 Not Found
```

**解決方法**:
```bash
# 1. モデルがGCSに正しくアップロードされているか確認
gsutil ls -r gs://${BUCKET_NAME}/

# 2. GCSボリュームマウントの確認
gcloud run services describe aivisspeech-engine \
    --region ${REGION} \
    --format="yaml(spec.template.spec.volumes,spec.template.spec.containers[0].volumeMounts)"

# 3. コンテナ内でのモデルパス確認（ログから）
gcloud logging read "resource.type=cloud_run_revision \
    AND resource.labels.service_name=aivisspeech-engine \
    AND textPayload:'利用可能なモデル'" \
    --limit 5

# 4. 話者IDが正しいか確認
# speakers.jsonの内容を確認
gsutil cat gs://${BUCKET_NAME}/speakers.json
```

#### ❌ レスポンスが遅い（タイムアウト）

**症状**:
```
[AivisSpeech] Synthesis request timeout
```

**解決方法**:
```bash
# 1. Cloud Runのタイムアウト設定を確認
gcloud run services describe aivisspeech-engine \
    --region ${REGION} \
    --format="value(spec.template.spec.timeoutSeconds)"

# 2. タイムアウトを延長（必要に応じて）
gcloud run services update aivisspeech-engine \
    --region ${REGION} \
    --timeout 600  # 10分に設定

# 3. インスタンスのリソースを増やす
gcloud run services update aivisspeech-engine \
    --region ${REGION} \
    --cpu 4 \
    --memory 8GiB

# 4. コールドスタート対策
gcloud run services update aivisspeech-engine \
    --region ${REGION} \
    --min-instances 1
```

### 3. 統合の問題

#### ❌ 日本語でもGoogle TTSが使われる

**症状**:
```
[TTS] Using Google TTS for Japanese text (AivisSpeech not used)
```

**解決方法**:
```typescript
// 1. 環境変数の確認
console.log('AIVISSPEECH_ENABLED:', process.env.AIVISSPEECH_ENABLED);
console.log('AIVISSPEECH_SERVICE_URL:', process.env.AIVISSPEECH_SERVICE_URL);

// 2. .env.localの確認
// AIVISSPEECH_ENABLED=true であることを確認

// 3. 環境変数の再読み込み
// 開発サーバーを再起動
npm run dev

// 4. GoogleCloudVoiceSimpleの実装確認
// textToSpeechメソッドでAivisSpeech統合が正しく実装されているか確認
```

#### ❌ フォールバックが動作しない

**症状**:
```
[TTS] AivisSpeech failed: Network error
Error: No fallback to Google TTS
```

**解決方法**:
```bash
# 1. フォールバック設定の確認
grep AIVISSPEECH_FALLBACK_TO_GOOGLE_TTS .env.local

# 2. 環境変数が正しく設定されているか確認
# AIVISSPEECH_FALLBACK_TO_GOOGLE_TTS=true

# 3. Google TTSの認証情報確認
ls -la config/service-account-key.json

# 4. フォールバックロジックのデバッグ
# GoogleCloudVoiceSimpleクラスでconsole.logを追加して動作確認
```

## 🔍 デバッグ手順

### 1. ログレベルの詳細化

```typescript
// src/mastra/voice/aivisspeech-service.ts に追加
const DEBUG = process.env.NODE_ENV !== 'production' || process.env.AIVISSPEECH_DEBUG === 'true';

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[AivisSpeech DEBUG]', ...args);
  }
}

// 使用例
debugLog('Request URL:', url.toString());
debugLog('Request Headers:', headers);
debugLog('Response Status:', response.status);
```

### 2. ネットワークトレースの有効化

```bash
# Node.js環境でHTTPSデバッグを有効化
export NODE_DEBUG=https
npm run dev

# curlでの詳細なデバッグ
curl -v -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${AIVISSPEECH_SERVICE_URL}/audio_query?text=test&speaker=888753760" \
    -d '{}'
```

### 3. Cloud Loggingでの詳細分析

```bash
# 特定の時間範囲のログを取得
gcloud logging read "resource.type=cloud_run_revision \
    AND resource.labels.service_name=aivisspeech-engine \
    AND timestamp>='2024-01-01T00:00:00Z'" \
    --limit 100 \
    --format json > aivisspeech-logs.json

# エラーパターンの分析
cat aivisspeech-logs.json | jq '.[] | select(.severity == "ERROR") | .textPayload'

# レスポンス時間の分析
cat aivisspeech-logs.json | jq '.[] | select(.httpRequest.latency) | {
    url: .httpRequest.requestUrl,
    latency: .httpRequest.latency,
    status: .httpRequest.status
}'
```

## 🛠️ パフォーマンス最適化

### 1. コールドスタートの改善

```bash
# 起動ログの分析
gcloud logging read "resource.type=cloud_run_revision \
    AND resource.labels.service_name=aivisspeech-engine \
    AND textPayload:'AivisSpeech Engine を起動します'" \
    --limit 10 \
    --format="table(timestamp,textPayload)"

# モデルロード時間の確認
gcloud logging read "resource.type=cloud_run_revision \
    AND resource.labels.service_name=aivisspeech-engine \
    AND (textPayload:'モデルディレクトリをリンク' OR textPayload:'BERTキャッシュをリンク')" \
    --limit 20 \
    --format="table(timestamp,textPayload)"
```

### 2. メモリ使用量の最適化

```bash
# Cloud Monitoringでメモリ使用量を確認
gcloud monitoring time-series list \
    --filter='metric.type="run.googleapis.com/container/memory/utilizations" AND 
             resource.labels.service_name="aivisspeech-engine"' \
    --format="table(points[0].value.doubleValue,resource.labels.revision_name)"

# 必要に応じてメモリを調整
gcloud run services update aivisspeech-engine \
    --region ${REGION} \
    --memory 6GiB  # 現在の使用量に応じて調整
```

### 3. 並行処理の最適化

```bash
# 現在の並行処理設定を確認
gcloud run services describe aivisspeech-engine \
    --region ${REGION} \
    --format="value(spec.template.spec.containerConcurrency)"

# 並行処理数を調整（CPUコア数に応じて）
gcloud run services update aivisspeech-engine \
    --region ${REGION} \
    --concurrency 2  # CPUに負荷がかかる場合は低めに設定
```

## 📊 メトリクスダッシュボード

### カスタムダッシュボードの作成

```yaml
# monitoring/dashboard.yaml
displayName: "AivisSpeech Engine Dashboard"
mosaicLayout:
  tiles:
    - width: 6
      height: 4
      widget:
        title: "Request Latency (p95)"
        xyChart:
          dataSets:
            - timeSeriesQuery:
                timeSeriesFilter:
                  filter: |
                    resource.type="cloud_run_revision"
                    AND resource.labels.service_name="aivisspeech-engine"
                    AND metric.type="run.googleapis.com/request_latencies"
                  aggregation:
                    alignmentPeriod: 60s
                    perSeriesAligner: ALIGN_PERCENTILE_95
    
    - xPos: 6
      width: 6
      height: 4
      widget:
        title: "Error Rate"
        xyChart:
          dataSets:
            - timeSeriesQuery:
                timeSeriesFilter:
                  filter: |
                    resource.type="cloud_run_revision"
                    AND resource.labels.service_name="aivisspeech-engine"
                    AND metric.type="run.googleapis.com/request_count"
                    AND metric.labels.response_code_class!="2xx"
```

## 🔄 復旧手順

### サービスの完全な再デプロイ

```bash
#!/bin/bash
# recovery-deploy.sh

echo "🔄 AivisSpeech Engine 復旧スクリプト"

# 1. 環境変数の確認
source .env.local

# 2. 新しいイメージタグでビルド
RECOVERY_TAG="recovery-$(date +%Y%m%d-%H%M%S)"
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/aivisspeech-engine/aivisspeech:${RECOVERY_TAG}"

# 3. イメージのビルドとプッシュ
cd docs/aivisspeech-integration/docker
docker buildx build --platform linux/amd64 -t ${IMAGE_URL} --push .

# 4. Cloud Runサービスの更新
gcloud run deploy aivisspeech-engine \
    --image ${IMAGE_URL} \
    --region ${REGION} \
    --platform managed

# 5. ヘルスチェック
sleep 30
curl -f -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
    ${AIVISSPEECH_SERVICE_URL}/version && echo "✅ 復旧完了" || echo "❌ 復旧失敗"
```

## 📞 サポート連絡先

問題が解決しない場合は、以下の情報を準備して開発チームに連絡してください：

1. **エラーログ**: Cloud Loggingからの関連ログ
2. **環境情報**: 
   - Node.jsバージョン: `node --version`
   - プロジェクトID: `echo $PROJECT_ID`
   - リージョン: `echo $REGION`
3. **再現手順**: 問題を再現するための具体的な手順
4. **試した解決策**: このガイドから試した解決方法

---

**関連ドキュメント**:
- [セットアップガイド](./SETUP-GUIDE.md) - 環境準備の確認
- [デプロイガイド](./DEPLOYMENT-GUIDE.md) - デプロイ手順の再確認
- [実装ガイド](./IMPLEMENTATION-GUIDE.md) - コード実装の確認
- [テストガイド](./TESTING-GUIDE.md) - テスト手順の実施
