# No Rule of Thumb Implementation Status (Oct 15, 2025)

## ✅ COMPLETED

### 1. Removed 30% Rule of Thumb for "Additional Revenue"
**Before:**
```typescript
const revenueFromUpsells = multiProductOrders.reduce((sum, order) => {
  return sum + (orderTotal * 0.3); // ❌ 30% guess
}, 0);
```

**After:**
```typescript
// Removed from calculatePeriodMetrics
// Now uses ONLY attributedRevenue from RecommendationAttribution table
```

**Impact:** "Additional Revenue Generated" now shows REAL tracked revenue, not estimates

### 2. Updated Metric Cards to Use Real Attribution
- ✅ "Revenue from AI Recommendations" → uses `attributedRevenue`
- ✅ "% of Revenue from Recommendations" → uses `attributedRevenue / totalRevenue` 
- ✅ "Orders with AI Recommendations" → uses `attributedOrders` (real count)

---

## ⚠️ REMAINING ISSUES TO FIX

### Priority 1: Complete Previous Period Attribution Calculation
**Problem:** Previous period metrics still reference old `revenueFromUpsells`

**Solution Needed:**
```typescript
// Calculate previous period attributed revenue from RecommendationAttribution
const previousAttributions = await db.recommendationAttribution.findMany({
  where: {
    shop: session.shop,
    createdAt: { gte: previousStartDate, lte: previousEndDate }
  }
});

const previousAttributedRevenue = previousAttributions.reduce((sum, a) => 
  sum + (a.attributedRevenue || 0), 0
);

previousMetrics.attributedRevenue = previousAttributedRevenue;
```

### Priority 2: Cart Impressions Estimate (Line 286)
**Current:**
```typescript
const cartImpressions = totalOrders > 0 ? Math.max(totalOrders * 2, totalOrders) : 0;
```

**Options:**
A. Add real cart tracking (recommended)
B. Hide metric until tracked
C. Show "Not tracked yet"

### Priority 3: Cart Opens Today Estimate (Line 869)
**Current:**
```typescript
cartOpensToday: timeframe === "today" ? Math.max(Math.floor(cartImpressions * 0.3), 0) : cartImpressions
```

**Solution:** Query real `AnalyticsEvent` records for today

### Priority 4: Remove Revenue Projections (Line 1596+)
**Current:**
```typescript
if (analytics.revenueFromUpsells > 0 && upsellPercentage < 8) {
  // "could generate X in additional revenue" suggestions
}
```

**Solution:** Remove all "could generate" projections or rewrite as data-only suggestions

### Priority 5: Free Shipping Suggestions (Line 2125)
**Current:**
```typescript
`could unlock approximately ${formatCurrency(...)} more in revenue`
```

**Solution:** Show facts without projections:
- "X orders were £Y below threshold"
- "Average cart value without free shipping: £Z"
- Let merchant draw conclusions

---

## 🎯 MERCHANT PROMISE

**Before:** Mixed real data with 30% estimates and projections

**After (Goal):** 100% real tracked data, with clear "Not tracked yet" for missing data

**Transparency:** Every number is either:
1. Real tracked data ✅
2. "Not tracked yet" ⚠️
3. Never an estimate or projection ❌

---

## 📋 NEXT STEPS

1. Calculate previous period `attributedRevenue` properly
2. Replace all remaining `revenueFromUpsells` references with `attributedRevenue`
3. Remove or fix cart impression estimates
4. Remove revenue projection suggestions
5. Test dashboard with real attribution data
6. Document what each metric means in plain language

---

## 💡 PRINCIPLE

**Never show merchants a number we're guessing at. Better to show "No data yet" than a wrong number.**

If we don't have tracking data:
- ❌ Don't estimate
- ❌ Don't project  
- ❌ Don't use rules of thumb
- ✅ Show "Enable tracking to see this metric"
- ✅ Show what we DO know
- ✅ Be transparent about limitations
