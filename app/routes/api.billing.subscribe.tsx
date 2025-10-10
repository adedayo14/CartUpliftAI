/**
 * API Route: Subscribe to a plan
 * POST /api/billing/subscribe
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createSubscription } from "../services/billing.server";
import { isValidPlan, type PlanTier } from "../config/billing.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const plan = formData.get("plan") as string;

    if (!plan || !isValidPlan(plan)) {
      return json({ error: "Invalid plan" }, { status: 400 });
    }

    const result = await createSubscription(admin, session.shop, plan as PlanTier);

    if (result.success && result.confirmationUrl) {
      return json({
        success: true,
        confirmationUrl: result.confirmationUrl,
      });
    }

    return json({
      success: false,
      error: result.error || "Failed to create subscription",
    }, { status: 400 });
  } catch (error) {
    console.error("Subscribe error:", error);
    return json({
      success: false,
      error: "Internal server error",
    }, { status: 500 });
  }
}
