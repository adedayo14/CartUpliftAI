/**
 * ============================================================================
 * SIMILARITY COMPUTATION CRON ENDPOINT
 * ============================================================================
 * 
 * Triggered by Vercel Cron weekly to compute product similarity matrix.
 * Analyzes 90 days of purchase data to find products bought together.
 * 
 * Schedule: Weekly (Sundays at 3 AM)
 * Method: POST (from Vercel Cron) or GET (manual trigger)
 * 
 * Security: Vercel automatically adds authorization header with CRON_SECRET
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { runSimilarityComputationForAllShops } from "~/jobs/similarity-computation.server";

/**
 * POST endpoint for Vercel Cron
 */
export async function action({ request }: ActionFunctionArgs) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("❌ [SIMILARITY CRON] Unauthorized attempt");
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  
  console.log("🔄 [SIMILARITY CRON] Starting weekly similarity computation");
  
  const result = await runSimilarityComputationForAllShops();
  
  return json(result);
}

/**
 * GET endpoint for manual triggering (debugging)
 * Usage: /api/cron/compute-similarities?secret=YOUR_ADMIN_SECRET
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  
  // Check for admin secret in query params (for manual testing)
  if (secret !== process.env.ADMIN_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  
  console.log("🔄 [SIMILARITY CRON] Manual trigger via GET");
  
  const result = await runSimilarityComputationForAllShops();
  
  return json(result);
}
