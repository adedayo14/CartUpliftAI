# Billing System - Production Deployment Guide

## 🚀 Quick Deployment Steps

### Step 1: Database Migration (Vercel/Neon)
Since you're using Vercel with Neon PostgreSQL, the database is already connected via environment variables.

**Run this command in your production environment:**
```bash
# From Vercel dashboard or CLI
npx prisma db push
```

This will add these new fields to your `Settings` table:
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

**No migration files needed** - Prisma handles schema sync automatically.

---

### Step 2: Environment Variables
Add to Vercel environment variables:

```bash
# Billing Configuration
SHOPIFY_BILLING_TEST_MODE="false"  # Use "true" for testing first!

# App URL (already set, but verify)
SHOPIFY_APP_URL="https://your-app-name.vercel.app"
```

**How to add:**
1. Go to Vercel dashboard
2. Select your project
3. Settings → Environment Variables
4. Add variables above
5. Redeploy app

---

### Step 3: Shopify Partner Dashboard Setup

#### Enable Billing Scope
1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Select your app
3. App Setup → Configuration
4. API access → Add `read_billing` and `write_billing` scopes
5. Save

#### Configure App URLs
Verify these URLs in Shopify Partner Dashboard:
- **App URL:** `https://your-app.vercel.app`
- **Allowed redirection URLs:** 
  - `https://your-app.vercel.app/api/billing/confirm`
  - `https://your-app.vercel.app/auth/callback`
  - `https://your-app.vercel.app/auth/shopify/callback`

---

### Step 4: Test in Development Store

**IMPORTANT:** Test with `SHOPIFY_BILLING_TEST_MODE="true"` first!

1. **Install app** in development store
2. **Check trial setup:**
   - Should see 14-day trial status
   - Dashboard should show subscription card
3. **Test subscription flow:**
   ```
   Homepage → Click "Start Free Trial" (Starter)
   → Shopify approval page
   → Approve (test charge, no real money)
   → Redirect back to app
   → See success banner
   → Dashboard shows active subscription
   ```
4. **Test order limits:**
   ```
   Manually increment order count to 499
   → Dashboard shows warning (80% used)
   Increment to 500
   → Dashboard shows "limit reached"
   → Try checkout (should be blocked)
   ```
5. **Test upgrade:**
   ```
   Click "Upgrade to Growth"
   → Approve in Shopify
   → Limit increases to 2,000
   → Order count resets (optional logic)
   ```

---

### Step 5: Go Live

Once testing passes:

1. **Set production mode:**
   ```bash
   SHOPIFY_BILLING_TEST_MODE="false"
   ```
2. **Redeploy from Vercel** or push to trigger auto-deploy
3. **Monitor first subscriptions:**
   - Check Vercel logs
   - Check Shopify Partner Dashboard → Billing
4. **Verify charges appear** in Shopify billing dashboard

---

## 🔧 Troubleshooting

### Issue: "Database field not found" errors
**Solution:** Run `npx prisma db push` in production environment

### Issue: Billing buttons don't work
**Solution:** 
1. Check browser console for errors
2. Verify `SHOPIFY_APP_URL` is correct
3. Check billing scopes enabled in Shopify

### Issue: Redirect loop after approval
**Solution:**
1. Verify `returnUrl` in billing config
2. Check allowed redirect URLs in Shopify Partner Dashboard

### Issue: Orders not counting
**Solution:**
1. Check `api.cart-tracking.tsx` is being called
2. Verify `eventType === "checkout_initiated"` logic
3. Check database `monthlyOrderCount` field

---

## 📊 Monitoring After Launch

### Metrics to Watch (First Week)
- Total subscriptions created
- Trial conversions to paid
- Order limit warnings triggered
- Order limit blocks (403 errors)
- Average order count per merchant

### Vercel Logs
Monitor these routes:
```bash
/api/billing/subscribe    # Subscription creation
/api/billing/confirm      # Subscription confirmation
/api/cart-tracking        # Order counting
/api/order-usage          # Dashboard widget
```

### Shopify Partner Dashboard
Check:
- Recurring charges created
- Charge status (active/declined/pending)
- Revenue per merchant

---

## 🎯 Success Criteria

**Week 1 Goals:**
- ✅ 10+ merchants install app
- ✅ 30%+ trial → paid conversion
- ✅ Zero billing errors in logs
- ✅ All 3 plans have subscribers

**Month 1 Goals:**
- ✅ 100+ active subscriptions
- ✅ <5% churn rate
- ✅ Average plan: Growth ($79/mo)
- ✅ 50%+ upgrade from Starter

---

## 🔐 Security Notes

1. **Never expose billing API keys** - Already handled via Shopify App Bridge
2. **Validate all plan tiers** - `isValidPlan()` function checks this
3. **Verify charge IDs** - Always query Shopify before activating
4. **Test mode in dev only** - Production should use real charges

---

## 📞 Support Preparation

### Common Merchant Questions

**Q: How do I upgrade my plan?**
A: Go to homepage, click the upgrade button, approve in Shopify.

**Q: What happens if I reach my order limit?**
A: Checkout will be blocked with upgrade prompt. Upgrade anytime to continue.

**Q: Can I downgrade?**
A: Yes, downgrade takes effect at end of current billing period.

**Q: Do I get refunded if I cancel?**
A: Shopify handles refunds per their policy. App access continues until period end.

**Q: How is the 14-day trial counted?**
A: From install date, full access to all features, no charge until trial ends.

---

## 🚦 Deployment Checklist

Before going live, verify:

- [ ] Database migrated (`npx prisma db push`)
- [ ] Environment variables set in Vercel
- [ ] Billing scopes enabled in Shopify
- [ ] Redirect URLs configured
- [ ] Test mode tested successfully
- [ ] Production mode enabled
- [ ] Monitoring/alerts configured
- [ ] Support docs prepared
- [ ] Pricing page updated on marketing site
- [ ] Announcement ready for merchants

---

## 📝 Rollback Plan

If major issues occur:

1. **Disable billing temporarily:**
   ```bash
   # In Vercel env vars
   SHOPIFY_BILLING_ENABLED="false"
   ```
2. **Revert to trial mode for all:**
   ```sql
   UPDATE "Settings" 
   SET "subscriptionStatus" = 'trial', 
       "trialEndsAt" = NOW() + INTERVAL '30 days';
   ```
3. **Contact active subscribers** with explanation
4. **Fix issues** in development
5. **Redeploy** once resolved

---

## 🎉 Post-Launch Tasks

After successful deployment:

1. **Announce to merchants** (email/in-app banner)
2. **Update marketing site** with pricing
3. **Create help docs** for billing
4. **Set up email notifications** (Phase 10)
5. **Add webhook handlers** for automation
6. **Implement usage analytics** dashboard
7. **Create admin billing dashboard** for you to monitor

---

**Deployment Time Estimate:** 30-60 minutes
**Testing Time Estimate:** 2-3 hours
**Go-Live Confidence:** HIGH ✅

Good luck with the launch! 🚀
