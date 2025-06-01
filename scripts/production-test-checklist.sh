#!/bin/bash

# Production Testing Checklist for Phase 3
# Run this script after deployment to verify all systems

echo "🚀 Engineer Cafe Navigator - Production Testing Checklist"
echo "========================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL (update for production)
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    echo -n "Testing $name... "
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status)"
        return 1
    fi
}

# Performance test function
perf_test() {
    local name="$1"
    local url="$2"
    local max_time="${3:-1.0}"
    
    echo -n "Performance test $name... "
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$url")
    
    if (( $(echo "$response_time < $max_time" | bc -l) )); then
        echo -e "${GREEN}✓ PASS${NC} (${response_time}s < ${max_time}s)"
        return 0
    else
        echo -e "${YELLOW}⚠ SLOW${NC} (${response_time}s > ${max_time}s)"
        return 1
    fi
}

echo "1. API Endpoints Health Check"
echo "----------------------------"
test_endpoint "Voice API" "$BASE_URL/api/voice?action=status"
test_endpoint "Character API" "$BASE_URL/api/character?action=health"
test_endpoint "Marp API" "$BASE_URL/api/marp?action=health"
test_endpoint "Q&A API" "$BASE_URL/api/qa?action=status"
test_endpoint "Knowledge Search API" "$BASE_URL/api/knowledge/search" "405"  # Expects POST
test_endpoint "Monitoring Dashboard" "$BASE_URL/api/monitoring/dashboard"
test_endpoint "External Data API" "$BASE_URL/api/external?action=status"
echo ""

echo "2. RAG System Performance Tests"
echo "-------------------------------"
# Test RAG search performance
echo -n "RAG Search Test... "
start_time=$(date +%s.%N)
curl -s -X POST "$BASE_URL/api/knowledge/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"エンジニアカフェの営業時間"}' > /dev/null
end_time=$(date +%s.%N)
response_time=$(echo "$end_time - $start_time" | bc)

if (( $(echo "$response_time < 0.8" | bc -l) )); then
    echo -e "${GREEN}✓ PASS${NC} (${response_time}s)"
else
    echo -e "${YELLOW}⚠ SLOW${NC} (${response_time}s > 0.8s target)"
fi
echo ""

echo "3. External API Integration Tests"
echo "---------------------------------"
# Test Connpass integration
echo -n "Connpass API Test... "
response=$(curl -s "$BASE_URL/api/external?source=connpass&action=test")
if [[ $response == *"success"* ]]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test cache functionality
echo -n "Cache Test (2nd call should be faster)... "
start1=$(date +%s.%N)
curl -s "$BASE_URL/api/external?source=connpass&action=events&limit=5" > /dev/null
end1=$(date +%s.%N)
time1=$(echo "$end1 - $start1" | bc)

start2=$(date +%s.%N)
curl -s "$BASE_URL/api/external?source=connpass&action=events&limit=5" > /dev/null
end2=$(date +%s.%N)
time2=$(echo "$end2 - $start2" | bc)

if (( $(echo "$time2 < $time1 * 0.5" | bc -l) )); then
    echo -e "${GREEN}✓ PASS${NC} (1st: ${time1}s, 2nd: ${time2}s)"
else
    echo -e "${YELLOW}⚠ WARN${NC} (Cache may not be working: 1st: ${time1}s, 2nd: ${time2}s)"
fi
echo ""

echo "4. Feature Flag System Test"
echo "---------------------------"
# This would need actual implementation
echo -e "${YELLOW}⚠ Manual verification required${NC}"
echo "- Check feature flags are loaded correctly"
echo "- Verify A/B testing percentage rollout"
echo "- Test emergency shutdown capability"
echo ""

echo "5. Monitoring & Alerts Test"
echo "---------------------------"
# Test monitoring dashboard
echo -n "Monitoring Dashboard Data... "
metrics=$(curl -s "$BASE_URL/api/monitoring/dashboard?range=1h")
if [[ $metrics == *"summary"* ]] && [[ $metrics == *"health"* ]]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test alert webhook (with test payload)
echo -n "Alert Webhook Test... "
alert_response=$(curl -s -X POST "$BASE_URL/api/alerts/webhook" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ALERT_WEBHOOK_SECRET:-test}" \
    -d '{
        "type": "response_time",
        "severity": "info",
        "metric": "avg_response_time",
        "value": 500,
        "threshold": 800,
        "source": "test"
    }')
if [[ $alert_response == *"received"* ]]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi
echo ""

echo "6. Database & Migration Status"
echo "------------------------------"
echo -e "${YELLOW}⚠ Manual verification required${NC}"
echo "Run these commands to verify:"
echo "- supabase db remote status"
echo "- Check pgvector extension: SELECT * FROM pg_extension WHERE extname = 'vector';"
echo "- Verify knowledge_base entries: SELECT COUNT(*) FROM knowledge_base;"
echo "- Check metrics tables exist"
echo ""

echo "7. Performance Baseline"
echo "----------------------"
# Collect baseline if in production
if [[ "$NODE_ENV" == "production" ]]; then
    echo "Collecting performance baseline..."
    curl -s -X POST "$BASE_URL/api/monitoring/baseline/collect" > /dev/null
    echo -e "${GREEN}✓ Baseline collected${NC}"
else
    echo -e "${YELLOW}⚠ Skipped (not in production)${NC}"
fi
echo ""

echo "========================================================="
echo "Testing Complete!"
echo ""
echo "Next Steps:"
echo "1. Monitor dashboard for 24-48 hours"
echo "2. Check error rates and response times"
echo "3. Verify cache hit rates > 70%"
echo "4. Enable gradual migration after stability confirmed"
echo ""
echo "Dashboard URL: $BASE_URL/api/monitoring/dashboard"
echo "========================================================="