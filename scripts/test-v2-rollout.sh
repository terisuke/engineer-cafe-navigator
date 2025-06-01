#!/bin/bash

# Test V2 implementation at different rollout percentages
# This simulates the gradual rollout process locally

echo "🔄 Testing V2 Rollout Percentages"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to test at specific percentage
test_percentage() {
    local percentage=$1
    echo -e "\n${CYAN}Testing at ${percentage}% rollout...${NC}"
    echo "--------------------------------"
    
    # Set environment variable
    export FF_NEW_EMBEDDINGS_PERCENTAGE=$percentage
    
    # Start dev server in background
    echo "Starting server with FF_NEW_EMBEDDINGS_PERCENTAGE=$percentage"
    pnpm dev > /dev/null 2>&1 &
    SERVER_PID=$!
    
    # Wait for server
    sleep 10
    
    # Run tests
    echo "Running functionality tests..."
    
    # Test Q&A endpoint
    echo -n "Testing Q&A API... "
    response=$(curl -s -X POST http://localhost:3000/api/qa \
        -H "Content-Type: application/json" \
        -d '{"question":"エンジニアカフェの営業時間は？","language":"ja"}' \
        -w "\n%{http_code}")
    
    http_code=$(echo "$response" | tail -n 1)
    if [[ "$http_code" == "200" ]]; then
        echo -e "${GREEN}✅ Success${NC}"
        
        # Check if response contains expected content
        if echo "$response" | grep -q "営業時間\|時間\|time"; then
            echo -e "   ${GREEN}✅ Response contains relevant content${NC}"
        else
            echo -e "   ${YELLOW}⚠️  Response may not contain expected content${NC}"
        fi
    else
        echo -e "${YELLOW}❌ Failed (Status: $http_code)${NC}"
    fi
    
    # Test monitoring endpoint
    echo -n "Testing migration status... "
    migration_response=$(curl -s http://localhost:3000/api/monitoring/migration-success)
    if echo "$migration_response" | grep -q "currentRollout.*$percentage"; then
        echo -e "${GREEN}✅ Rollout percentage correctly set${NC}"
    else
        echo -e "${YELLOW}⚠️  Rollout percentage may not be reflected${NC}"
    fi
    
    # Check for V2 implementation usage
    echo -n "Checking implementation... "
    if [ "$percentage" -gt 0 ]; then
        # For percentages > 0, some requests should use V2
        echo -e "${CYAN}Should use V2 for ~${percentage}% of requests${NC}"
    else
        echo -e "${CYAN}Should use V1 only${NC}"
    fi
    
    # Kill server
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    
    echo ""
}

# Main test sequence
echo "This test will simulate the gradual rollout locally."
echo "Each test starts the dev server with different percentages."
echo ""

# Test at key rollout percentages
percentages=(0 10 25 50 75 100)

for pct in "${percentages[@]}"; do
    test_percentage $pct
    
    # Wait between tests
    if [ "$pct" != "100" ]; then
        echo "Waiting before next test..."
        sleep 3
    fi
done

echo -e "\n${GREEN}✅ Rollout simulation complete!${NC}"
echo ""
echo "Summary:"
echo "- Tested rollout at: 0%, 10%, 25%, 50%, 75%, 100%"
echo "- All percentages should show successful API responses"
echo "- Higher percentages will use V2 implementation more frequently"
echo ""
echo "Next steps:"
echo "1. If all tests passed, the system is ready for gradual rollout"
echo "2. Monitor performance metrics at each stage in production"
echo "3. Use 'pnpm monitor:migration' to track V1 vs V2 performance"