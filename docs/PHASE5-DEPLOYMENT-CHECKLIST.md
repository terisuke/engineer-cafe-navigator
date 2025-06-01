# Phase 5: Production Deployment Checklist

## ✅ Prerequisites (Completed)

- [x] All database migrations applied to Supabase
- [x] RAG V2 implementation complete
- [x] Monitoring infrastructure ready
- [x] A/B testing framework deployed

## Week 1: Production Deployment

### Day 1: Initial Deployment (June 3, 2025)

- [ ] **1. Verify Database Readiness**
  ```bash
  supabase migration list
  ```

- [ ] **2. Create Production Snapshot**
  ```bash
  pnpm create:snapshot --name "pre-v2-deployment-20250603"
  ```

- [ ] **3. Set Production Environment Variables**
  ```bash
  vercel env add OPENAI_API_KEY production
  vercel env add FF_ENABLE_GRADUAL_MIGRATION production        # true
  vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE production      # 0
  vercel env add FF_USE_PARALLEL_RAG production              # false
  vercel env add FF_ENABLE_PERFORMANCE_LOGGING production    # true
  vercel env add ALERT_WEBHOOK_SECRET production
  vercel env add CRON_SECRET production
  ```

- [ ] **4. Deploy to Production**
  ```bash
  vercel --prod
  ```

- [ ] **5. Verify Deployment**
  ```bash
  curl https://your-domain.com/api/monitoring/dashboard
  pnpm test:production
  ```

### Day 2-3: Knowledge Base Migration

- [ ] **1. Setup V2 Infrastructure**
  ```bash
  pnpm migrate:embeddings setup
  ```

- [ ] **2. Test Migration**
  ```bash
  pnpm migrate:embeddings migrate --dry-run --limit 10
  ```

- [ ] **3. Migrate by Category**
  ```bash
  # Facilities
  pnpm migrate:embeddings migrate --category facilities
  pnpm monitor:migration
  
  # Pricing
  pnpm migrate:embeddings migrate --category pricing
  pnpm monitor:migration
  
  # Events
  pnpm migrate:embeddings migrate --category events
  pnpm monitor:migration
  
  # Services
  pnpm migrate:embeddings migrate --category services
  pnpm monitor:migration
  ```

- [ ] **4. Verify Migration**
  ```bash
  pnpm migrate:embeddings verify
  ```

### Day 4-7: Baseline Collection

- [ ] **1. Enable Performance Tracking**
  ```bash
  vercel env add FF_ENABLE_PERFORMANCE_LOGGING=true production
  ```

- [ ] **2. Collect Baseline**
  ```bash
  pnpm monitor:baseline --production
  ```

- [ ] **3. Setup Continuous Monitoring**
  ```bash
  pnpm monitor:migration --continuous > logs/migration-monitor.log 2>&1 &
  ```

## Week 2: Gradual Rollout

### Rollout Schedule

| Day | Date | Percentage | Verification |
|-----|------|-----------|--------------|
| 8   | Jun 10 | 10% | Monitor 24h, check metrics |
| 10  | Jun 12 | 25% | Compare V1/V2 performance |
| 12  | Jun 14 | 50% | Run A/B test analysis |
| 14  | Jun 16 | 75% | Check cost reduction |
| 16  | Jun 18 | 100% | Full deployment |

### Daily Rollout Process

- [ ] **1. Morning Health Check (9 AM JST)**
  ```bash
  curl https://your-domain.com/api/monitoring/dashboard?range=24h | jq '.'
  ```

- [ ] **2. Implementation Comparison**
  ```bash
  pnpm compare:implementations
  ```

- [ ] **3. Increase Percentage (if metrics good)**
  ```bash
  vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE=25 production
  vercel redeploy --prod
  ```

- [ ] **4. Enable Parallel Testing (optional)**
  ```bash
  vercel env add FF_USE_PARALLEL_RAG=true production
  ```

- [ ] **5. Monitor Changes**
  ```bash
  pnpm monitor:migration --continuous
  ```

## Week 3: Production Validation

### Validation Checklist

- [ ] **Run Validation Script**
  ```bash
  pnpm validate:production
  ```

- [ ] **Expected Results**
  - ✅ V2 Response Time: <800ms
  - ✅ V2 Error Rate: <0.1%
  - ✅ V2 Similarity Score: >0.7
  - ✅ Cache Hit Rate: >70%
  - ✅ Migration Completion: 100%
  - ✅ V2 Uptime: >99.9%

### Generate Reports

- [ ] **Weekly Migration Report**
  ```bash
  pnpm report:migration
  ```

- [ ] **Success Metrics Dashboard**
  ```bash
  curl https://your-domain.com/api/monitoring/migration-success
  ```

## Week 4: V1 Deprecation

### Pre-deprecation Checklist

- [ ] 100% rollout stable for 7 days
- [ ] All validation checks passing
- [ ] Cost reduction verified (>80%)
- [ ] No increase in user complaints
- [ ] Team approval obtained

### Deprecation Steps

1. **Final Backup**
   ```bash
   pg_dump -h your-db-host -U postgres -d postgres -t knowledge_base > backup/knowledge_base_v1_final.sql
   ```

2. **Create Branch**
   ```bash
   git checkout -b deprecate-v1-rag
   ```

3. **Remove V1 Code**
   ```bash
   rm src/mastra/tools/rag-search.ts
   rm scripts/test-rag-search.ts
   ```

4. **Update Imports**
   - Search and replace across codebase
   - Update tests

5. **Deploy**
   ```bash
   pnpm build
   pnpm test:production
   vercel --prod
   ```

## Monitoring URLs

- **Dashboard**: `https://your-domain.com/api/monitoring/dashboard`
- **Migration Success**: `https://your-domain.com/api/monitoring/migration-success`
- **Alerts**: `https://your-domain.com/api/alerts/webhook`

## Emergency Procedures

### Immediate Rollback
```bash
# Set to 0%
vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE=0 production
vercel redeploy --prod
```

### Emergency Shutdown
```bash
curl -X POST https://your-domain.com/api/alerts/webhook \
  -H "Authorization: Bearer $ALERT_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type": "error_rate", "severity": "critical", "value": 0.5, "threshold": 0.1}'
```

## Success Criteria

- [x] Response Time: V2 ≤ V1 (target <800ms)
- [x] Error Rate: <0.1%
- [x] Similarity Score: >0.7
- [x] Cost Reduction: >80%
- [x] Uptime: 99.9%

## Contact Information

### Primary Contacts
- DevOps Lead: [contact]
- Backend Lead: [contact]
- CTO: [contact]

### Communication Channels
- `#eng-cafe-migration` - Updates
- `#eng-cafe-alerts` - Automated alerts
- `#eng-cafe-emergency` - Critical issues

---

Last Updated: June 2, 2025