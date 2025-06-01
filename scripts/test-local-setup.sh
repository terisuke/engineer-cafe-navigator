#!/bin/bash

# Local Testing Setup Script
# Comprehensive testing of the local environment before deployment

echo "🔍 Engineer Cafe Navigator - Local Testing Setup"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if required commands exist
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 is installed${NC}"
        return 0
    fi
}

echo "1. Checking Prerequisites"
echo "------------------------"
check_command "node"
check_command "pnpm"
check_command "psql"
check_command "vercel"
check_command "supabase"
echo ""

echo "2. Environment Setup"
echo "-------------------"

# Check for environment files
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✅ .env.local exists${NC}"
else
    echo -e "${RED}❌ .env.local not found${NC}"
    echo "   Copy .env.example to .env.local and configure"
fi

if [ -f ".env.production" ]; then
    echo -e "${GREEN}✅ .env.production exists${NC}"
else
    echo -e "${YELLOW}⚠️  .env.production not found${NC}"
    echo "   Copy .env.production.example to .env.production for production testing"
fi

# Check service account key
if [ -f "config/service-account-key.json" ]; then
    echo -e "${GREEN}✅ Service account key exists${NC}"
else
    echo -e "${RED}❌ Service account key not found${NC}"
    echo "   Add Google Cloud service account key to config/service-account-key.json"
fi
echo ""

echo "3. Dependency Check"
echo "------------------"
echo "Installing dependencies..."
pnpm install
echo ""

echo "4. Database Connection Test"
echo "--------------------------"
# Test database connection using Node.js
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

supabase
  .from('knowledge_base')
  .select('count', { count: 'exact', head: true })
  .then(({ count, error }) => {
    if (error) {
      console.log('❌ Database connection failed:', error.message);
      process.exit(1);
    } else {
      console.log('✅ Database connected. Knowledge base entries:', count);
    }
  });
" || echo -e "${RED}❌ Database connection test failed${NC}"
echo ""

echo "5. Build Test"
echo "------------"
echo "Running build test..."
if pnpm build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    echo "   Run 'pnpm build' to see errors"
fi
echo ""

echo "6. API Endpoint Tests"
echo "--------------------"
echo "Starting dev server for API tests..."

# Start dev server in background
pnpm dev > /dev/null 2>&1 &
DEV_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 10

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -X POST -H "Content-Type: application/json" -d "$data" -w "\n%{http_code}" "$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    
    if [[ "$http_code" =~ ^[2-3][0-9][0-9]$ ]]; then
        echo -e "${GREEN}✅ $name (Status: $http_code)${NC}"
    else
        echo -e "${RED}❌ $name (Status: $http_code)${NC}"
    fi
}

# Test endpoints
test_endpoint "Monitoring Dashboard" "http://localhost:3000/api/monitoring/dashboard"
test_endpoint "Migration Success" "http://localhost:3000/api/monitoring/migration-success"
test_endpoint "Voice API Status" "http://localhost:3000/api/voice?action=status"
test_endpoint "Q&A API" "http://localhost:3000/api/qa" "POST" '{"question":"テスト"}'

# Kill dev server
kill $DEV_PID 2>/dev/null
echo ""

echo "7. Feature Flag Status"
echo "---------------------"
source .env.local 2>/dev/null || true

echo "Current feature flags:"
echo "  FF_ENABLE_GRADUAL_MIGRATION: ${FF_ENABLE_GRADUAL_MIGRATION:-not set}"
echo "  FF_NEW_EMBEDDINGS_PERCENTAGE: ${FF_NEW_EMBEDDINGS_PERCENTAGE:-not set}"
echo "  FF_USE_PARALLEL_RAG: ${FF_USE_PARALLEL_RAG:-not set}"
echo ""

echo "8. Pre-deployment Test"
echo "---------------------"
echo "Running comprehensive pre-deployment tests..."
if pnpm tsx scripts/pre-deployment-test.ts; then
    echo -e "${GREEN}✅ Pre-deployment tests passed${NC}"
else
    echo -e "${RED}❌ Pre-deployment tests failed${NC}"
fi
echo ""

echo "=============================================="
echo "Testing Summary"
echo "=============================================="

# Generate summary
if [ -f ".env.local" ] && [ -f "config/service-account-key.json" ]; then
    echo -e "${GREEN}✅ Local environment is ready${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure .env.production with actual values"
    echo "2. Run: pnpm create:snapshot --name 'pre-deployment'"
    echo "3. Deploy to preview: vercel"
    echo "4. Test preview deployment"
    echo "5. Deploy to production: vercel --prod"
else
    echo -e "${RED}❌ Local environment needs configuration${NC}"
    echo ""
    echo "Required actions:"
    [ ! -f ".env.local" ] && echo "- Create .env.local"
    [ ! -f "config/service-account-key.json" ] && echo "- Add service account key"
    [ ! -f ".env.production" ] && echo "- Create .env.production"
fi
echo ""