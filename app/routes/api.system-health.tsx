/**
 * ============================================================================
 * SYSTEM HEALTH API ENDPOINT
 * ============================================================================
 * 
 * Provides ML system health data for dashboard display.
 * Returns recent job runs, error rates, performance metrics.
 * 
 * Usage: GET /api/system-health?shop=mystore.myshopify.com&days=7
 * 
 * No external notifications - all data stored in database for dashboard.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getHealthSummary, getRecentHealthLogs } from "~/services/health-logger.server";
import { authenticate } from "~/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Authenticate merchant
    const { session } = await authenticate.admin(request);
    
    if (!session?.shop) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    
    const shop = session.shop;
    
    // Get health summary
    const summary = await getHealthSummary(shop, days);
    
    // Get recent logs
    const recentLogs = await getRecentHealthLogs(shop, Math.min(limit, 100));
    
    // Calculate health score (0-100)
    const healthScore = summary.totalRuns === 0 ? 100 : Math.max(0, Math.min(100,
      100 - (summary.failedRuns / summary.totalRuns * 50) - (summary.totalErrors / summary.totalRuns * 10)
    ));
    
    // Determine system status
    let systemStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (summary.failedRuns / Math.max(summary.totalRuns, 1) > 0.5) {
      systemStatus = 'critical';
    } else if (summary.failedRuns / Math.max(summary.totalRuns, 1) > 0.2) {
      systemStatus = 'degraded';
    }
    
    // Format response
    const response = {
      health: {
        score: Math.round(healthScore),
        status: systemStatus,
        lastChecked: new Date().toISOString()
      },
      summary: {
        period: `Last ${days} days`,
        totalRuns: summary.totalRuns,
        successful: summary.successfulRuns,
        failed: summary.failedRuns,
        partial: summary.partialRuns,
        totalErrors: summary.totalErrors,
        avgDurationMs: Math.round(summary.avgDurationMs),
        successRate: summary.totalRuns > 0 
          ? Math.round((summary.successfulRuns / summary.totalRuns) * 100) 
          : 100
      },
      byJobType: Object.entries(summary.byJobType).map(([jobType, stats]) => ({
        jobType,
        runs: stats.runs,
        errors: stats.errors,
        avgDurationMs: Math.round(stats.avgDurationMs),
        errorRate: stats.runs > 0 ? Math.round((stats.errors / stats.runs) * 100) : 0
      })),
      recentLogs: recentLogs.map((log: any) => ({
        id: log.id,
        jobType: log.jobType,
        status: log.status,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        durationMs: log.durationMs,
        recordsProcessed: log.recordsProcessed,
        recordsCreated: log.recordsCreated,
        recordsUpdated: log.recordsUpdated,
        errorCount: log.errorCount,
        errorMessage: log.errorMessage,
        triggeredBy: log.triggeredBy
      }))
    };
    
    return json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[SYSTEM HEALTH API] Error:', error);
    return json({ 
      error: 'Failed to fetch system health',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
