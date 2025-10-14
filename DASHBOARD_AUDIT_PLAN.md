# Dashboard Audit & Fix Plan

## ✅ Step 1: COMPLETED - Reverted to Clean Baseline
- Reverted to commit `435fb126ecf6e1ca202feadcc304481c4f5e2435`
- Ready to audit data flow with clean codebase

---

## 📊 Step 2: LOW HANGING FRUIT - Audit All Dashboard Sections

### **Database Schema Analysis** (Prisma)

The following tables exist and are relevant to dashboard metrics:

1. **`TrackingEvent`** - Tracks recommendations shown/clicked
   - Fields: `event`, `productId`, `productTitle`, `revenueCents`, `orderId`, `source`, `sessionId`
   - Used for: impressions, clicks, CTR

2. **`RecommendationAttribution`** - Links recommendations to purchases
   - Fields: `productId`, `orderId`, `orderValue`, `attributedRevenue`, `recommendationEventIds`
   - Used for: AI recommendation revenue tracking

3. **`MLProductPerformance`** - Product-level ML metrics
   - Fields: `productId`, `impressions`, `clicks`, `purchases`, `revenue`, `ctr`, `cvr`, `confidence`
   
4. **`MLSystemHealth`** - ML job execution tracking
   - Used for: Last updated timestamp, system status

---

### **SECTION-BY-SECTION AUDIT FINDINGS**

### 1. ✅ **Dashboard Metrics** (Top Summary Cards)
**Location**: Lines 1177-1249

**Current Calculation**:
```typescript
totalOrders: Fetched from Shopify GraphQL (REAL)
totalRevenue: Sum of order.totalPriceSet.shopMoney.amount (REAL)
averageOrderValue: totalRevenue / totalOrders (REAL)
cartToCheckoutRate: (totalOrders / cartImpressions) * 100
```

**ISSUE FOUND**:
- `cartImpressions` is **ESTIMATED**: `totalOrders * 2` (line 265)
- This makes `cartToCheckoutRate` unreliable

**STATUS**: ⚠️ **PARTIALLY ACCURATE** - Core metrics are real, but cart metrics are estimates

---

### 2. ⚠️ **Smart Insights** 
**Location**: Lines 1177-1249 (insights object)

**Current Calculation**:
```typescript
// Line 1211: Average Conversion Rate
value: (topUpsells.reduce(sum of conversionRate) / topUpsells.length).toFixed(1)
previousValue: value * 0.85  // ❌ FAKE - just 85% of current
changePercent: 18  // ❌ HARDCODED

// Line 1232: Revenue per Click
value: revenueFromUpsells / topUpsells.reduce(sum of clicks)
previousValue: value * 0.85  // ❌ FAKE - just 85% of current
changePercent: 12  // ❌ HARDCODED
```

**ISSUES FOUND**:
1. ❌ `previousValue` is **FAKE** - calculated as 85% of current value
2. ❌ `changePercent` is **HARDCODED** (18%, 12%)
3. ❌ No real historical comparison data

**STATUS**: ❌ **MOCK DATA** - Comparison values and trends are fabricated

---

### 3. ⚠️ **Top Performing Products**
**Location**: Lines 341-369

**Current Calculation**:
```typescript
// Real data from Shopify orders
productStats = Map of {
  title: { orders, revenue, quantity }  // From lineItems
}
topProducts = productStats sorted by revenue
```

**STATUS**: ✅ **ACCURATE** - Uses real Shopify order line items

---

### 4. ❌ **Upsell Performance Analytics** (The $54,872 Table)
**Location**: Lines 372-404

**Current Calculation**:
```typescript
topUpsells = topProducts.slice(0, 6).map(product => {
  // ESTIMATED impressions based on order frequency
  estimatedDailyImpressions = Math.max(dailyOrders * 15, 10)  // ❌ FAKE
  totalImpressions = estimatedDailyImpressions * daysInPeriod  // ❌ FAKE
  
  // ESTIMATED clicks based on performance ratio
  estimatedCTR = Math.max(0.05, 0.15 * productPerformanceRatio)  // ❌ FAKE
  clicks = totalImpressions * estimatedCTR  // ❌ FAKE
  
  // REAL conversions
  conversions = product.orders  // ✅ REAL
  
  // Revenue is REAL
  revenue = product.revenue  // ✅ REAL
})
```

**CRITICAL ISSUE**:
- **Revenue ($54,872) is REAL** - from actual Shopify orders
- **Impressions/Clicks are FAKE** - completely estimated/calculated
- This creates the **"Hi top calf leather" row with $54,872** but fake interaction data

**STATUS**: ❌ **MIXED FAKE/REAL** - Revenue is real, but impressions/clicks are fabricated estimates

---

### 5. ⚠️ **Recommendation Performance Over Time**
**Location**: Lines 459-503

**Current Calculation**:
```typescript
events = await db.trackingEvent.findMany({ shop, date range })
impressions = events.filter(e => e.event === 'impression').length
clicks = events.filter(e => e.event === 'click').length

// Build daily series
byDay[date] = { imp: count, clk: count }
```

**STATUS**: ✅ **ACCURATE IF DATA EXISTS** - Uses real TrackingEvent table
- BUT: Will show zeros if no tracking events recorded

---

### 6. ⚠️ **Most Popular Recommendations**
**Location**: Lines 505-518

**Current Calculation**:
```typescript
byProduct[productId] = {
  imp: count of 'impression' events,
  clk: count of 'click' events,
  rev: sum of revenueCents
}
```

**STATUS**: ✅ **ACCURATE IF DATA EXISTS** - Uses real TrackingEvent table
- BUT: Will show empty if no tracking events recorded

---

### 7. ✅ **Smart Bundle Opportunities**
**Location**: Lines 407-451

**Current Calculation**:
```typescript
// Real co-occurrence analysis from orders
orders.forEach(order => {
  lineItems.forEach(item1 => {
    lineItems.forEach(item2 => {
      pairFrequency[item1 + item2]++
    })
  })
})
```

**STATUS**: ✅ **ACCURATE** - Real co-purchase analysis from Shopify orders

---

## 🚨 **Step 3: THE MAIN ISSUE - Revenue from AI Recommendations**

### **Current State**:
```
Revenue from AI Recommendations: £0.00
Orders with Recommendations: 0
AI Learning Status: 0 products analyzed
```

### **But Upsell Performance Shows**:
```
Hi top calf leather: $54,872.00 revenue
```

### **ROOT CAUSE ANALYSIS**:

#### **1. Data Flow Comparison**

**AI Recommendations Section** (Lines 524-626):
```typescript
// Queries RecommendationAttribution table
attributions = await db.recommendationAttribution.findMany({ shop, dateRange })
attributedRevenue = sum(attributions.map(a => a.attributedRevenue))
attributedOrders = uniqueOrderIds.size
```

**Upsell Performance Section** (Lines 372-404):
```typescript
// Uses topProducts from Shopify orders DIRECTLY
topUpsells = topProducts.slice(0, 6).map(product => ({
  revenue: product.revenue  // REAL from Shopify
}))
```

#### **2. The Disconnect**:

```
┌─────────────────────────────────────────────────────────────────┐
│  SHOPIFY ORDERS (Real)                                          │
│  ↓                                                               │
│  topProducts = { "Hi top calf", revenue: $54,872 }              │
│  ↓                                                               │
│  topUpsells = [...topProducts] ✅ SHOWS IN TABLE                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TrackingEvent Table (Empty?)                                   │
│  ↓                                                               │
│  NO impression/click events recorded                            │
│  ↓                                                               │
│  RecommendationAttribution Table (Empty)                        │
│  ↓                                                               │
│  attributedRevenue = 0 ❌ SHOWS £0.00                           │
└─────────────────────────────────────────────────────────────────┘
```

#### **3. Why Attribution is Zero**:

The `RecommendationAttribution` table requires:
1. ✅ Orders to exist (THEY DO - we see $54,872)
2. ❌ TrackingEvent records with `event: 'ml_recommendation_served'`
3. ❌ Webhook/API that creates RecommendationAttribution records

**The problem**: 
- No tracking events are being recorded when recommendations are shown
- No attribution records are created when orders are placed
- The theme extension isn't calling the tracking API

---

## 🔍 **Step 3 Detailed Investigation Plan**

### **A. Check Theme Extension Tracking** ✋ *NEXT STEP*
1. Verify `/extensions/cart-uplift/` calls tracking API
2. Check for API route `/api/track` or similar
3. Verify tracking events fire on:
   - Recommendation shown (impression)
   - Recommendation clicked
   - Product added to cart

### **B. Check Webhook/Order Processing** ✋ *NEXT STEP*
1. Verify webhook exists: `orders/create` or `orders/paid`
2. Check if webhook creates `RecommendationAttribution` records
3. Verify it links `TrackingEvent` → `Order` → `Attribution`

### **C. Database Verification** ✋ *NEXT STEP*
Run queries to confirm:
```sql
-- Check if ANY tracking events exist
SELECT COUNT(*) FROM "tracking_events" WHERE shop = 'your-shop';

-- Check if ANY attributions exist
SELECT COUNT(*) FROM "recommendation_attributions" WHERE shop = 'your-shop';

-- Check orders
SELECT COUNT(*) FROM "analytics_events" WHERE shop = 'your-shop' AND "eventType" = 'purchase';
```

---

## 📝 **Summary Report for Step 2 (Low Hanging Fruit)**

| Section | Status | Issues |
|---------|--------|--------|
| **Dashboard Metrics** | ⚠️ Partial | Cart impressions are estimated (x2 orders) |
| **Smart Insights** | ❌ Fake | Previous values = current * 0.85, hardcoded trends |
| **Top Performing Products** | ✅ Real | Uses actual Shopify order data |
| **Upsell Performance** | ❌ Fake | Impressions/clicks estimated, only revenue is real |
| **Recommendation Over Time** | ⚠️ Conditional | Real IF TrackingEvent data exists (likely empty) |
| **Most Popular Recommendations** | ⚠️ Conditional | Real IF TrackingEvent data exists (likely empty) |
| **Smart Bundle Opportunities** | ✅ Real | Uses real co-purchase analysis |

### **Immediate Fixes Needed**:
1. ❌ Remove fake trend calculations in Smart Insights
2. ❌ Replace estimated impressions/clicks in Upsell Performance with disclaimer
3. ⚠️ Add fallback messaging when TrackingEvent table is empty
4. 🚨 Fix tracking pipeline (Step 3)

---

## ✅ **READY FOR YOUR CONFIRMATION**

**Please confirm Step 2 findings before I proceed to Step 3 (fixing the attribution pipeline).**

Would you like me to:
1. Fix the fake data in Smart Insights and Upsell Performance first?
2. Proceed directly to Step 3 (investigating and fixing the tracking/attribution pipeline)?
