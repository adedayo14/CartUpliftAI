# 🚀 FEEDBACK LOOP IMPLEMENTATION PLAN

## ✅ Current Status: Phase 1 Started

**Committed:** Pre-purchase attribution baseline (`bb2cfed`)

---

## 📋 WHAT WE'RE BUILDING

### The Problem
- Recommendations served ✅
- Clicks tracked ✅
- BUT: No idea if they lead to sales ❌
- BUT: No learning from performance ❌
- Result: Merchants can't see ROI, recommendations don't improve

### The Solution
**3-Phase Feedback Loop:**
1. **Attribution** → Know what converts
2. **Learning** → Auto-improve from data  
3. **Application** → Use insights in real-time

---

## 🎯 PHASE 1: PURCHASE ATTRIBUTION (Days 1-3)

### Step 1: Webhook Handler ✅ DONE
**File:** `app/routes/webhooks.orders.create.tsx`

**What it does:**
1. Receives order data when customer checks out
2. Extracts purchased product IDs
3. Looks up recommendations shown in last 7 days
4. Matches purchases to recommendations
5. Creates attribution records with revenue
6. Updates user profiles with purchase data

**Key Features:**
- 7-day attribution window
- Revenue tracking per product
- Conversion time tracking
- **Missed opportunity learning** (learns from what they bought INSTEAD)

---

### Step 2: Webhook Registration ✅ DONE
**File:** `app/shopify.server.ts`

**Change:**
```typescript
webhooks: {
  ORDERS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/orders/create",
  },
}
```

**Result:** Shopify will call our webhook every time an order is created.

---

### Step 3: Database Models ✅ DONE
**File:** `prisma/schema.prisma`

**New Models:**

#### `RecommendationAttribution`
Tracks which recommendations led to actual sales.

Fields:
- `productId` - What was bought
- `orderId` - Which order
- `attributedRevenue` - $ from this product
- `conversionTimeMinutes` - How long from rec → purchase
- `recommendationEventIds` - Links back to tracking events

#### `MLProductPerformance`
Daily aggregated performance metrics per product.

Fields:
- `impressions` - Times shown
- `clicks` - Times clicked
- `purchases` - Times bought
- `ctr` - Click-through rate
- `cvr` - Conversion rate
- `confidence` - Score 0-1 (used for filtering)
- `isBlacklisted` - Auto-flagged if consistently poor

---

### Step 4: Daily Learning Job ⏳ TODO
**File:** `app/jobs/daily-learning.server.ts` (to create)

**What it will do:**
1. Query last 30 days of data:
   - Tracking events (impressions/clicks)
   - Attribution records (purchases)
2. For each product, calculate:
   - CTR = clicks / impressions
   - CVR = purchases / impressions
   - Confidence = weighted score
3. Apply rules:
   - CVR < 0.5% after 100+ shows → Blacklist
   - CVR > 2% → Boost confidence
4. Update `MLProductPerformance` table

**Cron Schedule:** Daily at 2 AM

---

### Step 5: Apply Learning to Recommendations ⏳ TODO
**File:** `app/routes/apps.proxy.$.tsx` (modify ~line 900)

**What to add:**
```typescript
// Before returning recommendations...

// 1. Load performance data
const performance = await prisma.mLProductPerformance.findMany({
  where: { shop, productId: { in: candidateIds } }
});

// 2. Filter blacklisted
recommendations = recommendations.filter(rec => {
  const perf = performance.find(p => p.productId === rec.id);
  return !perf || !perf.isBlacklisted;
});

// 3. Adjust scores based on confidence
for (const rec of recommendations) {
  const perf = performance.find(p => p.productId === rec.id);
  if (perf) {
    if (perf.confidence > 0.7) rec.score *= 1.3; // 30% boost
    else if (perf.confidence < 0.3) rec.score *= 0.7; // 30% penalty
  }
}

// 4. Re-sort by adjusted scores
recommendations.sort((a, b) => b.score - a.score);
```

**Result:** Bad products automatically filtered, good ones promoted.

---

## 🎯 PHASE 2: STRENGTHEN ML (Days 4-5)

### Step 6: Similarity Computation Job ⏳ TODO
**File:** `app/jobs/compute-similarities.server.ts` (to create)

**Purpose:** Fill `MLProductSimilarity` table with real co-purchase data

**Process:**
1. Fetch last 200 orders from Shopify
2. Build co-occurrence matrix:
   ```
   Product A bought with Product B: 45 times
   Product A bought with Product C: 23 times
   ```
3. Compute similarity scores:
   - Jaccard: intersection / union
   - Support: raw co-occurrence count
4. Store top 50 similar products per product

**Why:** Currently collaborative filtering is partially empty. This fills it with real store data.

---

### Step 7: User Profile Auto-Update ⏳ TODO
**File:** `app/services/user-profile.server.ts` (to create)

**Purpose:** Automatically update user profiles from tracking events

**Trigger Points:**
- Product viewed → Add to `viewedProducts`
- Product clicked → Add to `cartedProducts`  
- Order created (webhook) → Add to `purchasedProducts`

**Why:** Personalization requires user history. Currently partially manual.

---

## 🎯 PHASE 3: POLISH (Days 6-7)

### Step 8: Performance Monitoring ⏳ TODO
**File:** `app/jobs/health-check.server.ts` (to create)

**Alerts:**
- CVR drops below 0.5% → Email alert
- Error rate spikes → Slack notification
- No recommendations served in 24h → Alert

---

## 📊 SUCCESS METRICS

### Week 1 Goals (Post-Implementation):
- ✅ Attribution tracking working (check logs for "Attribution complete")
- ✅ Daily learning job runs (check MLProductPerformance table)
- ✅ At least 3 products blacklisted (if poor performance)
- ✅ CVR improves by 0.2-0.5% (from auto-optimization)

### Week 2 Goals:
- ✅ Similarity computation running (check MLProductSimilarity table)
- ✅ User profiles auto-updating (check MLUserProfile table)
- ✅ Response time < 200ms (with Redis caching)

### Week 3 Goals:
- ✅ Monitoring alerts working
- ✅ No manual intervention needed
- ✅ System self-improving automatically

---

## 🚨 CRITICAL NEXT STEPS

### IMMEDIATE (Next 2 hours):
1. ✅ Push webhook + schema changes
2. ⏳ Run database migration: `npx prisma db push`
3. ⏳ Test webhook locally with Shopify CLI
4. ⏳ Create daily-learning.server.ts
5. ⏳ Create scheduler.server.ts (cron setup)

### TODAY (Next 4 hours):
6. ⏳ Implement daily learning job
7. ⏳ Apply learning to recommendations
8. ⏳ Test end-to-end: recommendation → purchase → attribution → learning

### THIS WEEK:
9. ⏳ Similarity computation job
10. ⏳ User profile auto-update
11. ⏳ Performance monitoring

---

## 💡 KEY INSIGHTS FROM REVIEW

### What the reviewer got RIGHT:
1. ✅ Purchase attribution is #1 priority
2. ✅ Daily learning prevents stagnation
3. ✅ Need similarity computation (currently partial)
4. ✅ Need user profile auto-update (currently partial)
5. ✅ Dashboard showing ROI prevents churn

### What we ALREADY have:
1. ✅ ML recommendation serving
2. ✅ Privacy levels working
3. ✅ A/B testing infrastructure
4. ✅ Impression/click tracking
5. ✅ Basic dashboard structure

### What's MISSING (now being fixed):
1. ❌ Purchase attribution → IMPLEMENTING NOW
2. ❌ Daily learning → NEXT STEP
3. ❌ Auto-correction → NEXT STEP

---

## 🎯 SIMPLIFIED EXPLANATION

**Before (Current):**
```
Show recommendation → Track impression → Track click → ??? 
(Never know if it led to sale)
```

**After (With Feedback Loop):**
```
Show recommendation → Track impression → Track click → Track purchase → Learn performance → Adjust recommendations → Better results
```

**Example:**
```
Day 1: Recommend iPhone Case (Score: 0.8)
Week 1: 100 shown, 3 clicked, 0 bought (CVR: 0%)
Week 2: Confidence drops to 0.2 → System auto-reduces recommendations
Week 3: iPhone Case rarely shown anymore

Day 1: Recommend AirPods (Score: 0.8)
Week 1: 100 shown, 30 clicked, 15 bought (CVR: 15%)
Week 2: Confidence rises to 0.9 → System auto-boosts recommendations
Week 3: AirPods shown 2x more often
```

**Result:** System learns which products actually sell and adjusts automatically.

---

## 📝 TESTING CHECKLIST

### After Phase 1 Complete:
- [ ] Webhook receives order events
- [ ] Attribution records created in database
- [ ] Daily learning job runs successfully
- [ ] Bad products get blacklisted
- [ ] Good products get confidence boost
- [ ] Recommendations change based on performance

### Validation Queries:
```sql
-- Check attribution is working
SELECT * FROM recommendation_attributions WHERE shop = 'your-shop.myshopify.com' ORDER BY createdAt DESC LIMIT 10;

-- Check learning is working
SELECT * FROM ml_product_performance WHERE shop = 'your-shop.myshopify.com' ORDER BY confidence DESC LIMIT 20;

-- Check blacklisting is working
SELECT * FROM ml_product_performance WHERE isBlacklisted = true;
```

---

## 🎉 IMPACT PREDICTION

### Current State:
- Random recommendations
- No improvement over time
- Merchants can't see value
- High churn risk

### After Implementation:
- Smart recommendations (learn from sales)
- Auto-improvement daily
- Clear ROI visibility
- Retention boost

**Expected Improvements:**
- CVR: +0.5-1.0% (from optimization)
- Revenue/user: +15-25% (from better targeting)
- Merchant retention: +30-40% (from visible ROI)

---

**Status:** Phase 1 in progress. Webhook + schema ready. Next: Daily learning job + application logic.
