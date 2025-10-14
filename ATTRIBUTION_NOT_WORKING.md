# Attribution Not Working - Diagnosis Summary

## Current State
- **Orders**: 9 test orders (£26,348.35)
- **Clicks**: 187 clicks on recommendations  
- **Attribution**: £0.00 ❌ (Should show revenue from recommended products)

## What's Working ✅
1. **Order data loading** - Dashboard shows all 9 orders
2. **Tracking events** - 187 clicks recorded in database
3. **ml_recommendation_served events** - Being created when cart loads

## What's NOT Working ❌
1. **Order webhook** - `/webhooks/orders/create` not creating RecommendationAttribution records
2. **Real attribution** - Can't link purchases back to recommendations

## The Misleading Metric
**"Suggested Product Revenue 30.0%"** at £7,904.50 is calculated as:
- Find orders with 2+ products
- Assume 30% of their value came from upsells
- **This is NOT real attribution** - just an estimate

Real attribution should come from `RecommendationAttribution` table, which is empty.

## Root Cause
The `orders/create` webhook is either:
1. **Not registered in Shopify** (most likely)
2. **Failing silently** (check Vercel logs)
3. **Product ID mismatch** (string vs number format)

## Diagnostic Steps

### 1. Check Webhook Registration
```
Go to: Shopify Admin → Settings → Notifications → Webhooks
Look for: "Order creation" webhook
Should point to: https://cartuplift.vercel.app/webhooks/orders/create
Status: Should be "Active"
```

### 2. Check Vercel Logs
```
Go to: https://vercel.com/adedayo14/cartuplift/logs
Filter by: /webhooks/orders/create
Look for: Any requests with "🎯 Order webhook START"
```

### 3. Manual Webhook Test
In Shopify webhook settings:
- Find "Order creation" webhook
- Click "Send test notification"
- Check if it appears in Vercel logs

## Expected Webhook Flow

When an order is placed:
1. Shopify fires `orders/create` webhook → `/webhooks/orders/create`
2. Webhook extracts product IDs from order
3. Looks up `TrackingEvent` table for recent `ml_recommendation_served` events
4. Checks if purchased products were in `recommendationIds` metadata
5. Creates `RecommendationAttribution` records for matches
6. Dashboard queries `RecommendationAttribution` to show real revenue

## What Should Happen
After webhook fires for your test order with "Hi top calf leather" + "The Letterman":

```sql
-- Should create records like:
INSERT INTO RecommendationAttribution (
  shop: 'sectionappblocks.myshopify.com',
  productId: '9876543',
  orderId: '7150817738938',
  attributedRevenue: 2888.00
)
```

Then dashboard would show:
- **Revenue from AI Recommendations**: £3,637.95 (or similar)
- **Orders with Recommendations**: 1
- **ROI**: 74.2x (revenue / £49 app cost)

## Quick Fix Options

### Option A: Re-register Webhooks
```bash
cd /Users/dayo/CartUpliftAI/CartUpliftAI
shopify app deploy
```
This re-registers all webhooks including orders/create.

### Option B: Manual Registration
Go to Shopify Partners dashboard → Your app → API credentials → Webhooks → Add webhook:
- Event: `orders/create`
- Format: JSON
- URL: `https://cartuplift.vercel.app/webhooks/orders/create`
- Version: `2025-10`

### Option C: Check Existing Registration
```bash
# If you have Shopify CLI access:
shopify app webhook list
```

## How to Verify It's Working

1. Place a new test order with a product you clicked recommendations for
2. Wait 30 seconds
3. Check Vercel logs for webhook execution
4. Refresh dashboard
5. Should see **Revenue from AI Recommendations** > £0

## Database Check (if needed)

To manually verify TrackingEvent data exists:
```sql
-- Check if ml_recommendation_served events exist
SELECT COUNT(*) FROM TrackingEvent 
WHERE shop = 'sectionappblocks.myshopify.com' 
AND event = 'ml_recommendation_served';

-- Check if any attribution records exist
SELECT COUNT(*) FROM RecommendationAttribution 
WHERE shop = 'sectionappblocks.myshopify.com';
```

Expected: First query > 0, Second query = 0 (which is why attribution shows £0)

## Next Steps

1. **Go to Shopify Admin → Settings → Notifications → Webhooks**
2. **Check if "Order creation" webhook exists**
3. **If missing**: Run `shopify app deploy` to register it
4. **If exists**: Click "Send test notification" and check Vercel logs
5. **Place one more test order** with recommended products
6. **Check logs** at https://vercel.com/adedayo14/cartuplift/logs for webhook execution
7. **Refresh dashboard** to see attribution

## Expected Output in Vercel Logs

When webhook fires successfully:
```
🎯 Order webhook START: 2025-10-14T06:30:00.000Z
✅ Webhook authenticated: { 
  topic: 'ORDERS_CREATE',
  shop: 'sectionappblocks.myshopify.com',
  orderId: 'gid://shopify/Order/7150817738938',
  orderNumber: 1009,
  lineItemCount: 2
}
🔍 Processing attribution for order: gid://shopify/Order/7150817738938
📊 Order details: { customerId: 'gid://shopify/Customer/...', orderNumber: 1009, orderValue: 3637.95, lineItemCount: 2 }
🛍️ Purchased products: [ '9876543', '8765432' ]
🔍 Checking attribution for 2 products
📅 Looking for recommendations since: 2025-10-07T06:30:00.000Z
📦 Found 5 recommendation events
📝 Event cm2bhxyz123:
   - Recommended IDs (6): 9876543, 8765432, 7654321...
   - Purchased IDs: 9876543, 8765432
   - ID types: recommended[0]=string, purchased[0]=string
✅ MATCH! Products 9876543, 8765432 were recommended
🎯 Attribution summary: { totalAttributed: 2, attributedProducts: [ '9876543', '8765432' ], recommendationEventIds: [ 'cm2bhxyz123' ] }
✅ Attribution found! 2 products matched recommendations
💰 Attribution complete: 2 products, $3637.95
✅ Order webhook complete in 450ms
```

If you don't see this, the webhook isn't firing.
