# Scripts Directory

This directory contains various scripts for testing, maintenance, and administration of the Engineer Cafe Navigator system.

## Main Test Suite

### 🧪 Integrated Test Suite
```bash
pnpm tsx scripts/integrated-test-suite.ts
```
Comprehensive test suite that combines all valuable test scenarios:
- Basic information queries
- Facility navigation  
- Memory and context handling
- Multi-language support
- Edge cases and error handling
- Performance testing

## Active Scripts

### Testing Scripts
- `test-calendar-integration.ts` - Google Calendar integration testing
- `test-calendar-jst-context.ts` - JST timezone specific tests
- `test-web-search-integration.ts` - Web search functionality testing
- `test-direct-api.ts` - Direct API endpoint testing
- `test-stt-corrections.ts` - Speech-to-text correction testing
- `test-saino-hours-scenario.ts` - Saino cafe hours testing
- `test-generic-request-handling.ts` - Generic request handler testing
- `test-enhanced-features-scenario.ts` - Enhanced features testing
- `test-realistic-scenarios.ts` - Real-world scenario validation

### Utility Scripts
- `execute-sql.ts` - Generic SQL execution utility
- `install-css.sh` - CSS dependency installation

### Import/Setup Scripts
- `seed-knowledge-base.ts` - Seeds initial knowledge base data
- `import-markdown-knowledge.ts` - Imports knowledge from markdown
- `import-slide-narrations.ts` - Imports slide narration data
- `setup-admin-knowledge.ts` - Sets up admin knowledge interface
- `update-database-schema.ts` - Database schema updates
- `slide-import-lib.ts` - Library for slide imports
- `create-aka-renga-knowledge.ts` - Creates Aka-Renga entries

### Active Migration Scripts
- `migrate-to-openai-embeddings.ts` - Primary embedding migration script

### Reports and Documentation
- `generic-request-handling-summary.md` - Generic request refactoring docs
- `saino-hours-fix-summary.md` - Saino hours fix documentation
- `final-integration-report.ts` - Generates integration report
- `final-verification-test.ts` - Final verification testing

### Legacy Test Suites (For Reference)
- `advanced-stress-test-suite.ts` - Extensive stress testing
- `comprehensive-navigation-test.ts` - Navigation system testing
- `ultimate-practical-test-suite.ts` - Practical usage testing
- `scenario-based-integration-test.ts` - Scenario-based testing

## Archived Scripts

Scripts that have been executed and are no longer needed have been moved to the `archive/` directory:

### Completed SQL Migrations
- `fix-saino-aka-renga-sql.sql`
- `update-saino-cafe-sql.sql`
- `fix-database-dimension.sql`
- `create-stt-correction-logs-table.sql`

### Completed Fix Scripts
- `apply-saino-aka-renga-fixes.ts`
- `execute-saino-update.ts`
- `fix-embedding-consistency.ts`
- `fix-saino-hours-filter.ts`
- `simulate-saino-response.ts`

### Old Migration Scripts
- `regenerate-embeddings.ts`
- `regenerate-embeddings-simple.ts`
- `regenerate-embeddings-direct.ts`
- `migrate-embeddings.ts`
- `migrate-all-knowledge.ts`

## Usage Guidelines

1. **Before Running Tests**: Ensure the development server is running (`pnpm dev`)
2. **Test Results**: Test results are saved in the `test-results/` directory
3. **Database Scripts**: Always backup the database before running migration scripts
4. **Import Scripts**: Check for duplicates before importing new knowledge

## Quick Commands

```bash
# Run the main test suite
pnpm tsx scripts/integrated-test-suite.ts

# Test specific features
pnpm tsx scripts/test-calendar-integration.ts
pnpm tsx scripts/test-web-search-integration.ts

# Import knowledge
pnpm tsx scripts/import-markdown-knowledge.ts

# Setup admin interface
pnpm tsx scripts/setup-admin-knowledge.ts
```