# Shopify Billing & Order Limits Implementation - TODO List

## Research Summary

### Key Learnings from shopifyapp repo:
1. **App Metafields** - Used to control feature access via `app.metafields.namespace.key` in theme blocks
2. **Subscription Tracking** - Prisma Subscription model tracks plan, status, periods
3. **Order Counting** - Uses database queries to count orders within billing periods
4. **Automatic Feature Gating** - Metafields auto-update when subscription changes

### Implementation Strategy:
- Track orders in CartAnalytics table (already exists)
- Add order counting middleware
- Gate cart features based on subscription limits
- Use metafields for theme extension access control

---

## Phase 1: Database Schema Updates ✅ (COMPLETED)
- [x] Add subscription fields to Settings model
  - subscriptionPlan: "starter" | "growth" | "pro"
  - subscriptionStatus: "trial" | "active" | "cancelled" | "expired"
  - trialEndsAt: DateTime
  - subscriptionStartedAt: DateTime

## Phase 2: Order Tracking & Counting

### 2.1 Add Order Count Fields to Settings
- [ ] Add monthly order count tracking fields:
  ```prisma
  monthlyOrderCount       Int      @default(0)
  currentPeriodStart      DateTime @default(now())
  currentPeriodEnd        DateTime?
  orderLimitReached       Boolean  @default(false)
  ```

### 2.2 Create Order Counting Service
- [ ] Create `/app/services/orderCounter.server.ts`:
  ```typescript
  - getMonthlyOrderCount(shop: string): Promise<number>
  - incrementOrderCount(shop: string): Promise<void>
  - resetMonthlyCount(shop: string): Promise<void>
  - checkOrderLimit(shop: string): Promise<{ allowed: boolean, remaining: number }>
  ```

### 2.3 Add Order Tracking Middleware
- [ ] Create middleware to track cart conversions
- [ ] Hook into existing cart analytics to count orders
- [ ] Update count on successful checkout

## Phase 3: Shopify Billing API Integration

### 3.1 Setup Billing Configuration
- [ ] Create `/app/config/billing.server.ts`:
  ```typescript
  export const PRICING_PLANS = {
    starter: { 
      price: 49, 
      orderLimit: 500,
      name: "Starter Plan" 
    },
    growth: { 
      price: 79, 
      orderLimit: 2000,
      name: "Growth Plan" 
    },
    pro: { 
      price: 149, 
      orderLimit: Infinity,
      name: "Pro Plan" 
    }
  }
  ```

### 3.2 Create Billing Service
- [ ] Create `/app/services/billing.server.ts`:
  ```typescript
  - createSubscription(shop, plan): Promise<confirmationUrl>
  - confirmSubscription(shop, chargeId): Promise<boolean>
  - cancelSubscription(shop): Promise<void>
  - checkSubscriptionStatus(shop): Promise<status>
  ```

### 3.3 Billing API Routes
- [ ] Create `/app/routes/api.billing.subscribe.tsx`:
  - POST: Initiate Shopify subscription
  - Return confirmation URL for Shopify redirect
  
- [ ] Create `/app/routes/api.billing.confirm.tsx`:
  - GET: Handle Shopify callback after payment
  - Verify charge_id with Shopify
  - Update Settings with subscription details
  
- [ ] Create `/app/routes/api.billing.cancel.tsx`:
  - POST: Cancel subscription via Shopify API

### 3.4 Billing Mutations (GraphQL)
- [ ] Implement `appSubscriptionCreate` mutation
- [ ] Implement `appSubscriptionCancel` mutation
- [ ] Add recurring billing with 30-day intervals

## Phase 4: Order Limit Enforcement

### 4.1 Create Limit Check Middleware
- [ ] Add to cart API routes:
  ```typescript
  const { allowed, remaining } = await checkOrderLimit(shop);
  if (!allowed) {
    return json({ 
      error: "ORDER_LIMIT_REACHED",
      message: `You've reached your plan limit. Upgrade to continue.`,
      upgrade_url: "/app/pricing"
    }, { status: 403 });
  }
  ```

### 4.2 Update Cart Tracking Routes
- [ ] Modify `/app/routes/api.cart-tracking.tsx`:
  - Check order limit before tracking
  - Return upgrade prompt if limit reached
  
- [ ] Modify `/app/routes/api.analytics-dashboard.tsx`:
  - Show order count vs limit
  - Display upgrade CTA when near limit

### 4.3 Admin Dashboard Updates
- [ ] Add order usage widget:
  - Show: "247 / 500 orders used this month"
  - Progress bar visualization
  - Upgrade button when > 80% used

## Phase 5: App Metafields for Feature Gating

### 5.1 Setup Metafield Structure
- [ ] Create `/app/services/metafields.server.ts`:
  ```typescript
  - setAppMetafield(shop, key, value): Promise<void>
  - getAppMetafields(shop): Promise<MetafieldData>
  - updateSubscriptionAccess(shop, plan): Promise<void>
  ```

### 5.2 Define Access Control Metafields
```typescript
const FEATURE_METAFIELDS = {
  namespace: "cart_uplift",
  keys: {
    has_active_subscription: "boolean",
    plan_tier: "string", // "starter" | "growth" | "pro"
    orders_remaining: "number",
    features_enabled: "json" // { ml: true, analytics: true, ... }
  }
}
```

### 5.3 Sync Metafields on Subscription Changes
- [ ] Update metafields when subscription created
- [ ] Update metafields when subscription upgraded/downgraded
- [ ] Update metafields when trial expires
- [ ] Update metafields when order limit reached

## Phase 6: Homepage Pricing Integration

### 6.1 Make Pricing Buttons Functional
- [ ] Update `/app/routes/app._index.tsx`:
  ```typescript
  // Replace static buttons with subscription flow
  <Button 
    onClick={() => handleSubscribe('starter')}
    loading={subscribing}
  >
    Start Free Trial
  </Button>
  ```

### 6.2 Subscription Flow Handler
- [ ] Create `handleSubscribe` function:
  - Call `/api/billing/subscribe` with plan
  - Redirect to Shopify confirmation URL
  - Handle errors gracefully

### 6.3 Post-Subscription Experience
- [ ] Create `/app/routes/app.welcome.tsx`:
  - Show after successful subscription
  - Guide user to enable theme extension
  - Show getting started checklist

## Phase 7: Trial Management

### 7.1 Trial Setup on Install
- [ ] In app install webhook:
  - Set subscriptionStatus = "trial"
  - Set trialEndsAt = now() + 14 days
  - Set currentPeriodStart = now()

### 7.2 Trial Expiration Check
- [ ] Create cron job or webhook:
  - Check for expired trials daily
  - Update status to "expired"
  - Send email notification
  - Block features until subscription

### 7.3 Trial Banner in Admin
- [ ] Add banner component:
  - Show "X days remaining in trial"
  - CTA: "Subscribe Now"
  - Countdown timer

## Phase 8: Upgrade/Downgrade Flow

### 8.1 Plan Comparison Page
- [ ] Create `/app/routes/app.pricing.tsx`:
  - Show all 3 plans side-by-side
  - Highlight current plan
  - Show current usage stats
  - Upgrade/downgrade buttons

### 8.2 Upgrade Handler
- [ ] Implement immediate upgrade:
  - Cancel current subscription
  - Create new subscription
  - Prorate charges via Shopify
  - Reset order count if moving to higher tier

### 8.3 Downgrade Handler
- [ ] Implement end-of-period downgrade:
  - Schedule downgrade for period end
  - Show confirmation: "Downgrade takes effect on [date]"
  - Warn about feature restrictions

## Phase 9: Admin Dashboard Enhancements

### 9.1 Subscription Overview Widget
- [ ] Create component: `SubscriptionCard.tsx`
  - Current plan display
  - Billing date
  - Order usage meter
  - Quick upgrade button

### 9.2 Usage Analytics
- [ ] Add to dashboard:
  - Orders this month graph
  - Revenue per order
  - Conversion rate
  - "Upgrade to unlock advanced analytics" CTA for Starter

### 9.3 Billing History
- [ ] Create `/app/routes/app.billing-history.tsx`:
  - List all charges from Shopify
  - Download invoices
  - Payment method management

## Phase 10: Error Handling & Edge Cases

### 10.1 Payment Failures
- [ ] Handle failed payments:
  - Retry logic (Shopify handles this)
  - Grace period before feature lockout
  - Email notifications

### 10.2 Subscription Cancellation
- [ ] Handle cancellation:
  - Allow access until period end
  - Archive data (don't delete)
  - Re-activation flow

### 10.3 Refund Handling
- [ ] Handle refunds from Shopify:
  - Webhook: `app_subscriptions/update`
  - Update status accordingly
  - Adjust order limits

## Phase 11: Testing Strategy

### 11.1 Test Mode Setup
- [ ] Enable Shopify test charges:
  - Set `test: true` in billing mutations
  - Use development store
  - Test full subscription flow

### 11.2 Test Scenarios
- [ ] Test cases to cover:
  - [ ] New install → trial → subscription
  - [ ] Reach order limit → upgrade
  - [ ] Downgrade at period end
  - [ ] Cancel subscription
  - [ ] Trial expiration
  - [ ] Payment failure
  - [ ] Refund handling

## Phase 12: Documentation

### 12.1 Merchant Documentation
- [ ] Create help docs:
  - How billing works
  - How to upgrade/downgrade
  - What happens when limit reached
  - FAQ section

### 12.2 Developer Documentation
- [ ] Document code:
  - Billing service architecture
  - Order counting logic
  - Metafield structure
  - Webhook handlers

---

## Implementation Priority Order:

### Week 1 (Critical):
1. Phase 2: Order Tracking & Counting ⚡
2. Phase 3: Shopify Billing API Integration ⚡
3. Phase 4: Order Limit Enforcement ⚡

### Week 2 (Important):
4. Phase 6: Homepage Pricing Integration
5. Phase 7: Trial Management
6. Phase 9: Admin Dashboard Enhancements

### Week 3 (Enhancement):
7. Phase 5: App Metafields for Feature Gating
8. Phase 8: Upgrade/Downgrade Flow
9. Phase 10: Error Handling & Edge Cases

### Week 4 (Polish):
10. Phase 11: Testing Strategy
11. Phase 12: Documentation

---

## Technical Notes:

### Shopify Billing API Key Points:
- Use `appSubscriptionCreate` for recurring billing
- Use `test: true` for development stores
- Shopify handles payment collection automatically
- Use webhooks for subscription status updates
- Charges are in USD by default

### Order Counting Strategy:
- Count in Prisma (not Shopify API) for performance
- Track in CartAnalytics table: `cartId` + `orderId`
- Reset count on subscription renewal
- Cache current count in Settings table

### Metafields vs Database:
- Database (Settings): Subscription status, limits, counts
- Metafields: Feature flags for theme extension access
- Sync metafields when subscription changes

### Key Webhooks Needed:
```
app_subscriptions/create
app_subscriptions/update
app_subscriptions/cancel
orders/create (for counting)
```

---

## Files to Create:
```
app/
  config/
    billing.server.ts
  services/
    orderCounter.server.ts
    billing.server.ts
    metafields.server.ts
  routes/
    api.billing.subscribe.tsx
    api.billing.confirm.tsx
    api.billing.cancel.tsx
    app.pricing.tsx
    app.billing-history.tsx
    app.welcome.tsx
    webhooks.app-subscriptions-update.tsx
  components/
    SubscriptionCard.tsx
    OrderUsageMeter.tsx
    UpgradePrompt.tsx
    TrialBanner.tsx
```

---

## Environment Variables Needed:
```bash
# Already have these
DATABASE_URL="postgresql://..."
SHOPIFY_API_KEY="..."
SHOPIFY_API_SECRET="..."

# May need to add
SHOPIFY_BILLING_TEST_MODE="true"  # Set to false in production
```

---

## References:
- Shopify Billing API: https://shopify.dev/docs/apps/billing
- App Subscriptions: https://shopify.dev/docs/api/admin-graphql/latest/mutations/appSubscriptionCreate
- App Metafields: https://shopify.dev/docs/apps/build/custom-data/metafields
- Example repo: https://github.com/adedayo14/shopifyapp
