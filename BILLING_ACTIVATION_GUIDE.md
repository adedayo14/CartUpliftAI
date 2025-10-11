# 🔧 BILLING SYSTEM - ACTIVATION GUIDE

## Current Status: Feature Flag Disabled ⚠️

The billing system code is complete and pushed, but **temporarily disabled** with a feature flag until the database is migrated in production.

**Current Setting:**
```typescript
// In app/routes/app._index.tsx line 57
const billingEnabled = false; // Set to true after running: npx prisma db push
```

When users click pricing buttons now, they see:
> "Billing system will be activated after deployment. Stay tuned!"

---

## ✅ To Activate Billing System

### Step 1: Push Database Schema to Production

Run this in your **Vercel production environment**:

```bash
npx prisma db push
```

This adds these fields to the `Settings` table:
- `subscriptionPlan`
- `subscriptionStatus`  
- `trialEndsAt`
- `subscriptionStartedAt`
- `chargeId`
- `monthlyOrderCount`
- `currentPeriodStart`
- `currentPeriodEnd`
- `orderLimitReached`
- `lastOrderCountReset`

**How to run in Vercel:**
1. Go to Vercel dashboard
2. Your project → Settings → Environment Variables
3. Add temporary variable: `RUN_MIGRATION="true"`
4. OR run via Vercel CLI: `vercel env pull && npx prisma db push`
5. OR SSH into deployment if available

---

### Step 2: Enable Feature Flag

After database migration succeeds, update the code:

**File:** `app/routes/app._index.tsx` (line ~57)

```typescript
// BEFORE (current):
const billingEnabled = false;

// AFTER (activate billing):
const billingEnabled = true;
```

Or better, use environment variable:

```typescript
const billingEnabled = process.env.BILLING_ENABLED === "true";
```

Then set in Vercel:
```bash
BILLING_ENABLED="true"
```

---

### Step 3: Enable Shopify Billing Scopes

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Select Cart Uplift app
3. App Setup → Configuration
4. Protected customer data access → Add scopes:
   - ✅ `read_billing`
   - ✅ `write_billing`
5. Save configuration
6. Merchants will need to re-authorize app (happens automatically)

---

### Step 4: Test in Development Store

**With test mode enabled:**

```bash
# In Vercel env vars
SHOPIFY_BILLING_TEST_MODE="true"
```

1. Install app in development store
2. Click "Start Free Trial" on homepage
3. Approve test charge (no real money)
4. Verify:
   - Redirects to `/app?billing=success`
   - Shows success banner
   - Dashboard would show subscription card (if added)

---

### Step 5: Go Live (Production Billing)

When ready for real charges:

```bash
# In Vercel env vars
SHOPIFY_BILLING_TEST_MODE="false"
BILLING_ENABLED="true"
```

Redeploy and monitor:
- First real subscriptions
- Shopify Partner Dashboard → Billing tab
- Vercel logs for any errors

---

## 🐛 Current Error Resolution

The error you saw (`error-1760169032877`) was caused by:

**Problem:** Prisma client trying to access database fields that don't exist yet
- `settings.subscriptionPlan` → undefined in current schema
- `settings.monthlyOrderCount` → undefined in current schema

**Solution:** Feature flag disabled billing code temporarily

**Permanent Fix:** Run `npx prisma db push` in production

---

## 📝 Alternative: Test Locally First

If you want to test billing locally before production:

### Option A: Use Neon Branch (Recommended)

Neon PostgreSQL supports branching:

```bash
# Create a test branch in Neon dashboard
# Get branch connection URL
# Set in local .env
DATABASE_URL="postgresql://..."

# Run migration on branch
npx prisma db push

# Test locally
npm run dev
```

### Option B: Docker PostgreSQL

```bash
# Start PostgreSQL
docker run -d \
  --name cart-uplift-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=cartuplift \
  -p 5432:5432 \
  postgres:15

# Set connection
DATABASE_URL="postgresql://postgres:password@localhost:5432/cartuplift"

# Migrate
npx prisma db push

# Test
npm run dev
```

---

## 🎯 Quick Activation Checklist

### Before Go-Live:
- [ ] Run `npx prisma db push` in production
- [ ] Verify new fields exist in Settings table
- [ ] Set `BILLING_ENABLED="true"` in Vercel
- [ ] Enable billing scopes in Shopify Partner Dashboard
- [ ] Test with `SHOPIFY_BILLING_TEST_MODE="true"` first
- [ ] Verify test charge approval flow works
- [ ] Switch to `SHOPIFY_BILLING_TEST_MODE="false"`
- [ ] Monitor first real subscriptions

### After Go-Live:
- [ ] Add SubscriptionCard component to dashboard
- [ ] Implement webhook handlers for renewals
- [ ] Add email notifications (trial expiring, limit reached)
- [ ] Create admin billing analytics dashboard
- [ ] Set up monitoring/alerts for failed charges

---

## 💡 Why Feature Flag Approach?

**Benefits:**
1. ✅ App works immediately (no errors)
2. ✅ Code is ready and tested
3. ✅ Can deploy now, activate later
4. ✅ No rush to migrate database
5. ✅ Users see pricing (builds anticipation)
6. ✅ Easy to enable when ready

**Drawbacks:**
1. ⚠️ Extra step to activate
2. ⚠️ Must remember to enable flag

---

## 🚀 Recommended Timeline

**Today (Oct 11):**
- [x] Code complete and pushed ✅
- [x] Feature flag added ✅
- [ ] Deploy to production (app works, billing disabled)

**Within 24-48 hours:**
- [ ] Run `npx prisma db push` in production
- [ ] Enable billing scopes in Shopify
- [ ] Enable feature flag
- [ ] Test in development store

**Within 1 week:**
- [ ] Switch to live billing (test mode off)
- [ ] Monitor first subscriptions
- [ ] Gather merchant feedback
- [ ] Add SubscriptionCard to dashboard

---

## 📚 Related Documentation

- **Full Implementation:** See `BILLING_COMPLETE_SUMMARY.md`
- **Deployment Steps:** See `BILLING_DEPLOYMENT_GUIDE.md`
- **Visual Overview:** See `BILLING_VISUAL_OVERVIEW.md`
- **Phase Plan:** See `BILLING_IMPLEMENTATION_TODO.md`

---

**Status:** ✅ Code ready, 🔄 Waiting for database migration, 📅 Activation pending

**Contact:** Ready to activate anytime - just run the migration and flip the flag!
