/**
 * ============================================================================
 * USER PROFILE UPDATE CRON ENDPOINT
 * ============================================================================
 * 
 * Triggered by Vercel Cron daily to update user profiles from tracking events.
 * Extracts behavioral patterns and updates MLUserProfile records.
 * 
 * Schedule: Daily at 2:30 AM (30 min after daily learning)
 * Method: POST (from Vercel Cron) or GET (manual trigger)
 * 
 * Security: Vercel automatically adds authorization header with CRON_SECRET
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { runUserProfileUpdateForAllShops } from "~/jobs/user-profile-update.server";

/**
 * POST endpoint for Vercel Cron
 */
export async function action({ request }: ActionFunctionArgs) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("❌ [PROFILE CRON] Unauthorized attempt");
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  
  console.log("🔄 [PROFILE CRON] Starting daily user profile update");
  
  const result = await runUserProfileUpdateForAllShops();
  
  return json(result);
}

/**
 * GET endpoint for manual triggering (debugging)
 * Usage: /api/cron/update-profiles?secret=YOUR_ADMIN_SECRET
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  
  // Check for admin secret in query params (for manual testing)
  if (secret !== process.env.ADMIN_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  
  console.log("🔄 [PROFILE CRON] Manual trigger via GET");
  
  const result = await runUserProfileUpdateForAllShops();
  
  return json(result);
}
