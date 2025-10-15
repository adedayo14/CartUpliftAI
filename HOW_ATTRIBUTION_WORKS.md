# How "Revenue from AI Recommendations" is Calculated

## Summary
**Revenue from AI Recommendations** (e.g., £40,343.00) is calculated by summing up REAL tracked revenue from the `RecommendationAttribution` table. This is **100% real data** - not estimates.

## Calculation Method

### Step 1: Query RecommendationAttribution Table
```typescript
const attributions = await db.recommendationAttribution.findMany({
  where: {
    shop: session.shop,
    createdAt: { gte: startDate, lte: endDate }
  }
});
```

### Step 2: Sum All Attributed Revenue
```typescript
attributedRevenue = attributions.reduce((sum, a) => 
  sum + (a.attributedRevenue || 0), 0
);
```

### Location in Code
**File:** `app/routes/admin.dashboard.tsx`  
**Lines:** 602-655

## What is in RecommendationAttribution Table?

Each record represents a **product that was:**
1. ✅ **Recommended** by the app (ML or manual bundle)
2. ✅ **Clicked** by the customer in cart
3. ✅ **Purchased** in an order

### Record Structure:
```typescript
{
  productId: "7785831301306",        // Product that was recommended
  orderId: "gid://shopify/Order/...", // Order where it was purchased
  orderNumber: "#1034",               // Human-readable order number
  orderValue: 120.00,                 // Total order value
  attributedRevenue: 35.00,           // Revenue from THIS product
  createdAt: "2025-10-15T..."        // When order was created
}
```

## How Attribution Records Are Created

### Webhook: `webhooks.orders.create.tsx`

When an order is placed, the webhook:

1. **Fetches tracking events** for the customer session:
   ```typescript
   // Get recommendations shown
   const recommendationEvents = await db.trackingEvent.findMany({
     where: { 
       shop, 
       eventType: 'ml_recommendation_served',
       sessionId 
     }
   });
   
   // Get products clicked
   const clickEvents = await db.trackingEvent.findMany({
     where: { 
       shop, 
       eventType: 'click',
       sessionId 
     }
   });
   ```

2. **Extracts IDs** from order line items:
   ```typescript
   const purchasedProductIds = [7785831301306, ...]
   const purchasedVariantIds = [43678658101434, ...]
   ```

3. **Matches recommendations → clicks → purchases**:
   ```typescript
   // Check if product was both recommended AND clicked
   const wasRecommended = recommendedIds.includes(productId);
   const wasClicked = clickedProductIds.includes(productId) || 
                      clickedVariantIds.includes(variantId);
   
   if (wasRecommended && wasClicked) {
     // This is an attributed sale! 🎯
   }
   ```

4. **Creates attribution record**:
   ```typescript
   await db.recommendationAttribution.create({
     data: {
       shop,
       productId: lineItem.productId,
       orderId: order.id,
       orderNumber: order.name,
       orderValue: parseFloat(order.total_price),
       attributedRevenue: parseFloat(lineItem.price),
       createdAt: new Date(order.created_at)
     }
   });
   ```

## Real Example: Order #1034

### Step-by-Step Flow:

1. **Customer opens cart** → Recommendation shown for Product 7785831301306
   - Creates `TrackingEvent` with `eventType: 'ml_recommendation_served'`
   - Stores `recommendationIds: ["7785831301306"]` in metadata

2. **Customer clicks** Product 7785831301306 in cart
   - Creates `TrackingEvent` with `eventType: 'click'`
   - Stores `productId: "7785831301306"` and `variantId: "43678658101434"`

3. **Customer completes purchase** → Order #1034 created
   - Webhook `webhooks.orders.create.tsx` triggered
   - Matches: Product 7785831301306 was recommended ✅ AND clicked ✅
   - Creates `RecommendationAttribution` record with `attributedRevenue: £35.00`

4. **Dashboard shows attribution**
   - Query finds this record in date range
   - Adds £35.00 to total `attributedRevenue`
   - Shows "Revenue from AI Recommendations: £35.00"

## Multiple Products in Same Order

If Order #1034 had 3 products and 2 were recommended:

```typescript
Order #1034 = £120.00 total
├─ Product A: £35.00 ✅ (recommended + clicked) → attributed
├─ Product B: £50.00 ✅ (recommended + clicked) → attributed  
└─ Product C: £35.00 ❌ (not recommended) → not attributed

attributedRevenue for Order #1034 = £35.00 + £50.00 = £85.00
```

## Why This is 100% Real

✅ **No estimates** - Every £1 shown was actually:
- Recommended by the app
- Clicked by the customer
- Purchased in an order

✅ **No guesses** - No "30% of orders" or "totalOrders × 2" multipliers

✅ **Verifiable** - Every attribution record links to:
- Real `TrackingEvent` records (clicks)
- Real Shopify order data (purchases)
- Real recommendation sessions

## What Happens When No Attribution Data Exists?

If the `RecommendationAttribution` table is empty:
```typescript
attributedRevenue = 0; // Shows £0.00, not an estimate
```

The dashboard will show:
- **Revenue from AI Recommendations:** £0.00
- **Previous Period:** £0.00
- **Change:** 0%

This is **better than showing fake numbers** - merchants see real progress as they use the app.

## Time Periods

The calculation respects the selected timeframe:

- **Today:** Only attributions from today
- **7 days:** Attributions from last 7 days
- **30 days:** Attributions from last 30 days
- **Custom:** Attributions between start/end dates

Previous period comparisons use the **same duration** before the current period.

## Summary

**£40,343.00 = Sum of all attributed product sales in the selected time period**

Every penny in that number represents:
1. A recommendation shown by the app
2. A click by the customer
3. A purchase in a completed order

**This is as real as it gets.** 🎯
