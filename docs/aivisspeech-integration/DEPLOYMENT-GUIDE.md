# デプロイガイド

このガイドでは、AivisSpeech EngineをGCP Cloud Runにデプロイする手順を説明します。

## 📦 Dockerイメージの準備

### 1. Dockerfileの作成

カスタムDockerfileを作成してGCSマウント対応を実装：

```bash
# Dockerfileの作成
cat > docs/aivisspeech-integration/docker/Dockerfile << 'EOF'
# AivisSpeech Engine公式イメージをベースに使用
# 安定性のため、特定のバージョンを指定
FROM ghcr.io/aivis-project/aivisspeech-engine:cpu-1.1.0-dev

# 必要なパッケージのインストール（rootユーザーで実行）
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# エントリーポイントスクリプトをコピー
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# AivisSpeech Engineのデフォルトポート
EXPOSE 10101

# ユーザーを元に戻す
USER user

# カスタムエントリーポイントを使用
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
EOF
```

### 2. エントリーポイントスクリプトの作成

GCSマウントパスとAivisSpeechのデフォルトパスを連携：

```bash
cat > docs/aivisspeech-integration/docker/entrypoint.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 AivisSpeech Engine 起動準備中..."

# GCSマウントパスの確認
if [ -d "/models" ]; then
    echo "✅ GCSマウント検出: /models"
    
    # AivisSpeechが期待するディレクトリ構造を作成
    mkdir -p /home/user/.local/share/AivisSpeech-Engine
    
    # シンボリックリンクでGCSマウントパスを接続
    if [ -d "/models/Models" ]; then
        ln -sfn /models/Models /home/user/.local/share/AivisSpeech-Engine/Models
        echo "✅ モデルディレクトリをリンク"
    fi
    
    if [ -d "/models/bert_models" ]; then
        ln -sfn /models/bert_models /home/user/.local/share/AivisSpeech-Engine/bert_models
        echo "✅ BERTキャッシュをリンク"
    fi
    
    # 利用可能なモデルをリスト
    echo "📦 利用可能なモデル:"
    ls -la /home/user/.local/share/AivisSpeech-Engine/Models/ 2>/dev/null || echo "モデルが見つかりません"
else
    echo "⚠️  GCSマウントが見つかりません。デフォルト設定で起動します。"
fi

# AivisSpeech Engineの起動
echo "🎙️ AivisSpeech Engine を起動します..."
# CORSポリシーをすべてのドメインに対して許可し、Cloud Runでの利用を可能にする
exec gosu user /opt/python/bin/poetry run python ./run.py --host 0.0.0.0 --port 10101 --cors_policy_mode all
EOF

# スクリプトに実行権限を付与
chmod +x docs/aivisspeech-integration/docker/entrypoint.sh
```

### 3. Dockerイメージのビルド

#### 重要な設定

⚠️ **CORSポリシー設定**: AivisSpeech Engineは `--cors_policy_mode all` オプションを使用して起動されます。これにより、Cloud Runサービスがあらゆるドメインからのリクエストを受け付けることができます。セキュリティが懸念される場合は、本番環境では特定のドメインのみを許可するよう調整してください。

#### ビルド手順

M4 Mac (ARM64)からlinux/amd64向けのイメージをビルド：

```bash
# 環境変数の設定
source .env.local  # または手動で設定
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="${GCP_REGION:-asia-northeast1}"
IMAGE_TAG="v1.0.0"

# Artifact RegistryのイメージURL
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/aivisspeech-engine/aivisspeech:${IMAGE_TAG}"

# Docker buildxでマルチアーキテクチャビルド
cd docs/aivisspeech-integration/docker
docker buildx build \
    --platform linux/amd64 \
    -t ${IMAGE_URL} \
    --push \
    .

# ビルドログの確認
echo "✅ イメージがプッシュされました: ${IMAGE_URL}"
```

## 🚀 Cloud Runへのデプロイ

### 1. Cloud Runサービスのデプロイ

```bash
# サービス名とリージョンの設定
SERVICE_NAME="aivisspeech-engine"
REGION="${GCP_REGION:-asia-northeast1}"

# Cloud Runサービスのデプロイ
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_URL} \
    --platform managed \
    --region ${REGION} \
    --memory 4GiB \
    --cpu 2 \
    --port 10101 \
    --min-instances 0 \
    --max-instances 10 \
    --concurrency 4 \
    --timeout 300 \
    --no-allow-unauthenticated \
    --service-account "$(cat config/service-account-key.json | grep client_email | cut -d'"' -f4)"
```

### 2. GCSボリュームマウントの設定

```bash
# GCSバケット名（セットアップガイドで作成したもの）
BUCKET_NAME="${PROJECT_ID}-aivisspeech-models"

# Cloud RunサービスにGCSボリュームをマウント
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --add-volume name=models-volume,type=cloud-storage,bucket=${BUCKET_NAME} \
    --add-volume-mount volume=models-volume,path=/models,read-only=True
```

### 3. サービスURLの取得

```bash
# サービスURLを取得して環境変数に保存
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --region ${REGION} \
    --format 'value(status.url)')

echo "🎉 AivisSpeech Engine URL: ${SERVICE_URL}"

# .env.localを更新
sed -i.bak "s|AIVISSPEECH_SERVICE_URL=.*|AIVISSPEECH_SERVICE_URL=${SERVICE_URL}|" .env.local
```

## 🧪 デプロイの検証

### 1. ヘルスチェック

```bash
# 認証トークンの取得
TOKEN=$(gcloud auth print-identity-token)

# サービスの疎通確認
curl -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" \
     ${SERVICE_URL}/version

# 期待される応答: バージョン情報のJSON
```

### 2. 音声合成テスト

```bash
# テスト用スクリプトの作成
cat > test-aivisspeech.sh << 'EOF'
#!/bin/bash

SERVICE_URL="$1"
TOKEN="$2"
TEXT="こんにちは、AivisSpeech Engineのテストです。"
# デフォルトモデルのスピーカーID（実際のIDは/speakersエンドポイントで確認）
SPEAKER_ID="0"

# 1. AudioQueryの生成
echo "📝 AudioQueryを生成中..."
AUDIO_QUERY=$(curl -s -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${SERVICE_URL}/audio_query?text=${TEXT}&speaker=${SPEAKER_ID}" \
    -d "{}")

if [ -z "$AUDIO_QUERY" ]; then
    echo "❌ AudioQuery生成に失敗しました"
    exit 1
fi

echo "✅ AudioQuery生成成功"

# 2. 音声合成
echo "🎙️ 音声を合成中..."
curl -s -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${SERVICE_URL}/synthesis?speaker=${SPEAKER_ID}" \
    -d "${AUDIO_QUERY}" \
    --output test-output.wav

if [ -f "test-output.wav" ]; then
    echo "✅ 音声ファイルが生成されました: test-output.wav"
    echo "ファイルサイズ: $(ls -lh test-output.wav | awk '{print $5}')"
else
    echo "❌ 音声生成に失敗しました"
    exit 1
fi
EOF

chmod +x test-aivisspeech.sh

# テストの実行
./test-aivisspeech.sh ${SERVICE_URL} ${TOKEN}
```

## 🔧 パフォーマンスチューニング

### 1. コールドスタート対策

開発環境と本番環境で異なる設定を適用：

```bash
# 開発環境（コスト優先）
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --min-instances 0

# 本番環境（レスポンス優先）
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --min-instances 1 \
    --max-instances 20
```

### 2. リソース最適化

```bash
# CPU とメモリの調整（必要に応じて）
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --cpu 4 \
    --memory 8GiB
```

## 📊 モニタリング設定

### 1. Cloud Loggingの確認

```bash
# 最新のログを表示
gcloud logging read "resource.type=cloud_run_revision \
    AND resource.labels.service_name=${SERVICE_NAME}" \
    --limit 50 \
    --format json

# エラーログのみ表示
gcloud logging read "resource.type=cloud_run_revision \
    AND resource.labels.service_name=${SERVICE_NAME} \
    AND severity>=ERROR" \
    --limit 20
```

### 2. Cloud Monitoringダッシュボード

```bash
# メトリクスの確認URL
echo "📊 Cloud Monitoringダッシュボード:"
echo "https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics?project=${PROJECT_ID}"
```

## 🔄 アップデート手順

### モデルの更新

```bash
# 新しいモデルをGCSにアップロード
gsutil cp new-model.aivmx gs://${BUCKET_NAME}/Models/

# Cloud Runサービスを再起動（新しいリビジョンをデプロイ）
gcloud run services update ${SERVICE_NAME} \
    --region ${REGION} \
    --update-env-vars FORCE_RELOAD=$(date +%s)
```

### Dockerイメージの更新

```bash
# 新しいバージョンタグでビルド
NEW_TAG="v1.0.1"
NEW_IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/aivisspeech-engine/aivisspeech:${NEW_TAG}"

# ビルドとプッシュ
docker buildx build \
    --platform linux/amd64 \
    -t ${NEW_IMAGE_URL} \
    --push \
    .

# サービスの更新
gcloud run deploy ${SERVICE_NAME} \
    --image ${NEW_IMAGE_URL} \
    --region ${REGION}
```

## ✅ デプロイ完了チェックリスト

- [ ] Dockerイメージがビルドされ、Artifact Registryにプッシュされた
- [ ] Cloud Runサービスがデプロイされた
- [ ] GCSボリュームがマウントされた
- [ ] サービスURLが取得でき、.env.localに設定された
- [ ] ヘルスチェックが成功した
- [ ] 音声合成テストが成功した
- [ ] ログが正常に出力されている
- [ ] 必要に応じてmin-instancesを調整した

---

**Next Step**: デプロイが完了したら、[実装ガイド](./IMPLEMENTATION-GUIDE.md)に進んでengineer-cafe-navigatorの改修を行ってください。
