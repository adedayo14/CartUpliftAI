# Manual Webhook Setup Guide

Since the automatic webhook registration isn't working, let's create it manually through Shopify Admin.

## 📝 Steps to Manually Create the Webhook

1. **Go to Shopify Webhook Settings:**
   https://admin.shopify.com/store/sectionappblocks/settings/notifications/webhooks

2. **Click "Create webhook" button** (in the top right)

3. **Fill in the form:**
   - **Event:** Select `Order creation` from the dropdown
   - **Format:** Select `JSON`
   - **URL:** Enter exactly: `https://cartuplift.vercel.app/webhooks/orders/create`
   - **API Version:** Select `2025-01` or `2025-10` (latest)

4. **Click "Save webhook"**

5. **Verify it appears in the list** with:
   - Event: Order creation
   - URL: https://cartuplift.vercel.app/webhooks/orders/create
   - Status: Active

## 🧪 Test the Webhook

After creating it manually:

1. **Place a test order** on your store with a recommended product
2. **Check Vercel logs:** https://vercel.com/adedayo14/cartuplift/logs
3. **Look for:** `🎯 Order webhook START`
4. **Refresh dashboard** - you should see attribution > £0

## 🔍 Why Manual Creation is Needed

The automatic webhook registration via `shopify.app.toml` or the setup button has been problematic because:
- Embedded app authentication is causing fetch requests to hang
- The `afterAuth` hook may not be firing properly
- `shopify app deploy` isn't registering webhooks as expected

Manual creation works 100% of the time and bypasses all these issues.

## ✅ Once Created

The webhook will:
- Fire on every new order
- Send order data to your Vercel endpoint
- Create RecommendationAttribution records
- Show real revenue on your dashboard

This is a **one-time setup** - once created, it stays registered permanently (until you uninstall the app).
