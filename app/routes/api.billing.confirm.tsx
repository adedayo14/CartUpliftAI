/**
 * API Route: Confirm subscription
 * GET /api/billing/confirm
 * Shopify redirects here after merchant approves charge
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { confirmSubscription } from "../services/billing.server";
import { isValidPlan, type PlanTier } from "../config/billing.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");
  const plan = url.searchParams.get("plan");

  if (!chargeId || !plan || !isValidPlan(plan)) {
    return redirect("/app?billing=error");
  }

  try {
    const success = await confirmSubscription(
      admin,
      session.shop,
      chargeId,
      plan as PlanTier
    );

    if (success) {
      return redirect("/app?billing=success");
    }

    return redirect("/app?billing=error");
  } catch (error) {
    console.error("Confirmation error:", error);
    return redirect("/app?billing=error");
  }
}
