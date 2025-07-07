# セットアップガイド

このガイドでは、AivisSpeech Engineを統合するための前提条件と環境準備について説明します。

## 📋 前提条件

### 開発環境
- **OS**: macOS (M4 Mac / ARM64)
- **Docker Desktop**: インストール済み（docker buildx対応）
- **Google Cloud SDK**: インストール済み
- **Node.js**: v18以上（engineer-cafe-navigator用）

### GCPリソース
- **GCPプロジェクト**: 既存のプロジェクトを使用
- **サービスアカウント**: `config/service-account-key.json`が存在
- **必要なAPI**: 
  - Cloud Run API
  - Artifact Registry API
  - Cloud Storage API

### 必要な権限
サービスアカウントに以下のロールが付与されていることを確認：
- `roles/run.admin` - Cloud Run管理
- `roles/artifactregistry.writer` - イメージのプッシュ
- `roles/storage.admin` - GCSバケットの管理
- `roles/iam.serviceAccountUser` - サービスアカウントの使用

## 🛠️ 環境準備

### 1. Docker Desktopの設定確認

```bash
# Docker バージョン確認
docker --version

# Docker buildxの確認
docker buildx version

# buildxが有効でない場合は有効化
docker buildx create --name aivisspeech-builder --use
docker buildx inspect --bootstrap
```

### 2. Google Cloud SDKの設定

```bash
# 既存のサービスアカウントで認証
export GOOGLE_APPLICATION_CREDENTIALS="/Users/teradakousuke/Developer/engineer-cafe-navigator/config/service-account-key.json"

# 認証の確認
gcloud auth application-default print-access-token

# プロジェクトIDの取得と設定
# service-account-key.jsonからproject_idを確認
PROJECT_ID=$(cat $GOOGLE_APPLICATION_CREDENTIALS | grep -o '"project_id": "[^"]*"' | cut -d'"' -f4)
echo "Project ID: $PROJECT_ID"

# プロジェクトの設定
gcloud config set project $PROJECT_ID
```

### 3. 必要なAPIの有効化

```bash
# Cloud Run APIの有効化
gcloud services enable run.googleapis.com

# Artifact Registry APIの有効化
gcloud services enable artifactregistry.googleapis.com

# Cloud Storage APIの有効化（通常は既に有効）
gcloud services enable storage.googleapis.com

# 有効化されたAPIの確認
gcloud services list --enabled | grep -E "(run|artifact|storage)"
```

### 4. Artifact Registryリポジトリの作成

```bash
# リージョンの設定（既存のリソースと同じリージョンを推奨）
REGION="asia-northeast1"  # 東京リージョン

# Artifact Registryリポジトリの作成
gcloud artifacts repositories create aivisspeech-engine \
    --repository-format=docker \
    --location=$REGION \
    --description="AivisSpeech Engine Docker images for Engineer Cafe Navigator"

# Docker認証の設定
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### 5. GCSバケットの準備

```bash
# バケット名の生成（プロジェクトIDを含めて一意にする）
BUCKET_NAME="${PROJECT_ID}-aivisspeech-models"

# バケットの作成
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://${BUCKET_NAME}/

# バケットの確認
gsutil ls -p $PROJECT_ID | grep aivisspeech
```

### 6. AivisSpeechモデルの準備

⚠️ **重要**: AivisSpeech Engineにはデフォルトボイスモデル（UUID: a59cb814-0083-4369-8542-f51a29e72af7）が含まれています。カスタムモデルがない場合は、このデフォルトモデルを使用します。

```bash
# モデル用ディレクトリの作成
mkdir -p ~/aivisspeech-models/models
mkdir -p ~/aivisspeech-models/bert_models

# ※カスタムモデルを使用する場合のみ：
# モデルファイル（.aivmx）を配置し、GCSにアップロード
# gsutil -m cp -r ~/aivisspeech-models/* gs://${BUCKET_NAME}/

# デフォルトモデルを使用する場合はGCSアップロードは不要
```

## 🔍 環境変数の設定

プロジェクトで使用する環境変数を`.env.local`に追加：

```bash
# .env.localファイルのバックアップ
cp .env.local .env.local.backup

# AivisSpeech関連の環境変数を追加
cat >> .env.local << EOF

# AivisSpeech Engine設定
AIVISSPEECH_ENABLED=true
AIVISSPEECH_SERVICE_URL=https://aivisspeech-engine-XXXXXXXXXX-an.a.run.app
AIVISSPEECH_FALLBACK_TO_GOOGLE_TTS=true

# GCP設定（既存のものを使用）
GCP_PROJECT_ID=${PROJECT_ID}
GCP_REGION=${REGION}
GCS_MODEL_BUCKET=${BUCKET_NAME}
EOF
```

## ✅ セットアップの確認

以下のコマンドですべての準備が整っているか確認：

```bash
# チェックスクリプトの作成
cat > check-setup.sh << 'EOF'
#!/bin/bash

echo "🔍 環境チェックを開始します..."

# Docker確認
echo -n "Docker Desktop: "
if command -v docker &> /dev/null; then
    echo "✅ $(docker --version)"
else
    echo "❌ インストールされていません"
fi

# Docker buildx確認
echo -n "Docker buildx: "
if docker buildx version &> /dev/null; then
    echo "✅ $(docker buildx version)"
else
    echo "❌ 有効になっていません"
fi

# gcloud確認
echo -n "Google Cloud SDK: "
if command -v gcloud &> /dev/null; then
    echo "✅ $(gcloud --version | head -n 1)"
else
    echo "❌ インストールされていません"
fi

# 認証確認
echo -n "GCP認証: "
if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "✅ サービスアカウントキーが存在"
else
    echo "❌ サービスアカウントキーが見つかりません"
fi

# プロジェクト確認
echo -n "GCPプロジェクト: "
if [ ! -z "$PROJECT_ID" ]; then
    echo "✅ $PROJECT_ID"
else
    echo "❌ 設定されていません"
fi

echo ""
echo "セットアップチェック完了！"
EOF

chmod +x check-setup.sh
./check-setup.sh
```

## 🚨 トラブルシューティング

### Docker buildxが見つからない場合
```bash
# Docker Desktopを再起動
# macOSメニューバーからDocker Desktopを再起動

# 手動で有効化
docker buildx install
```

### gcloud認証エラーの場合
```bash
# サービスアカウントキーの権限確認
ls -la config/service-account-key.json

# 手動で認証
gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS
```

### APIが有効化されていない場合
```bash
# Web UIから有効化
echo "https://console.cloud.google.com/apis/library?project=$PROJECT_ID"
```

---

**Next Step**: 環境準備が完了したら、[デプロイガイド](./DEPLOYMENT-GUIDE.md)に進んでください。
