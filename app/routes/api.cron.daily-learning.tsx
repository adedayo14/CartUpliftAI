import { json, type ActionFunctionArgs } from "@remix-run/node";
import { runDailyLearningForAllShops } from "~/jobs/daily-learning.server";

/**
 * 🕐 VERCEL CRON ENDPOINT
 * 
 * Triggered by Vercel Cron Jobs daily at 2 AM
 * 
 * Security: Verify CRON_SECRET to prevent unauthorized access
 */

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Verify cron secret (Vercel automatically adds this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️ Unauthorized cron attempt');
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🕐 Cron job triggered: daily-learning');
    
    const results = await runDailyLearningForAllShops();
    
    return json({
      success: true,
      message: 'Daily learning completed',
      results
    });
    
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    return json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

// Also support GET for manual triggering (admin only)
export async function loader({ request }: ActionFunctionArgs) {
  // Check for admin secret
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  
  if (secret !== process.env.ADMIN_SECRET) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.log('🔄 Manual trigger: daily-learning');
  const results = await runDailyLearningForAllShops();
  
  return json({
    success: true,
    message: 'Daily learning completed (manual trigger)',
    results
  });
}
