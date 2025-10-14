# Attribution Debug Plan

## Issue
Webhook ran successfully but didn't create attribution records.

## Most Likely Causes

### 1. Product ID Mismatch
The webhook looks for `ml_recommendation_served` events with matching product IDs.

**Check:** Are the product IDs in the tracking events matching the product IDs in the order?
- Tracking might save variant IDs
- Order might have product IDs
- Need to check both formats

### 2. No ml_recommendation_served Events
The impressions/clicks are being tracked, but the `ml_recommendation_served` event might not be firing.

**Check:** Are there any `ml_recommendation_served` events in the database?

### 3. Timing Issue
The tracking events might have been created AFTER you clicked but the order webhook looks back 7 days.

## Next Steps

Run this diagnostic query to see what's in the database:

```sql
-- Check all tracking events
SELECT event, COUNT(*) as count, MAX("createdAt") as latest
FROM tracking_events
WHERE shop = 'sectionappblocks.myshopify.com'
GROUP BY event
ORDER BY latest DESC;

-- Check ml_recommendation_served events specifically
SELECT id, event, "productId", metadata, "createdAt"
FROM tracking_events
WHERE shop = 'sectionappblocks.myshopify.com'
AND event = 'ml_recommendation_served'
ORDER BY "createdAt" DESC
LIMIT 5;

-- Check what products were in the order
-- (You'll need to look at Shopify order data or webhook logs)
```

Would you like me to:
1. Add more debug logging to the webhook to see exactly what's happening?
2. Check if ml_recommendation_served events are actually being created?
3. Modify the attribution logic to also match on impression/click events (not just ml_recommendation_served)?
