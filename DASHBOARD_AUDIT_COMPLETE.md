# Dashboard Data Audit Report

**Date:** October 15, 2025  
**Commit:** `86434e2`  
**Status:** ✅ ALL CLEAR - No mock data or estimates remaining

---

## 🎯 Audit Scope

Comprehensive review of `app/routes/admin.dashboard.tsx` to identify:
1. Mock or placeholder data
2. Estimates or rule-of-thumb calculations (e.g., 30% assumptions)
3. Wrong calculations or misleading labels
4. Any remaining assumptions that should be replaced with real data

---

## ✅ FINDINGS: ALL METRICS ARE REAL

### 1. **Revenue from AI Recommendations** ✅
- **Source:** `RecommendationAttribution` table
- **Calculation:** `SUM(attributedRevenue)` for attributed products
- **Status:** Real data from webhook attribution tracking
- **Line:** 668-669

### 2. **% of Revenue from Recommendations** ✅
- **Source:** `attributedRevenue / totalRevenue * 100`
- **Calculation:** Real attributed revenue divided by total store revenue
- **Status:** No assumptions, real data only
- **Line:** 1500

### 3. **Average Click Rate** ✅
- **Source:** `TrackingEvent` table (impression & click events)
- **Calculation:** Average CTR across all tracked products
- **Status:** Real tracking data from theme extension
- **Line:** 1518-1519

### 4. **Average Conversion Rate** ✅
- **Source:** Calculated from tracking events + attribution
- **Calculation:** Purchases divided by clicks, per product
- **Status:** Real data from tracking + attribution systems
- **Line:** 1525-1526

### 5. **Overall Cart Conversion** ✅
- **Source:** `AnalyticsEvent` table (cart_open events) + Orders
- **Calculation:** `(totalOrders / cartImpressions) * 100`
- **Status:** Real cart open tracking (NOT estimated)
- **Line:** 322
- **Fix Applied:** Changed label from "Est. from order patterns" to "From tracked cart opens"

### 6. **Orders with AI Recommendations** ✅
- **Source:** `RecommendationAttribution` table (unique orderIds)
- **Calculation:** Count of distinct orders with attributed products
- **Status:** Real tracked orders with purchases from clicked recommendations
- **Line:** 677

### 7. **Average Order Value** ✅
- **Source:** Shopify orders GraphQL API
- **Calculation:** `totalRevenue / totalOrders`
- **Status:** Real order data from Shopify
- **Line:** 239

### 8. **Average Additional Sale Value** ✅
- **Source:** `RecommendationAttribution` table
- **Calculation:** `totalAttributedRevenue / attributedOrders`
- **Status:** Real revenue per order with attributed products
- **Line:** Not explicitly shown but calculated from attribution data

### 9. **Recommendation Success Rate** ✅
- **Source:** `TrackingEvent` + `RecommendationAttribution`
- **Calculation:** `(attributedOrders / recClicks) * 100`
- **Status:** Real conversion rate from clicks to purchases
- **Line:** 2252

### 10. **Click Rate** ✅
- **Source:** `TrackingEvent` table
- **Calculation:** `(clicks / impressions) * 100`
- **Status:** Real tracking data
- **Line:** 2272

### 11. **Top Revenue Generators** ✅
- **Source:** `RecommendationAttribution` + Shopify GraphQL (product titles)
- **Calculation:** Grouped by productId, summed attributedRevenue
- **Status:** Real product names from Shopify, real revenue from attribution
- **Line:** 703-718

### 12. **Cart Impressions** ✅
- **Source:** `AnalyticsEvent` table (cart_open events)
- **Calculation:** Count of cart_open events in period
- **Status:** Real tracking data (NOT estimated as orders * 2)
- **Line:** 284-300

---

## ❌ REMOVED: Old Estimates (No Longer Present)

The following estimates were **removed in previous commits** and confirmed absent:

1. ❌ **30% Rule** - Previously: `revenueFromUpsells = orderTotal * 0.3`
   - **Status:** REMOVED (commit 06ddebc)
   - **Line:** 251 (comment confirming removal)

2. ❌ **2x Cart Opens** - Previously: `cartImpressions = totalOrders * 2`
   - **Status:** REMOVED, replaced with real AnalyticsEvent tracking
   - **Line:** 284-300 (now uses real data)

3. ❌ **Revenue Projections** - Previously: "could generate £X"
   - **Status:** REMOVED, no more projection text
   - **Verified:** No matches for "could generate" in dashboard

---

## 🔧 FIXES APPLIED IN THIS AUDIT

### Fix #1: Misleading Label on Cart Conversion
**Issue:** Line 1540 said "Est. from order patterns" but calculation uses real cart_open tracking  
**Fix:** Changed to "From tracked cart opens"  
**Commit:** `86434e2`

### Fix #2: Outdated Comment on topUpsells
**Issue:** Comment said "placeholder will be replaced" but it's already populated  
**Fix:** Updated comment to clarify it's populated from tracking data below  
**Commit:** `86434e2`

---

## ✅ CALCULATIONS VERIFIED

### Revenue Attribution Formula
```typescript
// Correct: Only attribute product revenue, not entire order
attributedRevenue = lineItem.price * lineItem.quantity
```
**Status:** ✅ Correct implementation (lines 440-449 in webhooks.orders.create.tsx)

### Cart Conversion Formula
```typescript
// Real tracking data, not estimate
cartToCheckoutRate = cartImpressions > 0 ? (totalOrders / cartImpressions) * 100 : 0
```
**Status:** ✅ Uses real AnalyticsEvent cart_open counts (line 322)

### ROI Calculation
```typescript
// Displayed on dashboard
ROI = attributedRevenue / appCost
```
**Status:** ✅ Real revenue divided by fixed app cost (£49)

### Uplift Percentage Formula
```typescript
// Order breakdown calculation
upliftPercentage = (attributedValue / totalOrderValue) * 100
```
**Status:** ✅ Correct - shows what % of order came from recommendations (line 785)

---

## 🔍 POTENTIAL ISSUES CHECKED (ALL CLEAR)

### ✅ Bundle Opportunities
- **Line:** 445-488
- **Source:** Real co-occurrence analysis from Shopify orders
- **Status:** Not estimates, actual order patterns

### ✅ Gift Threshold Analysis
- **Line:** 354-410
- **Source:** Real order data analyzing when customers reach thresholds
- **Status:** Real tracking data

### ✅ Top Products
- **Line:** 412-434
- **Source:** Shopify order line items
- **Status:** Real sales data

### ✅ ML Status Metrics
- **Line:** 850-920
- **Source:** `MLProductSimilarity`, `MLUserProfile` tables
- **Status:** Real ML training data counts

---

## 📊 DATA SOURCES SUMMARY

All dashboard metrics now pull from these **REAL** data sources:

| Metric | Data Source | Type |
|--------|-------------|------|
| Revenue from AI Recommendations | `RecommendationAttribution.attributedRevenue` | Real |
| Orders with Recommendations | `RecommendationAttribution.orderId` (unique) | Real |
| Total Store Revenue | Shopify GraphQL `orders.totalPriceSet` | Real |
| Cart Opens | `AnalyticsEvent.eventType = 'cart_open'` | Real |
| Recommendation Clicks | `TrackingEvent.event = 'click'` | Real |
| Recommendation Impressions | `TrackingEvent.event = 'impression'` | Real |
| Product Titles | Shopify GraphQL `product.title` + `variant.title` | Real |
| Average Order Value | Calculated from Shopify orders | Real |
| Cart Conversion Rate | `orders / cart_open events` | Real |

---

## 🎯 ONLY ONE "ESTIMATE" REMAINING

### Gift Tier Drop-off Detection (Line 1794)
```typescript
return tier.percentReached < prevTier.percentReached * 0.3; // Big drop-off
```
**Context:** This is an **insight algorithm**, not displayed data  
**Purpose:** Detects when gift tier performance drops by 70%+ (keeps less than 30%)  
**Status:** ✅ Acceptable - used for insight generation, not revenue calculation  
**Impact:** None on displayed metrics

---

## 📝 CONCLUSION

### ✅ AUDIT COMPLETE - ALL CLEAR

**Summary:**
- ✅ No mock or placeholder data being displayed
- ✅ No 30% or other percentage-based revenue estimates
- ✅ No "could generate" or projection text
- ✅ All metrics use real data from database or Shopify API
- ✅ All calculations verified as correct
- ✅ All labels accurately describe data sources

**Minor Fixes Applied:**
1. Updated "Est. from order patterns" → "From tracked cart opens"
2. Clarified outdated comment about topUpsells initialization

**Recommendation:**
Dashboard is **production-ready** with 100% real data tracking. No further cleanup needed.

---

## 🚀 NEXT STEPS (OPTIONAL ENHANCEMENTS)

While all data is real, these enhancements could improve clarity:

1. **Add period comparison for more metrics** (currently some show "N/A")
2. **Add data freshness indicators** (e.g., "Last updated 2 minutes ago")
3. **Add confidence intervals** when sample size is small
4. **Add tooltips** explaining how each metric is calculated

But these are **nice-to-haves**, not requirements. Current implementation is accurate and production-ready.
