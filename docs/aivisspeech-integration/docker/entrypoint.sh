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
