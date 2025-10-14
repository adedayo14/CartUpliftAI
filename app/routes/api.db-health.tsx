import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

/**
 * Database health check endpoint
 * GET /api/db-health
 * Returns status of critical tables and DB connectivity
 */
export async function loader({ request: _request }: LoaderFunctionArgs) {
  const results: any = {
    connected: false,
    timestamp: new Date().toISOString(),
    tables: {},
    errors: []
  };

  try {
    // Test basic connectivity
    await prisma.$connect();
    results.connected = true;

    // Check for Session table
    try {
      const sessionCount = await prisma.session.count();
      results.tables.Session = { exists: true, count: sessionCount };
    } catch (e: any) {
      results.tables.Session = { exists: false, error: e.message };
      results.errors.push(`Session table: ${e.message}`);
    }

    // Check for Settings table
    try {
      const settingsCount = await prisma.settings.count();
      results.tables.Settings = { exists: true, count: settingsCount };
    } catch (e: any) {
      results.tables.Settings = { exists: false, error: e.message };
      results.errors.push(`Settings table: ${e.message}`);
    }

    // Check for TrackingEvent table
    try {
      const trackingCount = await prisma.trackingEvent.count();
      results.tables.TrackingEvent = { exists: true, count: trackingCount };
    } catch (e: any) {
      results.tables.TrackingEvent = { exists: false, error: e.message };
      results.errors.push(`TrackingEvent table: ${e.message}`);
    }

    // Check for RecommendationAttribution table
    try {
      const attrCount = await prisma.recommendationAttribution.count();
      results.tables.RecommendationAttribution = { exists: true, count: attrCount };
    } catch (e: any) {
      results.tables.RecommendationAttribution = { exists: false, error: e.message };
      results.errors.push(`RecommendationAttribution table: ${e.message}`);
    }

    await prisma.$disconnect();

    const allTablesExist = Object.values(results.tables).every((t: any) => t.exists);
    results.healthy = allTablesExist && results.errors.length === 0;

    if (!allTablesExist) {
      results.remedy = 'Run: npx prisma db push --accept-data-loss';
    }

    return json(results, {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    results.errors.push(error.message);
    return json({
      ...results,
      healthy: false,
      error: error.message
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
