# Remaining Fixes - Production Readiness

## ✅ COMPLETED

1. **ML Recommendations Default** - Changed to `true` (ON by default)
2. **ML Personalization Mode** - Changed default from "basic" to "balanced"
3. **Currency Service Created** - `app/services/currency.server.ts`
4. **Prisma Schema Updated** - Added `currencyCode` and `moneyFormat` fields to Settings

## 🔧 IN PROGRESS - Currency Integration

### Step 1: Update Proxy Route to Fetch Shop Currency
**File:** `app/routes/apps.proxy.$.tsx`

Add at the beginning of recommendation logic (around line 400):
```typescript
// Fetch shop currency
const shopCurrency = await getShopCurrency(shop);
```

Replace line 1043:
```typescript
// BEFORE
const currency = n.priceRangeV2?.minVariantPrice?.currencyCode || 'USD';

// AFTER  
const currency = n.priceRangeV2?.minVariantPrice?.currencyCode || shopCurrency.code;
```

Add to final response:
```typescript
return json({
  products: normalizedProducts,
  currency: shopCurrency.code,
  currencyFormat: shopCurrency.format,
  // ... rest of response
});
```

### Step 2: Update API Products Route
**File:** `app/routes/api.products.tsx` (line 84)

```typescript
// BEFORE
const currencyCode = product.priceRangeV2?.minVariantPrice?.currencyCode || 'USD';

// AFTER
const shopCurrency = await getShopCurrency(shop);
const currencyCode = product.priceRangeV2?.minVariantPrice?.currencyCode || shopCurrency.code;
```

### Step 3: Update Dashboard Currency
**File:** `app/routes/admin.dashboard.tsx`

Lines 170-172:
```typescript
// BEFORE
const currency = orders.length > 0 ?
  orders[0].node.totalPriceSet?.shopMoney?.currencyCode || 'USD' : 'USD';

// AFTER
const shopCurrency = await getShopCurrency(shop);
const currency = orders.length > 0 ?
  orders[0].node.totalPriceSet?.shopMoney?.currencyCode || shopCurrency.code : shopCurrency.code;
```

Line 484 (hardcoded fallback):
```typescript
// REMOVE or UPDATE
currency: "USD", // Remove this hardcoded value
```

Line 541 (currency symbols):
```typescript
// Keep this as fallback but use getCurrencySymbol() helper instead
import { getCurrencySymbol } from "~/services/currency.server";
```

## 🔍 MOCK DATA AUDIT NEEDED

### Files to Check:

1. **`app/routes/api.customer-bundle-builder.tsx`**
   - Line 108: `description: 'Any 2 accessories - $10 off total'`
   - Line 114: `badge_text: '$10 OFF'`
   - Line 397: `badge_text: '$10 OFF'`
   - **ACTION**: Verify these are just examples in comments/docs, or make dynamic

2. **`app/routes/api.purchase-patterns.tsx`**
   - Lines 91-94: Mock customer data with hardcoded prices
   - **ACTION**: Check if this endpoint is used. If yes, replace with real data. If no, mark for removal.

## 📊 DATABASE VERIFICATION

### Run These Commands:

```bash
# Check for unused tables
npx prisma db execute --stdin <<< "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
"

# Verify ML tables exist
npx prisma db execute --stdin <<< "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('MLUserProfile', 'MLProductSimilarity', 'MLDataRetentionJob');
"

# Check for test data
npx prisma db execute --stdin <<< "
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
AND (tablename LIKE '%test%' OR tablename LIKE '%temp%' OR tablename LIKE '%sample%');
"
```

### Expected Tables (Production):
- Session
- Settings
- Bundle
- BundleProduct
- Variant (AB testing)
- Experiment
- Event  
- TrackingEvent
- BundleInsight
- MLUserProfile
- MLProductSimilarity
- MLDataRetentionJob

## 🧪 TESTING CHECKLIST

### 1. ML Settings Test
- [ ] Open settings page
- [ ] Verify "Enable ML Recommendations" is ON by default for new shops
- [ ] Toggle OFF → Save → Reload → Verify it's OFF
- [ ] Change privacy level → Save → Verify persisted
- [ ] Change recommendation strategy → Save → Verify persisted
- [ ] Check real order count displays (not "0 Orders")

### 2. Currency Test
- [ ] Test with USD store (default)
- [ ] Test with EUR store
- [ ] Test with GBP store
- [ ] Verify no hardcoded "$" symbols appear
- [ ] Check cart drawer shows correct currency
- [ ] Check recommendations show correct currency

### 3. Multi-Tenant Test
- [ ] Install app on Shop A
- [ ] Create some settings for Shop A
- [ ] Install app on Shop B
- [ ] Create different settings for Shop B
- [ ] Verify Shop A settings unchanged
- [ ] Check database: each shop has separate Settings row
- [ ] Verify TrackingEvents are shop-scoped
- [ ] Verify MLUserProfile data is shop-scoped

### 4. ML Enable/Disable Test
- [ ] Enable ML → Add products to cart → Check recommendations appear
- [ ] Disable ML → Reload cart → Check recommendations use traditional algorithm
- [ ] Re-enable ML → Verify ML recommendations return

### 5. Privacy Level Test
- [ ] Set to "basic" → Verify no TrackingEvents created
- [ ] Set to "standard" → Add to cart → Verify TrackingEvents created (no customerId)
- [ ] Set to "advanced" → Add to cart → Verify TrackingEvents include customerId

## 🚀 DEPLOYMENT STEPS

1. **Commit All Changes**
   ```bash
   git add -A
   git commit -m "fix: complete currency integration and remove mock data"
   git push origin main
   ```

2. **Vercel Will Auto-Deploy**
   - Watch build logs for `prisma db push` success
   - Verify new currencyCode/moneyFormat fields created

3. **Verify in Production**
   ```bash
   # Check new columns exist
   npx prisma db execute --stdin <<< "
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'Settings' 
   AND column_name IN ('currencyCode', 'moneyFormat');
   "
   ```

4. **Test Live**
   - Open app in Shopify store
   - Check settings page
   - Test cart drawer
   - Verify currency displays correctly
   - Test ML recommendations

## 📋 FINAL VERIFICATION

After all fixes:
- [ ] No hardcoded "USD" in any file
- [ ] No hardcoded "$" symbols (except in examples/comments)
- [ ] All ML endpoints use real data
- [ ] Settings connected to database
- [ ] Currency fetched from Shopify
- [ ] Multi-tenant support verified
- [ ] ML enable/disable works
- [ ] Privacy levels enforced
- [ ] Database clean (no test tables)

## 🎯 SUCCESS CRITERIA

- ✅ App works with any currency (USD, EUR, GBP, etc.)
- ✅ ML recommendations ON by default
- ✅ All settings persist correctly
- ✅ No mock/test data in production
- ✅ Multi-tenant support (100+ shops can use simultaneously)
- ✅ Currency symbols match store's actual currency
- ✅ ML models properly linked and functional
- ✅ Privacy controls work as expected
- ✅ Single clean production database

---

**Next Step:** Apply the currency integration fixes above, then run the testing checklist.
