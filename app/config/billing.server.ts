/**
 * Billing Configuration
 * Defines pricing plans and order limits for Cart Uplift
 */

export type PlanTier = "starter" | "growth" | "pro";

export interface PricingPlan {
  id: PlanTier;
  name: string;
  price: number;
  interval: "EVERY_30_DAYS" | "ANNUAL";
  orderLimit: number;
  trialDays: number;
  features: string[];
}

export const PRICING_PLANS: Record<PlanTier, PricingPlan> = {
  starter: {
    id: "starter",
    name: "Starter Plan",
    price: 49,
    interval: "EVERY_30_DAYS",
    orderLimit: 500,
    trialDays: 14,
    features: [
      "Enhanced cart drawer",
      "Free shipping progress bar",
      "Up to 500 orders/month",
      "Basic analytics",
      "Email support"
    ]
  },
  growth: {
    id: "growth",
    name: "Growth Plan",
    price: 79,
    interval: "EVERY_30_DAYS",
    orderLimit: 2000,
    trialDays: 14,
    features: [
      "Everything in Starter",
      "ML-powered recommendations",
      "Up to 2,000 orders/month",
      "Advanced analytics",
      "A/B testing",
      "Priority support"
    ]
  },
  pro: {
    id: "pro",
    name: "Pro Plan",
    price: 149,
    interval: "EVERY_30_DAYS",
    orderLimit: Infinity,
    trialDays: 14,
    features: [
      "Everything in Growth",
      "Unlimited orders",
      "Custom bundles",
      "Advanced ML features",
      "White-label options",
      "Dedicated account manager",
      "Priority support"
    ]
  }
};

/**
 * Get plan details by tier
 */
export function getPlan(tier: PlanTier): PricingPlan {
  return PRICING_PLANS[tier];
}

/**
 * Check if a plan exists
 */
export function isValidPlan(tier: string): tier is PlanTier {
  return tier in PRICING_PLANS;
}

/**
 * Get order limit for a plan
 */
export function getOrderLimit(tier: PlanTier): number {
  return PRICING_PLANS[tier].orderLimit;
}

/**
 * Check if usage is approaching limit (80% threshold)
 */
export function isApproachingLimit(currentCount: number, tier: PlanTier): boolean {
  const limit = getOrderLimit(tier);
  if (limit === Infinity) return false;
  return currentCount >= limit * 0.8;
}

/**
 * Check if limit is reached
 */
export function isLimitReached(currentCount: number, tier: PlanTier): boolean {
  const limit = getOrderLimit(tier);
  if (limit === Infinity) return false;
  return currentCount >= limit;
}

/**
 * Calculate remaining orders
 */
export function getRemainingOrders(currentCount: number, tier: PlanTier): number {
  const limit = getOrderLimit(tier);
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - currentCount);
}

/**
 * Format order limit for display
 */
export function formatOrderLimit(tier: PlanTier): string {
  const limit = getOrderLimit(tier);
  if (limit === Infinity) return "Unlimited";
  return limit.toLocaleString();
}

/**
 * Get all plans sorted by price
 */
export function getAllPlans(): PricingPlan[] {
  return Object.values(PRICING_PLANS).sort((a, b) => a.price - b.price);
}

/**
 * Check if plan A is higher tier than plan B
 */
export function isHigherTier(planA: PlanTier, planB: PlanTier): boolean {
  const prices = { starter: 49, growth: 79, pro: 149 };
  return prices[planA] > prices[planB];
}

/**
 * Test mode configuration (from environment)
 */
export const BILLING_CONFIG = {
  testMode: process.env.SHOPIFY_BILLING_TEST_MODE === "true",
  returnUrl: process.env.SHOPIFY_APP_URL 
    ? `${process.env.SHOPIFY_APP_URL}/api/billing/confirm`
    : "https://cartuplift.com/api/billing/confirm"
};
