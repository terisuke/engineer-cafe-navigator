# Final Deployment Guide

## Pre-Deployment Checklist

### 1. Local Environment Testing

```bash
# Run comprehensive local tests
./scripts/test-local-setup.sh

# Run pre-deployment validation
pnpm tsx scripts/pre-deployment-test.ts

# Test production build
pnpm build
pnpm start
```

### 2. Environment Variables

#### Required Variables
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `GOOGLE_CLOUD_PROJECT_ID` - GCP project ID
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` - Gemini API key
- [ ] `OPENAI_API_KEY` - OpenAI API key (for V2 embeddings)

#### Feature Flags (Conservative Start)
```env
FF_ENABLE_GRADUAL_MIGRATION=true
FF_NEW_EMBEDDINGS_PERCENTAGE=0
FF_USE_PARALLEL_RAG=false
FF_ENABLE_PERFORMANCE_LOGGING=true
```

### 3. Vercel Setup

```bash
# Link to Vercel project
vercel link

# Pull environment variables
vercel env pull

# Add production variables
vercel env add OPENAI_API_KEY production
vercel env add FF_ENABLE_GRADUAL_MIGRATION production
# ... add all required variables

# Verify configuration
vercel env ls production
```

## Deployment Steps

### Step 1: Create Snapshot
```bash
pnpm create:snapshot --name "pre-production-$(date +%Y%m%d-%H%M%S)"
```

### Step 2: Preview Deployment
```bash
# Deploy to preview
vercel

# Get preview URL
echo "Preview URL: $(vercel inspect --json | jq -r '.url')"

# Test preview
curl https://[preview-url]/api/monitoring/migration-success
```

### Step 3: Production Deployment
```bash
# Deploy to production
vercel --prod

# Verify deployment
curl https://your-domain.com/api/monitoring/dashboard
```

### Step 4: Post-Deployment Verification
```bash
# Check system health
curl https://your-domain.com/api/monitoring/dashboard | jq '.'

# Test Q&A functionality
curl https://your-domain.com/api/qa \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"question": "エンジニアカフェの営業時間は？", "language": "ja"}'

# Start monitoring
pnpm monitor:migration --continuous
```

## Migration Schedule

### Week 1: Foundation (Days 1-7)
- Day 1-3: Deploy with 0% V2 traffic
- Day 4-7: Migrate knowledge base, monitor baseline

### Week 2: Gradual Rollout (Days 8-16)
```bash
# Day 8: Enable 10%
vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE=10 production
vercel redeploy --prod

# Day 10: Increase to 25%
vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE=25 production
vercel redeploy --prod

# Day 12: Increase to 50%
vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE=50 production
vercel redeploy --prod

# Day 14: Increase to 75%
vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE=75 production
vercel redeploy --prod

# Day 16: Full rollout
vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE=100 production
vercel redeploy --prod
```

### Week 3: Validation (Days 17-23)
```bash
# Daily validation
pnpm validate:production

# Weekly report
pnpm report:migration
```

### Week 4: Cleanup (Days 24-30)
- Deprecate V1 after 7 days of stable 100% rollout
- Remove old code
- Update documentation

## Monitoring URLs

- **Dashboard**: `https://your-domain.com/api/monitoring/dashboard`
- **Migration Success**: `https://your-domain.com/api/monitoring/migration-success`
- **Health Check**: `https://your-domain.com/api/voice?action=status`

## Emergency Procedures

### Immediate Rollback
```bash
# Set to 0%
vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE=0 production
vercel redeploy --prod
```

### Emergency Contacts
- Primary: [Your Name] - [Contact]
- DevOps: [Name] - [Contact]
- On-call: [Name] - [Contact]

## Success Criteria

Before proceeding to next phase:
- [ ] Response time <800ms (p95)
- [ ] Error rate <0.1%
- [ ] Similarity score >0.7
- [ ] No critical alerts for 24h
- [ ] Positive user feedback

## Troubleshooting

### Common Issues

1. **High response times**
   - Check cache hit rates
   - Verify database indexes
   - Monitor OpenAI API latency

2. **Low similarity scores**
   - Verify embedding dimensions
   - Check text preprocessing
   - Compare query patterns

3. **Migration failures**
   - Check API rate limits
   - Verify network connectivity
   - Review error logs

### Debug Commands
```bash
# Check V2 health
curl https://your-domain.com/api/rag/v2/health

# View recent errors
supabase db query "SELECT * FROM system_errors ORDER BY created_at DESC LIMIT 10"

# Check migration status
supabase db query "SELECT * FROM embedding_migration_status"
```

---

Last Updated: June 2, 2025
Ready for Production Deployment ✅