/**
 * API Route: Get order usage stats
 * GET /api/order-usage
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getOrderUsageStats } from "../services/orderCounter.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  try {
    const stats = await getOrderUsageStats(session.shop);
    return json(stats);
  } catch (error) {
    console.error("Order usage error:", error);
    return json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}
