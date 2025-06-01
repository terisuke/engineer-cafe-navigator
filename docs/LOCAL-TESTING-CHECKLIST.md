# Local Testing Checklist

## Before Production Deployment

This checklist ensures all systems are functioning correctly before deploying to production.

## 1. Environment Setup ✅

```bash
# Copy and configure environment
cp .env.production.example .env.local

# Edit .env.local with actual values:
# - Supabase credentials
# - Google Cloud API keys  
# - OpenAI API key (required for V2)
# - Feature flags (start conservative)
```

## 2. Run Test Suite 🧪

### Step 1: Basic Environment Check
```bash
pnpm test:local
```
Expected: All prerequisites installed, environment files configured

### Step 2: Pre-deployment Validation
```bash
pnpm test:pre-deploy
```
Expected: Build succeeds, TypeScript clean, database connected

### Step 3: Full Integration Test
```bash
pnpm test:full
```
Expected: All API endpoints responding, feature flags correct

### Step 4: Migration Test (Dry Run)
```bash
pnpm migrate:embeddings migrate --dry-run --limit 5
```
Expected: Migration script runs without errors

### Step 5: V2 Rollout Simulation
```bash
pnpm test:v2-rollout
```
Expected: System functions at all rollout percentages (0%, 10%, 25%, 50%, 75%, 100%)

### Step 6: Performance Comparison
```bash
pnpm compare:implementations
```
Expected: V2 performance comparable to V1

### Step 7: External API Test
```bash
pnpm test:external-apis
```
Expected: Connpass API accessible, cache functioning

### Step 8: Final Deployment Check
```bash
pnpm check:deployment
```
Expected: All critical checks pass

## 3. Success Criteria ✅

Before proceeding to production:

- [ ] **Build**: Production build completes without errors
- [ ] **TypeScript**: No type errors
- [ ] **Database**: All tables accessible, pgvector installed
- [ ] **APIs**: All endpoints return 200 status
- [ ] **Feature Flags**: Set correctly (start with 0% V2)
- [ ] **External Services**: Google AI and OpenAI keys valid
- [ ] **Performance**: Response times <1000ms locally
- [ ] **V2 Testing**: Functions at all rollout percentages

## 4. Test Report Generation 📊

After all tests pass:
```bash
# Generate comprehensive test report
pnpm test:full > test-reports/full-test-$(date +%Y%m%d-%H%M%S).txt

# Check deployment readiness
pnpm check:deployment > test-reports/readiness-$(date +%Y%m%d-%H%M%S).txt
```

## 5. Create Production Snapshot 📸

Only after ALL tests pass:
```bash
pnpm create:snapshot --name "pre-prod-tested-$(date +%Y%m%d-%H%M%S)"
```

## 6. Preview Deployment 🔍

```bash
# Deploy to preview
vercel

# Get preview URL
PREVIEW_URL=$(vercel inspect --json | jq -r '.url')
echo "Preview URL: $PREVIEW_URL"

# Test preview
curl $PREVIEW_URL/api/monitoring/migration-success
```

## 7. Production Deployment 🚀

Only after preview testing:
```bash
# Deploy to production
vercel --prod

# Verify deployment
curl https://your-domain.com/api/monitoring/dashboard
```

## Common Issues & Solutions

### Issue: Database connection fails
- Check DATABASE_URL format
- Verify Supabase project is active
- Ensure service role key is correct

### Issue: OpenAI key not working
- Verify key starts with 'sk-proj-'
- Check key hasn't expired
- Ensure billing is active

### Issue: Build fails
- Clear cache: `rm -rf .next node_modules`
- Reinstall: `pnpm install`
- Check for TypeScript errors

### Issue: V2 not working
- Verify OPENAI_API_KEY is set
- Check knowledge_base_v2 table exists
- Run migration setup: `pnpm migrate:embeddings setup`

## Emergency Rollback

If issues occur after deployment:
```bash
# Immediate rollback
vercel env add FF_NEW_EMBEDDINGS_PERCENTAGE=0 production
vercel redeploy --prod

# Or use emergency shutdown
curl -X POST https://your-domain.com/api/alerts/webhook \
  -H "Authorization: Bearer $ALERT_WEBHOOK_SECRET" \
  -d '{"action": "emergency_shutdown"}'
```

---

Last Updated: June 2, 2025