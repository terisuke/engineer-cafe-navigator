# Test Suite Documentation

## Overview

This directory contains the consolidated test suite for Engineer Cafe Navigator. All tests have been organized into a structured format to reduce redundancy and improve maintainability.

## Test Structure

```
tests/
├── integrated-test-suite.ts    # Comprehensive test suite
├── router-agent-test.ts        # RouterAgent specific tests
├── calendar-integration-test.ts # Calendar integration tests
├── run-tests.ts                # Main test runner
└── utils/
    └── test-evaluation.ts      # Semantic evaluation system
```

## Running Tests

### Using npm scripts (recommended):
```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:integrated
pnpm test:router
pnpm test:calendar
```

### Direct execution:
```bash
# From scripts/tests directory
npx tsx run-tests.ts           # Run all tests
npx tsx run-tests.ts integrated # Run integrated tests only
npx tsx run-tests.ts router     # Run router tests only
npx tsx run-tests.ts calendar   # Run calendar tests only
```

## Test Categories

### Integrated Test Suite
The main test suite covers:
- Basic Information Queries (営業時間, 場所, アクセス, etc.)
- Facility Navigation (地下施設, Saino, etc.)
- Memory and Context Handling (conversation continuity)
- Multi-language Support (Japanese/English)
- Edge Cases and Error Handling
- Calendar and Event Integration
- Web Search Integration
- STT Correction System
- Performance Testing

### Router Agent Test
Tests the routing logic for:
- Business information queries
- Facility queries
- Event queries
- Memory-related queries
- General knowledge queries

### Calendar Integration Test
Verifies:
- Google Calendar configuration
- Event fetching functionality
- OAuth2 setup (if applicable)

## Evaluation System

The test suite uses an improved semantic evaluation system that:
- Recognizes synonyms (e.g., '営業時間' ≈ 'hours' ≈ 'time')
- Uses concept groups for related terms
- Provides detailed scoring (0-100%)
- Generates comprehensive reports

## Test Results

Test results are saved to `/test-results/` directory with timestamps:
- Detailed pass/fail information
- Performance metrics
- Category-wise summaries
- Failed test analysis

## Consolidation Notes

The following legacy test files have been merged into the integrated test suite:
- `test-basement-queries.ts` → Facility Navigation tests
- `test-enhanced-rag.ts` → RAG and routing tests
- `test-specific-queries.ts` → Specific query pattern tests
- `final-comprehensive-test.ts` → All categories

This consolidation eliminates redundancy while preserving all unique test cases.