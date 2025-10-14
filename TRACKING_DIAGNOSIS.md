# Tracking Pipeline Diagnosis

## Investigation Summary
Investigated why "Revenue from AI Recommendations" shows £0 despite having $54,872 in Upsell Performance.

## Key Findings

### ✅ Infrastructure is COMPLETE
All tracking components are properly implemented:

1. **Theme Extension Tracking** ✅
   - Location: `/extensions/cart-uplift/assets/cart-uplift.js`
   - Impression tracking: Line 4779 - Fires when drawer opens with recommendations
   - Click tracking: Lines 3380, 3420, 3454 - Fires when user clicks recommendations
   - ML recommendation served tracking: `/extensions/cart-uplift/src/recommendations/enhanced-engine.js` Line 101

2. **API Routes** ✅
   - `/app/routes/api.track.tsx` - Handles impression/click/add_to_cart events
   - `/app/routes/api.track-recommendations.tsx` - Handles ml_recommendation_served events
   - `/app/routes/apps.proxy.$.tsx` Lines 2049 & 2127 - Proxy handlers for both routes

3. **App Proxy Configuration** ✅
   - `shopify.app.toml` Line 41: Configured as `/apps/cart-uplift` → app server
   - Theme extension calls: `/apps/cart-uplift/api/track` (proxied to app)

4. **Database Schema** ✅
   - `TrackingEvent` model exists: `prisma/schema.prisma` Line 368
   - Has all required fields: shop, event, productId, productTitle, sessionId, revenueCents, orderId
   - Proper indexes for queries

5. **Webhook for Attribution** ✅
   - `/app/routes/webhooks.orders.create.tsx` - Creates RecommendationAttribution records
   - Subscribed in `shopify.app.toml` Line 22: `orders/create` webhook

6. **Dashboard Queries** ✅
   - Lines 493-547: Query TrackingEvent table for dashboard metrics
   - Calculates impressions, clicks, CTR, revenue attribution

## The ACTUAL Problem

### Most Likely Issue: Development vs Production Environment

The tracking system is complete BUT may not be working because:

1. **Development server isn't deployed** - Theme extension on live store is calling tracking APIs that point to local dev server
2. **CORS/Authentication mismatch** - App proxy might not be configured in production Shopify partner dashboard
3. **Database not synced** - Production database might not have the TrackingEvent table migrated yet

### Testing Needed

1. Check browser console in live store for:
   - `📊 Sending tracking to: /apps/cart-uplift/api/track`
   - Network requests to tracking endpoints
   - Any CORS or 401/404 errors

2. Check production logs for:
   - `[Tracking] ✅ Saved successfully:` messages
   - `🛑 [Tracking] DB write failed` errors
   - `🔒 [Track] App proxy auth failed` warnings

3. Verify app proxy is configured in Shopify:
   - Partner dashboard → App → Configuration → App proxy
   - Should show: `https://cartuplift.vercel.app/apps/proxy` with subpath `cart-uplift`

## Next Steps

### Option 1: Deploy to Production
```bash
# Build and deploy theme extension
npm run deploy:extension

# Deploy app to Vercel (already done if vercel.app is live)
# Ensure DATABASE_URL is set in Vercel env vars

# Verify app proxy configuration in Shopify Partner Dashboard
```

### Option 2: Test in Development
```bash
# Start dev server with Shopify CLI tunnel
npm run dev

# This creates a tunnel URL that Shopify can reach
# Install app on development store
# Test cart drawer recommendations
# Check terminal logs for tracking events
```

### Option 3: Check Production Database
```typescript
// Run this in production console to check if table exists
await prisma.$queryRaw`SELECT COUNT(*) FROM tracking_events`

// Check for recent events
await prisma.trackingEvent.count()
```

## Revenue Attribution Flow (When Working)

1. **Impression**: Theme extension calls `/api/track` with `event: "impression"`
2. **Click**: User clicks recommendation → `/api/track` with `event: "click"`
3. **ML Served**: Recommendations shown → `/api/track-recommendations` creates `ml_recommendation_served` event
4. **Purchase**: Order webhook fires → `/webhooks/orders/create`
5. **Attribution**: Webhook checks for recent TrackingEvents (last 7 days) matching purchased products
6. **Record**: Creates `RecommendationAttribution` record linking tracking event to order revenue
7. **Dashboard**: Queries `RecommendationAttribution` to show "Revenue from AI Recommendations"

## Why Upsell Performance Shows Revenue

The $54,872 in Upsell Performance comes from:
- Direct Shopify GraphQL API query for orders
- `admin.dashboard.tsx` Lines 160-165: Fetches orders with line items
- Real order data, not tracking-dependent

The £0 in AI Recommendations is because:
- Requires TrackingEvent → RecommendationAttribution pipeline
- Pipeline exists but likely not receiving/storing events
- Need to verify deployment and production configuration
