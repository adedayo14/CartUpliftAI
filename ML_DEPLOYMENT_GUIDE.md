# ML Deployment Guide - Database Migration

## Current Status
✅ Code pushed to GitHub (main branch)
✅ Vercel auto-deployment triggered
⏳ **Database migration needed** - ML tables must be created in production

## ML Tables to Create

The following tables need to be added to your production database:

### 1. MLUserProfile
Tracks user behavior with privacy controls
- sessionId (unique)
- customerId (optional)
- viewedProducts, cartedProducts, purchasedProducts arrays
- privacyLevel, dataRetentionDays
- Composite key: shop + sessionId

### 2. MLProductSimilarity  
Caches content-based recommendation scores
- productId1, productId2
- overallScore, categoryScore, priceScore, cooccurrenceCount
- Composite unique key: shop + productId1 + productId2

### 3. MLDataRetentionJob
Manages GDPR-compliant data cleanup
- scheduledAt, completedAt, status
- recordsProcessed, recordsDeleted

## Deployment Steps

### Option 1: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Navigate to your CartUpliftAI project
   - Go to Settings → Environment Variables
   - Verify `DATABASE_URL` is set

2. **Open Vercel Shell**
   - In your deployment page, click "..." → "View Function Logs"
   - Or use Vercel CLI: `vercel env pull`

3. **Run Migration Command**
   ```bash
   npx prisma db push --skip-generate
   ```

4. **Verify Tables Created**
   ```bash
   npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ML%';"
   ```

### Option 2: Via Vercel CLI (Advanced)

1. **Install Vercel CLI** (if not installed)
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Link Project**
   ```bash
   vercel link
   ```

4. **Pull Environment Variables**
   ```bash
   vercel env pull .env.production
   ```

5. **Run Migration Locally Against Production DB** ⚠️
   ```bash
   DATABASE_URL=$(cat .env.production | grep DATABASE_URL | cut -d '=' -f2-) npx prisma db push
   ```

### Option 3: Via Direct Database Access

If you have direct access to your Neon/PostgreSQL database:

1. **Get Database URL from Vercel**
   - Go to Settings → Environment Variables
   - Copy `DATABASE_URL` value

2. **Connect with psql or pgAdmin**
   ```bash
   psql "your-database-url-here"
   ```

3. **Run SQL Migration**
   ```sql
   -- Create MLUserProfile table
   CREATE TABLE "MLUserProfile" (
     "id" TEXT NOT NULL,
     "shop" TEXT NOT NULL,
     "sessionId" TEXT NOT NULL,
     "customerId" TEXT,
     "viewedProducts" TEXT[],
     "cartedProducts" TEXT[],
     "purchasedProducts" TEXT[],
     "preferences" JSONB,
     "privacyLevel" TEXT NOT NULL DEFAULT 'basic',
     "dataRetentionDays" INTEGER NOT NULL DEFAULT 30,
     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "deletedAt" TIMESTAMP(3),
     
     CONSTRAINT "MLUserProfile_pkey" PRIMARY KEY ("id")
   );

   CREATE UNIQUE INDEX "MLUserProfile_shop_sessionId_key" ON "MLUserProfile"("shop", "sessionId");
   CREATE INDEX "MLUserProfile_sessionId_idx" ON "MLUserProfile"("sessionId");
   CREATE INDEX "MLUserProfile_shop_idx" ON "MLUserProfile"("shop");

   -- Create MLProductSimilarity table
   CREATE TABLE "MLProductSimilarity" (
     "id" TEXT NOT NULL,
     "shop" TEXT NOT NULL,
     "productId1" TEXT NOT NULL,
     "productId2" TEXT NOT NULL,
     "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
     "categoryScore" DOUBLE PRECISION,
     "priceScore" DOUBLE PRECISION,
     "cooccurrenceCount" INTEGER DEFAULT 0,
     "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     
     CONSTRAINT "MLProductSimilarity_pkey" PRIMARY KEY ("id")
   );

   CREATE UNIQUE INDEX "MLProductSimilarity_shop_productId1_productId2_key" ON "MLProductSimilarity"("shop", "productId1", "productId2");
   CREATE INDEX "MLProductSimilarity_overallScore_idx" ON "MLProductSimilarity"("overallScore");
   CREATE INDEX "MLProductSimilarity_shop_productId1_idx" ON "MLProductSimilarity"("shop", "productId1");

   -- Create MLDataRetentionJob table
   CREATE TABLE "MLDataRetentionJob" (
     "id" TEXT NOT NULL,
     "shop" TEXT NOT NULL,
     "scheduledAt" TIMESTAMP(3) NOT NULL,
     "completedAt" TIMESTAMP(3),
     "status" TEXT NOT NULL DEFAULT 'pending',
     "recordsProcessed" INTEGER DEFAULT 0,
     "recordsDeleted" INTEGER DEFAULT 0,
     "dataTypes" TEXT[],
     "error" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     
     CONSTRAINT "MLDataRetentionJob_pkey" PRIMARY KEY ("id")
   );

   CREATE INDEX "MLDataRetentionJob_shop_status_idx" ON "MLDataRetentionJob"("shop", "status");
   CREATE INDEX "MLDataRetentionJob_scheduledAt_idx" ON "MLDataRetentionJob"("scheduledAt");
   ```

## Verification Steps

After migration, verify the tables exist:

### Check Tables via Prisma
```bash
npx prisma studio
```

### Check Tables via SQL
```sql
-- Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('MLUserProfile', 'MLProductSimilarity', 'MLDataRetentionJob');

-- Check table structure
\d "MLUserProfile"
\d "MLProductSimilarity"
\d "MLDataRetentionJob"
```

### Test ML Endpoints

Once tables are created, test the endpoints:

```bash
# Test content recommendations
curl -X POST https://your-app.vercel.app/api/ml/content-recommendations \
  -H "Content-Type: application/json" \
  -d '{"shop":"your-shop.myshopify.com","product_ids":["123"],"privacy_level":"basic"}'

# Test popular recommendations
curl -X POST https://your-app.vercel.app/api/ml/popular-recommendations \
  -H "Content-Type: application/json" \
  -d '{"shop":"your-shop.myshopify.com","privacy_level":"basic"}'

# Test collaborative data
curl -X POST https://your-app.vercel.app/api/ml/collaborative-data \
  -H "Content-Type: application/json" \
  -d '{"shop":"your-shop.myshopify.com","privacy_level":"basic"}'
```

## Troubleshooting

### Error: "Table does not exist"
**Solution:** Run the migration command again. Check Vercel logs for SQL errors.

### Error: "Column already exists"
**Solution:** Some columns might already exist. Use `prisma db push --force-reset` (⚠️ destroys data) or manually adjust the schema.

### Error: "Connection refused"
**Solution:** Check `DATABASE_URL` in Vercel environment variables. Ensure Neon database is active.

### Error: "Out of memory"
**Solution:** Increase Vercel function memory limit in project settings (default: 1024MB, max: 3008MB).

## Post-Migration Checklist

- [ ] Verify all 3 ML tables created successfully
- [ ] Check indexes are created (for performance)
- [ ] Test content recommendations endpoint
- [ ] Test popular recommendations endpoint  
- [ ] Test collaborative filtering endpoint
- [ ] Monitor Vercel function logs for errors
- [ ] Test personalization modes (ai_first, popular, balanced)
- [ ] Verify privacy levels work correctly

## Next Steps After Migration

1. **Monitor Performance**
   - Check Vercel function execution times
   - Monitor database query performance
   - Set up alerts for errors

2. **Test with Real Data**
   - Install app on test Shopify store
   - Generate some tracking events
   - Verify recommendations appear

3. **Setup Data Retention**
   - Create Vercel cron job for cleanup
   - Test data retention service
   - Verify GDPR compliance

4. **Optimize**
   - Add caching layer (Redis)
   - Pre-compute product similarities
   - Add database connection pooling

## Important Notes

⚠️ **Backup First**: Always backup production database before running migrations
⚠️ **Test Locally**: If possible, test migration on a staging database first
⚠️ **Monitor Closely**: Watch Vercel logs for the first hour after deployment
✅ **Reversible**: Tables can be dropped if needed without affecting existing functionality

## Support Commands

```bash
# Check Vercel deployment status
vercel ls

# View latest deployment logs
vercel logs

# Inspect environment variables
vercel env ls

# Rollback to previous deployment (if needed)
vercel rollback
```

## Expected Outcome

After successful migration:
- ✅ 3 new ML tables in production database
- ✅ ML endpoints return real recommendations
- ✅ Settings page shows real order count
- ✅ Privacy controls working correctly
- ✅ Personalization modes functional
- ✅ Tracking events being logged

**Estimated migration time:** 2-5 minutes
**Risk level:** Low (new tables, no changes to existing data)
