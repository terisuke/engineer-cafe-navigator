# Phase 4: RAG Migration Guide

This guide documents the gradual migration from the current RAG implementation (1536-dim embeddings) to Mastra's latest patterns using OpenAI text-embedding-3-small (768-dim).

## Migration Overview

### Current State (V1)
- **Embedding Model**: Google text-embedding-004 (1536 dimensions)
- **Storage**: PostgreSQL with pgvector
- **Implementation**: Custom RAG search tool

### Target State (V2)
- **Embedding Model**: OpenAI text-embedding-3-small (768 dimensions)
- **Storage**: PostgreSQL with pgvector (same infrastructure)
- **Implementation**: Mastra's latest RAG patterns
- **Benefits**: 50% storage reduction, 84.6% API cost reduction

## Migration Timeline

### Week 1: Preparation & Parallel Implementation ✅
- [x] Setup Mastra V2 configuration
- [x] Update migration script for OpenAI embeddings
- [x] Create parallel RAG implementation
- [x] Build A/B testing infrastructure

### Week 2: A/B Testing Implementation
- [ ] Enable gradual rollout (10% → 25% → 50% → 75% → 100%)
- [ ] Monitor performance metrics
- [ ] Collect comparison data

### Week 3: Migration Execution
- [ ] Run embedding migration in batches
- [ ] Verify data integrity
- [ ] Monitor system health

### Week 4: Cutover & Cleanup
- [ ] Complete migration verification
- [ ] Update primary configuration
- [ ] Clean up old implementation

## Commands

### 1. Install Dependencies
```bash
# Install required packages
pnpm add @ai-sdk/openai ai

# Apply database migrations
supabase db push
```

### 2. Setup Migration Infrastructure
```bash
# Create migration tables
pnpm migrate:embeddings setup

# Dry run to verify
pnpm migrate:embeddings migrate --dry-run --limit 10
```

### 3. Run Migration
```bash
# Migrate by category
pnpm migrate:embeddings migrate --category facilities
pnpm migrate:embeddings migrate --category pricing
pnpm migrate:embeddings migrate --category events

# Or migrate all at once
pnpm migrate:embeddings migrate

# Verify migration
pnpm migrate:embeddings verify
```

### 4. Monitor Progress
```bash
# Real-time monitoring
pnpm monitor:migration

# Continuous monitoring (updates every 5 minutes)
pnpm monitor:migration --continuous

# Compare implementations
pnpm compare:implementations

# Collect performance baseline
pnpm monitor:baseline --compare
```

## Feature Flags

Configure gradual rollout via environment variables:

```env
# Enable gradual migration
FF_ENABLE_GRADUAL_MIGRATION=true

# Rollout percentage (0-100)
FF_NEW_EMBEDDINGS_PERCENTAGE=10

# Enable parallel testing
FF_USE_PARALLEL_RAG=true

# Performance monitoring
FF_ENABLE_PERFORMANCE_LOGGING=true
FF_ENABLE_QUERY_ANALYTICS=true
```

## Rollout Schedule

Based on monitoring results, gradually increase the rollout:

| Day    | Percentage | Action                                    |
|--------|-----------|-------------------------------------------|
| 1-3    | 10%       | Initial testing, monitor closely          |
| 4-6    | 25%       | Increase if metrics are good              |
| 7-9    | 50%       | Half of traffic on V2                     |
| 10-12  | 75%       | Majority on V2, prepare for full rollout  |
| 13-14  | 100%      | Full rollout, monitor for stability       |

## Success Criteria

Before increasing rollout percentage, verify:

1. **Performance**: V2 response time ≤ V1 (target <800ms p95)
2. **Accuracy**: Search relevance maintained (>0.7 avg similarity)
3. **Stability**: Zero critical errors in last 24 hours
4. **Cost**: Reduced embedding API costs confirmed

## Monitoring Dashboard

Access real-time metrics:
```
https://your-domain.com/api/monitoring/dashboard?range=24h
```

Key metrics to watch:
- Average response time (should be <800ms)
- P95 response time (should be <1200ms)
- Cache hit rate (should be >70%)
- Error rate (should be <0.1%)
- Similarity scores (should be >0.7)

## Emergency Procedures

### Immediate Rollback
```bash
# Set feature flag to 0%
export FF_NEW_EMBEDDINGS_PERCENTAGE=0

# Or trigger emergency shutdown
curl -X POST https://your-domain.com/api/alerts/webhook \
  -H "Authorization: Bearer $ALERT_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type": "error_rate", "severity": "critical", "value": 0.5, "threshold": 0.1}'
```

### Circuit Breaker
The system automatically falls back to V1 if V2 fails repeatedly. Check circuit breaker status:
```bash
curl https://your-domain.com/api/monitoring/circuit-breaker
```

## Troubleshooting

### Common Issues

1. **High V2 latency**
   - Check cache hit rates
   - Verify pgvector indexes are created
   - Monitor OpenAI API response times

2. **Low similarity scores**
   - Verify embedding dimensions (should be 768)
   - Check text preprocessing consistency
   - Compare query formulation between V1/V2

3. **Migration failures**
   - Check OpenAI API key and rate limits
   - Verify network connectivity
   - Review error logs in migration status table

### Debug Commands
```bash
# Check V2 health
curl https://your-domain.com/api/rag/v2/health

# View recent errors
curl https://your-domain.com/api/alerts/webhook?severity=error

# Check migration status
psql $DATABASE_URL -c "SELECT * FROM embedding_migration_status;"
```

## Post-Migration Checklist

After full rollout:

- [ ] All embeddings migrated to 768 dimensions
- [ ] V2 performance meets or exceeds V1
- [ ] 48 hours of stable operation at 100%
- [ ] Cost reduction verified in billing
- [ ] Remove V1 code (after 1 week backup period)
- [ ] Update documentation
- [ ] Archive migration scripts

## Support

For issues during migration:
- Check logs: `pnpm monitor:migration`
- Review alerts: `/api/monitoring/dashboard`
- Emergency contact: [Your contact info]