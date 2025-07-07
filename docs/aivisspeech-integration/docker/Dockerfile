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
