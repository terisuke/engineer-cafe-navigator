#!/bin/bash

# Calendar Integration Test Script
# Usage: ./scripts/test-calendar.sh

echo "🧪 Calendar Integration Test"
echo "============================="
echo

# Check if environment variables are set
if [ -z "$GOOGLE_GENERATIVE_AI_API_KEY" ]; then
    echo "⚠️  Loading environment variables..."
    export $(grep -v '^#' .env | xargs)
fi

# Check if required environment variables are set
if [ -z "$GOOGLE_GENERATIVE_AI_API_KEY" ]; then
    echo "❌ GOOGLE_GENERATIVE_AI_API_KEY is not set"
    echo "Please set the environment variable or update .env file"
    exit 1
fi

echo "✅ Environment variables loaded"
echo

# Run the test
echo "🚀 Running calendar integration test..."
npx tsx test-calendar-integration.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo
    echo "🎉 Calendar integration test completed successfully!"
else
    echo
    echo "❌ Calendar integration test failed!"
    exit 1
fi