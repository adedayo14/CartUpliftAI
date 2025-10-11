/**
 * Shopify Billing Service
 * Handles subscription creation, confirmation, and cancellation
 */

import prisma from "../db.server";
import { PRICING_PLANS, BILLING_CONFIG, type PlanTier } from "../config/billing.server";
import { resetMonthlyCount, initializeOrderTracking } from "./orderCounter.server";

export interface SubscriptionResult {
  success: boolean;
  confirmationUrl?: string;
  error?: string;
}

interface GraphQLClient {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

/**
 * Create a recurring subscription via Shopify Billing API
 */
export async function createSubscription(
  admin: GraphQLClient,
  shop: string,
  planTier: PlanTier
): Promise<SubscriptionResult> {
  try {
    const plan = PRICING_PLANS[planTier];
    
    const response = await admin.graphql(
      `#graphql
      mutation CreateAppSubscription(
        $name: String!
        $returnUrl: URL!
        $test: Boolean
        $lineItems: [AppSubscriptionLineItemInput!]!
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          test: $test
          lineItems: $lineItems
        ) {
          appSubscription {
            id
            status
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          name: plan.name,
          returnUrl: `${BILLING_CONFIG.returnUrl}?shop=${shop}&plan=${planTier}`,
          test: BILLING_CONFIG.testMode,
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: { amount: plan.price, currencyCode: "USD" },
                  interval: plan.interval,
                },
              },
            },
          ],
        },
      }
    );

    const data = await response.json();
    const result = data.data?.appSubscriptionCreate;

    if (result?.userErrors?.length > 0) {
      return {
        success: false,
        error: result.userErrors[0].message,
      };
    }

    if (result?.confirmationUrl) {
      // Store pending subscription info
      await prisma.settings.upsert({
        where: { shop },
        create: {
          shop,
          subscriptionPlan: planTier,
          subscriptionStatus: "trial", // Keep trial until confirmed
        },
        update: {
          subscriptionPlan: planTier,
        },
      });

      return {
        success: true,
        confirmationUrl: result.confirmationUrl,
      };
    }

    return {
      success: false,
      error: "Failed to create subscription",
    };
  } catch (error) {
    console.error("Billing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Confirm subscription after merchant approves charge
 */
export async function confirmSubscription(
  admin: GraphQLClient,
  shop: string,
  chargeId: string,
  planTier: PlanTier
): Promise<boolean> {
  try {
    // Verify the charge with Shopify
    const response = await admin.graphql(
      `#graphql
      query GetAppSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            status
            name
            test
          }
        }
      }`,
      {
        variables: {
          id: chargeId,
        },
      }
    );

    const data = await response.json();
    const subscription = data.data?.node;

    if (subscription?.status === "ACTIVE") {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      // Update settings with active subscription
      await prisma.settings.update({
        where: { shop },
        data: {
          subscriptionStatus: "active",
          subscriptionPlan: planTier,
          subscriptionStartedAt: now,
          chargeId: chargeId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          monthlyOrderCount: 0,
          orderLimitReached: false,
        },
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error("Confirmation error:", error);
    return false;
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  admin: GraphQLClient,
  shop: string
): Promise<boolean> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { shop },
      select: { chargeId: true },
    });

    if (!settings?.chargeId) {
      return false;
    }

    const response = await admin.graphql(
      `#graphql
      mutation CancelAppSubscription($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          id: settings.chargeId,
        },
      }
    );

    const data = await response.json();
    const result = data.data?.appSubscriptionCancel;

    if (result?.userErrors?.length === 0) {
      await prisma.settings.update({
        where: { shop },
        data: {
          subscriptionStatus: "cancelled",
        },
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error("Cancellation error:", error);
    return false;
  }
}

/**
 * Check subscription status from Shopify
 */
export async function checkSubscriptionStatus(
  admin: GraphQLClient,
  shop: string
): Promise<string | null> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { shop },
      select: { chargeId: true },
    });

    if (!settings?.chargeId) {
      return null;
    }

    const response = await admin.graphql(
      `#graphql
      query GetAppSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            status
          }
        }
      }`,
      {
        variables: {
          id: settings.chargeId,
        },
      }
    );

    const data = await response.json();
    return data.data?.node?.status || null;
  } catch (error) {
    console.error("Status check error:", error);
    return null;
  }
}

/**
 * Handle subscription renewal (webhook handler)
 */
export async function handleSubscriptionRenewal(shop: string): Promise<void> {
  await resetMonthlyCount(shop);
}

/**
 * Handle trial expiration
 */
export async function handleTrialExpiration(shop: string): Promise<void> {
  await prisma.settings.update({
    where: { shop },
    data: {
      subscriptionStatus: "expired",
    },
  });
}

/**
 * Initialize subscription for new install
 */
export async function initializeSubscription(shop: string): Promise<void> {
  await initializeOrderTracking(shop, "starter");
}
