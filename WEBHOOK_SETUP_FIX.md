# Webhook Setup Fix - Oct 14, 2025

## Problem
The "Setup Revenue Tracking" button was showing infinite loading spinner and never completing. This is the same embedded app navigation issue we've encountered before.

## Root Cause
The `useFetcher` hook was trying to make a POST request without preserving the embedded app query parameters (`host`, `shop`, `embedded`). This causes Shopify's App Bridge to fail the request.

## Solution Applied

### 1. Replaced useFetcher with Direct Fetch
**Before:**
```typescript
const webhookFetcher = useFetcher();
const setupWebhooks = () => {
  webhookFetcher.submit({}, { method: 'POST', action: '/admin/setup-webhooks' });
};
```

**After:**
```typescript
const [webhookSetupState, setWebhookSetupState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

const setupWebhooks = async () => {
  setWebhookSetupState('loading');
  const urlParams = new URLSearchParams(window.location.search);
  const response = await fetch(`/admin/setup-webhooks?${urlParams.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  // Handle response...
};
```

### 2. Fixed GraphQL Deprecation Warnings
Removed deprecated `endpoint` field from webhook query, now using:
```graphql
query {
  webhookSubscriptions(first: 50, topics: ORDERS_CREATE) {
    edges {
      node {
        id
        topic
      }
    }
  }
}
```

## Testing Steps

1. **Wait 2-3 minutes** for Vercel deployment to complete
2. **Hard refresh** your dashboard: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
3. **Click "Setup Revenue Tracking"** button
4. Should see **"✓ Webhooks configured"** or **"✓ Webhook already registered"**
5. **Verify in Shopify:** https://admin.shopify.com/store/sectionappblocks/settings/notifications/webhooks

## Expected Outcome

After clicking the button, you should see a webhook registered in Shopify:
- **Event:** Order creation
- **URL:** https://cartuplift.vercel.app/webhooks/orders/create
- **Format:** JSON
- **Status:** Active

## Related Files Changed

- `app/routes/admin.dashboard.tsx` - Replaced useFetcher with direct fetch
- `app/routes/admin.setup-webhooks.tsx` - Fixed deprecated GraphQL fields

## Pattern for Future Reference

**Embedded App Form Submissions:**
```typescript
// ❌ DON'T use useFetcher without query params
fetcher.submit(data, { method: 'POST', action: '/route' });

// ✅ DO preserve query params with direct fetch
const params = new URLSearchParams(window.location.search);
await fetch(`/route?${params.toString()}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

## Next Steps After Deployment

1. Click the button
2. Verify webhook created
3. Place test order with recommended product
4. Check Vercel logs for `🎯 Order webhook START`
5. Refresh dashboard - attribution should show > £0

## Commits
- `bab80df` - fix: webhook setup with embedded app params
- `ecab49a` - fix: remove deprecated endpoint field from GraphQL
