# Production Launch Action Plan

## ✅ Phase 1: COMPLETED - Production Hardening

### Currency Integration
- ✅ Created currency service with Shopify API integration
- ✅ Added currencyCode and moneyFormat to Settings schema
- ✅ Updated 4 API routes to use dynamic currency
- ✅ Removed all USD hardcodes

### ML System
- ✅ ML endpoints use real Shopify data
- ✅ Purchase patterns use MLProductSimilarity table
- ✅ Defaults set: ML ON, balanced mode (40% ML + 60% traditional)
- ✅ No mock data in production endpoints

### Database
- ✅ Single PostgreSQL schema (Neon via Vercel)
- ✅ All models shop-scoped for multi-tenant safety
- ✅ Prisma auto-migration in build process

---

## 🔄 Phase 2: VERIFICATION (Do This Now)

### 1. Check Vercel Deployment (5 minutes)
```bash
# Open Vercel dashboard
# Check latest deployment logs
# Verify: "Your database is now in sync with your Prisma schema"
# Verify: No migration errors
```

**Expected Output:**
```
✔ Generated Prisma Client
✔ The database is already in sync with the Prisma schema
```

**If Errors:** Check environment variables are set correctly (DATABASE_URL, SHOPIFY_API_KEY, etc.)

### 2. Verify Database Schema (2 minutes)
```bash
# In Neon dashboard or via Prisma Studio
npx prisma studio

# Check Settings table has new columns:
# - currencyCode (String?)
# - moneyFormat (String?)

# Check ML tables exist:
# - MLUserProfile
# - MLProductSimilarity  
# - MLDataRetentionJob
```

### 3. Test Currency Service (10 minutes)

**Test A: USD Store (Default)**
1. Open admin app in development store
2. Check dashboard shows "$" symbol
3. Add product to cart, verify price format
4. Check API response includes `"currency": "USD"`

**Test B: EUR Store (if available)**
1. Change test store currency to EUR in Shopify admin
2. Restart app: `npm run dev`
3. Verify dashboard shows "€" symbol
4. Check API response includes `"currency": "EUR"`

**Test C: GBP Store (if available)**
1. Change test store currency to GBP
2. Verify dashboard shows "£" symbol
3. Check recommendations show GBP prices

### 4. Test ML Recommendations (15 minutes)

**Check 1: MLProductSimilarity Data**
```sql
-- In Prisma Studio or Neon console
SELECT COUNT(*) FROM "ml_product_similarity" WHERE shop = 'your-shop.myshopify.com';

-- Should return > 0 if ML has run
-- If 0, ML hasn't computed similarities yet (expected for new stores)
```

**Check 2: Recommendation API**
```bash
# Test recommendations endpoint
curl -X POST "https://your-app.vercel.app/apps/cart-uplift/api/recommendations" \
  -H "Content-Type: application/json" \
  -d '{"shop": "your-shop.myshopify.com", "productIds": ["123456"], "cartValue": 5000}'

# Should return:
# - "source": "ml" or "shopify" or "manual"
# - "currency": store currency (not hardcoded USD)
# - "recommendations": array of products
```

**Check 3: Fallback Chain**
- ML data available → returns "source": "ml"
- No ML data → falls back to Shopify recommendations
- No Shopify data → returns manual bundles
- No bundles → returns empty array (graceful)

### 5. Multi-Tenant Safety Test (10 minutes)

**Setup:**
1. Install app on 2 different development stores
2. Note shop domains (shop1.myshopify.com, shop2.myshopify.com)

**Test:**
1. Add product to cart in shop1
2. Check database: `SELECT * FROM "tracking_events" WHERE shop = 'shop1.myshopify.com'`
3. Add product to cart in shop2
4. Verify shop2 data doesn't appear in shop1 queries
5. Check Settings table has separate rows for each shop

**Expected:** Complete data isolation between shops

---

## 🚀 Phase 3: FINAL CHECKS (Before Publishing)

### 1. Settings Validation (5 minutes)
- [ ] Open admin app → Settings page
- [ ] Verify all sections load without errors
- [ ] Toggle ML on/off → saves successfully
- [ ] Change personalization mode → applies correctly
- [ ] Set data retention period → persists in database

### 2. Theme Extension Validation (10 minutes)
- [ ] Enable app embed in theme editor
- [ ] Add product to cart
- [ ] Verify cart drawer opens
- [ ] Check recommendations appear
- [ ] Verify currency symbols match store
- [ ] Test "Add to Cart" on recommendation
- [ ] Verify free shipping bar (if enabled)

### 3. Analytics Dashboard (5 minutes)
- [ ] Navigate to admin dashboard
- [ ] Verify no console errors
- [ ] Check metrics display (may be 0 for new stores)
- [ ] Verify currency shown matches store
- [ ] Check charts render correctly

### 4. Error Handling (5 minutes)
- [ ] Test with invalid shop parameter → returns 401
- [ ] Test API without authentication → handled gracefully
- [ ] Check error logs in Vercel → no unexpected errors
- [ ] Verify catch blocks return fallback data

---

## 📋 Phase 4: GO LIVE CHECKLIST

### Pre-Launch
- [ ] All verification tests passed
- [ ] Database migrations successful
- [ ] No TypeScript errors (restart TS server if needed)
- [ ] Vercel deployment green
- [ ] Environment variables set in production
- [ ] Privacy policy updated (if needed)

### Shopify App Store Submission
- [ ] App listing updated
- [ ] Screenshots show multi-currency support
- [ ] Changelog mentions ML features
- [ ] Support email/docs ready
- [ ] Pricing model confirmed

### Monitoring Setup
- [ ] Error tracking (Sentry/Bugsnag)
- [ ] Performance monitoring (Vercel Analytics)
- [ ] Database query performance (Prisma logs)
- [ ] ML recommendation success rate tracking

---

## 🐛 TROUBLESHOOTING

### Issue: Currency shows USD instead of store currency
**Solution:** 
```bash
# Clear currency cache
# In your app code, call:
await clearCurrencyCache(shop);

# Or restart the app to clear in-memory cache
```

### Issue: MLProductSimilarity is empty
**Solution:**
```bash
# Run ML seed script to generate test data
npm run ml:seed

# Or wait for real customer activity to generate data
# Fallback chain will use Shopify recommendations in the meantime
```

### Issue: TypeScript error on mLProductSimilarity
**Solution:**
```bash
# Regenerate Prisma client
npx prisma generate

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Issue: Settings not saving
**Check:**
1. Database connection working?
2. Settings table exists?
3. Shop field matches session.shop exactly?
4. Check network tab for 400/500 errors

---

## 📞 SUPPORT READINESS

### Documentation Updated
- [ ] README.md includes currency support
- [ ] SETTINGS_REFERENCE.md current
- [ ] ML_DEPLOYMENT_GUIDE.md accurate
- [ ] API documentation reflects real endpoints

### Merchant Onboarding
- [ ] Setup wizard functional
- [ ] Default settings sensible (ML ON, balanced mode)
- [ ] Help text explains ML personalization
- [ ] Currency auto-detected on install

### Known Limitations
- ML requires minimum order history (graceful fallback)
- Currency cache: 1-hour refresh (acceptable)
- Theme extension requires manual enable in theme editor
- Analytics delayed by ~5 minutes (event processing)

---

## ✨ SUCCESS METRICS

Once live, monitor:
- **Adoption Rate:** % of merchants who enable ML
- **Recommendation CTR:** Clicks on ML vs manual recommendations
- **Revenue Impact:** Average order value lift
- **Error Rate:** < 0.1% API errors acceptable
- **Currency Accuracy:** 100% correct currency display

---

**Next Action:** Start Phase 2 verification checklist above

**Time Estimate:** 45 minutes total verification time before production-ready

**Contact:** If any verification fails, review error logs and check environment variables
