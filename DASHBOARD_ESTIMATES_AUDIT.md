# Dashboard Estimates & Rule of Thumb Audit (Oct 15, 2025)

## 🎯 Objective
Remove ALL estimates, approximations, and rule-of-thumb calculations. Only show REAL tracked data to merchants.

---

## ❌ PROBLEMS FOUND

### 1. **"Additional Revenue Generated" (Line 247-253)**
**Current Calculation:**
```typescript
const revenueFromUpsells = multiProductOrders.reduce((sum, order) => {
  const orderTotal = parseFloat(order.node.totalPriceSet.shopMoney.amount);
  if (lineItems.length > 1) {
    return sum + (orderTotal * 0.3); // 30% attribution to upselling ❌ RULE OF THUMB
  }
  return sum;
}, 0);
```

**Problem:** Assumes 30% of multi-product orders is due to upselling - completely arbitrary!

**Solution:** Use ONLY `attributedRevenue` from `RecommendationAttribution` table
- Only count products that were recommended → clicked → purchased
- If no attribution data, show £0 (not an estimate)

---

### 2. **Cart Impressions (Line 286)**
**Current Calculation:**
```typescript
const cartImpressions = totalOrders > 0 ? Math.max(totalOrders * 2, totalOrders) : 0; 
// ❌ "Conservative estimate: 2 cart views per order"
```

**Problem:** Multiplying orders by 2 is a guess, not real data!

**Solution:** 
- Track REAL cart opens via `AnalyticsEvent` table with `eventType: 'cart_open'`
- If no tracking data exists yet, show "Not tracked yet" or hide the metric
- **NEVER** show an estimate

---

### 3. **Cart Opens Today (Line 876)**
**Current Calculation:**
```typescript
cartOpensToday: timeframe === "today" ? Math.max(Math.floor(cartImpressions * 0.3), 0) : cartImpressions
// ❌ Assumes 30% of cart impressions happen "today"
```

**Problem:** Another 30% guess!

**Solution:**
- Query `AnalyticsEvent` for `eventType: 'cart_open'` filtered by today's date
- Real count or don't show it

---

### 4. **Setup Suggestions with Revenue Projections (Line 1619)**
**Current Calculation:**
```typescript
description: `With ${analytics.totalOrders} orders, product recommendations could generate ${formatCurrency(analytics.totalRevenue * 0.15)} in additional revenue.`
// ❌ "could generate" + 15% multiplier
```

**Problem:** Pure speculation ("could generate 15% more")

**Solution:**
- Remove revenue projections entirely
- Show fact-based suggestions: "Turn on recommendations to start tracking their impact"
- OR show industry benchmarks with clear disclaimers: "Apps like this typically see X-Y% increase"

---

### 5. **Free Shipping Threshold Suggestions (Line 2125)**
**Current Calculation:**
```typescript
`Lowering it to ${formatCurrency(Math.round(analytics.freeShippingThreshold * 0.8))} 
could unlock approximately ${formatCurrency(Math.round(analytics.avgAOVWithoutFreeShipping * analytics.ordersWithoutFreeShipping * 0.3))} more in revenue.`
// ❌ Multiple guesses: 0.8x threshold, 30% conversion improvement
```

**Problem:** Stacking estimates on top of estimates!

**Solution:**
- Show data-driven suggestion: "X orders were close to threshold but didn't reach it"
- Calculate average gap: "Average cart value was £Y below threshold"
- Let merchant make their own projection - just provide the facts

---

### 6. **Cart Abandonment Rate (Line 895)**
**Current Calculation:**
```typescript
cartAbandonmentRate: cartToCheckoutRate > 0 ? 100 - cartToCheckoutRate : 0
```

**Problem:** Based on estimated `cartImpressions`, so it's estimate-based

**Solution:**
- Use REAL tracking: Count `cart_open` events vs `checkout_started` events
- If no data, show "Not tracked yet"

---

## ✅ WHAT'S ALREADY GOOD (Keep These!)

### 1. **Total Store Revenue**
```typescript
totalRevenue = orders.reduce((sum, order) => 
  sum + parseFloat(order.node.totalPriceSet.shopMoney.amount), 0
);
```
✅ **REAL** - Directly from Shopify orders

---

### 2. **Average Order Value**
```typescript
averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
```
✅ **REAL** - Calculated from actual orders

---

### 3. **Revenue from AI Recommendations** (After our fix!)
```typescript
attributedRevenue = attributions.reduce((sum, a) => 
  sum + (a.attributedRevenue || 0), 0
);
```
✅ **REAL** - Tracked recommendations → clicks → purchases

---

### 4. **Top Products**
```typescript
topProducts = orders.forEach(order => {
  // Count actual product sales from real orders
});
```
✅ **REAL** - From actual order line items

---

### 5. **Free Shipping Analysis**
```typescript
ordersWithFreeShipping = orders.filter(order => 
  order.node.totalDiscountsSet?.shopMoney?.amount?.includes('FREE_SHIPPING')
).length;
```
✅ **REAL** - From actual order discount data

---

## 🔧 FIXES REQUIRED

### Priority 1: Remove "Additional Revenue Generated" Estimate

**Current:** Shows `revenueFromUpsells` (30% of multi-product orders)

**Replace with:** `attributedRevenue` (real tracked revenue)

**Change:**
```typescript
// ❌ DELETE THIS
const revenueFromUpsells = multiProductOrders.reduce((sum, order) => {
  return sum + (orderTotal * 0.3); // REMOVE
}, 0);

// ✅ USE THIS INSTEAD
// Already calculated: attributedRevenue from RecommendationAttribution table
// Just use analytics.attributedRevenue everywhere
```

**Impact:** The "Additional Revenue Generated" card will show REAL tracked revenue, not 30% guess

---

### Priority 2: Fix Cart Impressions

**Option A: Add Real Tracking** (Recommended)
```typescript
// Frontend: Track cart opens
CartAnalytics.trackEvent('cart_open', { source: 'drawer' });

// Backend: Query real cart opens
const cartOpenEvents = await db.analyticsEvent.count({
  where: {
    shop: session.shop,
    eventType: 'cart_open',
    timestamp: { gte: startDate, lte: endDate }
  }
});
```

**Option B: Hide Until Tracked**
```typescript
// Don't show cart metrics if we don't have real data
const hasCartTracking = cartOpenEvents.length > 0;
if (!hasCartTracking) {
  // Hide cart conversion card or show "Enable cart tracking"
}
```

---

### Priority 3: Remove Speculative Suggestions

**Current:**
- "could generate £X in additional revenue" ❌
- "unlock approximately £Y more" ❌

**Replace with:**
- "Start tracking to measure impact" ✅
- "X orders had 2+ products (possible upsells)" ✅
- "Average cart value was £Y" (just the fact) ✅

---

## 📊 RECOMMENDED DASHBOARD STRUCTURE

### Tier 1: Always Show (Real Data Only)
- Total Orders
- Total Revenue  
- Average Order Value
- Revenue from AI Recommendations (`attributedRevenue`)
- Orders with AI Recommendations (`attributedOrders`)
- ROI (if app cost is set)

### Tier 2: Show When Data Available
- Cart Conversion Rate (if cart tracking enabled)
- Click-Through Rate (if recommendation tracking has data)
- Top Attributed Products (if attributions exist)
- Free Shipping Impact (if free shipping enabled)

### Tier 3: Never Show
- Any calculations with arbitrary multipliers (0.3, 0.15, 0.8, etc.)
- "Could generate" or "approximately" projections
- Estimated daily impressions
- Rule-of-thumb attributions

---

## 🚀 IMPLEMENTATION PLAN

### Phase 1: Remove Estimates (Immediate)
1. Replace `revenueFromUpsells` with `attributedRevenue` everywhere
2. Remove cart impression estimates
3. Remove revenue projection suggestions
4. Change any "approximately" wording to "based on X data points"

### Phase 2: Add Real Tracking (Next)
1. Add `cart_open` event tracking in theme extension
2. Add `cart_close` event tracking
3. Query real events for cart metrics
4. Show "No data yet" for missing metrics

### Phase 3: Improve Suggestions (Later)
1. Data-driven bundle suggestions (already real!)
2. Fact-based threshold recommendations
3. Show gaps/opportunities without projections
4. Let merchants draw their own conclusions from facts

---

## ⚠️ IMPOSSIBLE TO TRACK (Limitations)

### What CAN'T Be Perfectly Tracked:
1. **Causation** - We can track correlation (recommended → clicked → purchased) but not prove it CAUSED the sale
2. **Counterfactuals** - We'll never know if customer would've bought anyway
3. **External factors** - Marketing campaigns, seasonality, etc.

### How to Handle:
- Be transparent: "Products recommended AND clicked AND purchased"
- Show correlation data, let merchant interpret
- Compare periods with/without recommendations enabled
- Never claim "you made £X because of us" - show "£X came from recommended products"

---

## 💡 FINAL RECOMMENDATION

**Remove ALL of these immediately:**
1. ❌ `orderTotal * 0.3` (30% attribution)
2. ❌ `totalOrders * 2` (cart impressions estimate)
3. ❌ `cartImpressions * 0.3` (cart opens today)
4. ❌ `totalRevenue * 0.15` (could generate)
5. ❌ `threshold * 0.8` (suggested threshold)
6. ❌ `orders * 0.3` (unlock revenue)

**Replace with:**
1. ✅ `attributedRevenue` (real tracked revenue)
2. ✅ Real event counts from `AnalyticsEvent` table
3. ✅ "No data yet" when tracking not available
4. ✅ Facts without projections
5. ✅ Data-driven suggestions
6. ✅ Clear disclaimers on any estimates

**Merchant Promise:**
*"Every number you see is from real tracking. If we don't have data, we'll tell you. No guesses, no approximations, no rule-of-thumb calculations."*
