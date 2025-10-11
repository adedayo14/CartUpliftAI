/**
 * Order Counter Service
 * Tracks monthly order counts and enforces subscription limits
 */

import prisma from "../db.server";
import { getOrderLimit, isLimitReached, getRemainingOrders } from "../config/billing.server";
import type { PlanTier } from "../config/billing.server";

export interface OrderLimitCheck {
  allowed: boolean;
  remaining: number;
  currentCount: number;
  limit: number;
  plan: PlanTier | null;
}

/**
 * Get monthly order count for a shop
 */
export async function getMonthlyOrderCount(shop: string): Promise<number> {
  const settings = await prisma.settings.findUnique({
    where: { shop },
    select: { monthlyOrderCount: true }
  });
  
  return settings?.monthlyOrderCount || 0;
}

/**
 * Increment order count for a shop
 */
export async function incrementOrderCount(shop: string): Promise<void> {
  await prisma.settings.update({
    where: { shop },
    data: {
      monthlyOrderCount: {
        increment: 1
      }
    }
  });
}

/**
 * Reset monthly count (called on subscription renewal)
 */
export async function resetMonthlyCount(shop: string): Promise<void> {
  const now = new Date();
  const nextPeriodEnd = new Date(now);
  nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);
  
  await prisma.settings.update({
    where: { shop },
    data: {
      monthlyOrderCount: 0,
      currentPeriodStart: now,
      currentPeriodEnd: nextPeriodEnd,
      lastOrderCountReset: now,
      orderLimitReached: false
    }
  });
}

/**
 * Check if shop can process more orders based on their plan
 */
export async function checkOrderLimit(shop: string): Promise<OrderLimitCheck> {
  const settings = await prisma.settings.findUnique({
    where: { shop },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      monthlyOrderCount: true,
      orderLimitReached: true,
      trialEndsAt: true
    }
  });

  // Default to trial with starter limits if no settings
  if (!settings) {
    return {
      allowed: true,
      remaining: 500,
      currentCount: 0,
      limit: 500,
      plan: "starter"
    };
  }

  // Check if trial is expired
  const now = new Date();
  const trialExpired = settings.trialEndsAt && now > settings.trialEndsAt;
  const isTrialOrActive = settings.subscriptionStatus === "trial" || settings.subscriptionStatus === "active";
  
  // If trial expired and no active subscription, block
  if (trialExpired && settings.subscriptionStatus !== "active") {
    return {
      allowed: false,
      remaining: 0,
      currentCount: settings.monthlyOrderCount,
      limit: 0,
      plan: settings.subscriptionPlan as PlanTier
    };
  }

  // If subscription is cancelled or expired, block
  if (settings.subscriptionStatus === "cancelled" || settings.subscriptionStatus === "expired") {
    return {
      allowed: false,
      remaining: 0,
      currentCount: settings.monthlyOrderCount,
      limit: 0,
      plan: settings.subscriptionPlan as PlanTier
    };
  }

  const plan = (settings.subscriptionPlan || "starter") as PlanTier;
  const limit = getOrderLimit(plan);
  const currentCount = settings.monthlyOrderCount;
  const remaining = getRemainingOrders(currentCount, plan);
  const limitReached = isLimitReached(currentCount, plan);

  // Update orderLimitReached flag if needed
  if (limitReached && !settings.orderLimitReached) {
    await prisma.settings.update({
      where: { shop },
      data: { orderLimitReached: true }
    });
  }

  return {
    allowed: !limitReached && isTrialOrActive,
    remaining,
    currentCount,
    limit,
    plan
  };
}

/**
 * Check if period needs to be reset (30 days passed)
 */
export async function checkAndResetPeriod(shop: string): Promise<boolean> {
  const settings = await prisma.settings.findUnique({
    where: { shop },
    select: {
      currentPeriodEnd: true,
      subscriptionStatus: true
    }
  });

  if (!settings || !settings.currentPeriodEnd) {
    return false;
  }

  const now = new Date();
  const periodEnded = now > settings.currentPeriodEnd;

  // Only reset if subscription is active
  if (periodEnded && settings.subscriptionStatus === "active") {
    await resetMonthlyCount(shop);
    return true;
  }

  return false;
}

/**
 * Get order usage statistics for dashboard
 */
export async function getOrderUsageStats(shop: string) {
  const settings = await prisma.settings.findUnique({
    where: { shop },
    select: {
      subscriptionPlan: true,
      monthlyOrderCount: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      orderLimitReached: true
    }
  });

  if (!settings) {
    return {
      plan: "starter",
      currentCount: 0,
      limit: 500,
      remaining: 500,
      percentUsed: 0,
      periodStart: new Date(),
      periodEnd: null,
      limitReached: false
    };
  }

  const plan = (settings.subscriptionPlan || "starter") as PlanTier;
  const limit = getOrderLimit(plan);
  const currentCount = settings.monthlyOrderCount;
  const remaining = getRemainingOrders(currentCount, plan);
  const percentUsed = limit === Infinity ? 0 : (currentCount / limit) * 100;

  return {
    plan,
    currentCount,
    limit,
    remaining,
    percentUsed: Math.min(100, Math.round(percentUsed)),
    periodStart: settings.currentPeriodStart,
    periodEnd: settings.currentPeriodEnd,
    limitReached: settings.orderLimitReached
  };
}

/**
 * Initialize order tracking for new shop
 */
export async function initializeOrderTracking(shop: string, plan: PlanTier = "starter"): Promise<void> {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial
  
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30); // 30-day period

  await prisma.settings.upsert({
    where: { shop },
    create: {
      shop,
      subscriptionPlan: plan,
      subscriptionStatus: "trial",
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      monthlyOrderCount: 0,
      orderLimitReached: false
    },
    update: {
      subscriptionStatus: "trial",
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      monthlyOrderCount: 0,
      orderLimitReached: false
    }
  });
}
