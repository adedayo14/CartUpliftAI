/**
 * API Route: Cancel subscription
 * POST /api/billing/cancel
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { cancelSubscription } from "../services/billing.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const success = await cancelSubscription(admin, session.shop);

    return json({ success });
  } catch (error) {
    console.error("Cancel error:", error);
    return json({
      success: false,
      error: "Internal server error",
    }, { status: 500 });
  }
}
