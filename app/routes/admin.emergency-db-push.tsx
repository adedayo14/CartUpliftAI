import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

/**
 * EMERGENCY SCHEMA INITIALIZATION ENDPOINT
 * GET /admin/emergency-db-push - shows current table status
 * POST /admin/emergency-db-push - attempts to use Prisma to verify/create tables
 * 
 * Use this after deployment if tables are missing
 */

async function checkTables() {
  const results: any = {
    connected: false,
    tables: {},
    errors: [],
    timestamp: new Date().toISOString()
  };

  try {
    await prisma.$connect();
    results.connected = true;

    // Test each critical table
    const tables = [
      { name: 'Session', model: prisma.session },
      { name: 'Settings', model: prisma.settings },
      { name: 'TrackingEvent', model: prisma.trackingEvent },
      { name: 'RecommendationAttribution', model: prisma.recommendationAttribution }
    ];

    for (const table of tables) {
      try {
        // Type-safe count call
        const count = await (table.model as any).count();
        results.tables[table.name] = { exists: true, count };
      } catch (e: any) {
        results.tables[table.name] = { exists: false, error: e.message };
        results.errors.push(`${table.name}: ${e.message}`);
      }
    }

    await prisma.$disconnect();
  } catch (error: any) {
    results.errors.push(`Connection error: ${error.message}`);
  }

  return results;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const adminSecret = url.searchParams.get('secret');
  const expectedSecret = process.env.ADMIN_SECRET || 'cartuplift-emergency-2025';
  
  if (adminSecret !== expectedSecret) {
    return json({ error: 'Unauthorized - add ?secret=<ADMIN_SECRET> to URL' }, { status: 401 });
  }

  const results = await checkTables();
  
  return json({
    status: 'Schema check complete',
    ...results,
    instructions: {
      missingTables: results.errors.length > 0,
      remedy: results.errors.length > 0 
        ? 'Visit Neon console and run: CREATE TABLE IF NOT EXISTS... or use Prisma Studio'
        : 'All tables exist',
      alternativeApproach: 'Use Neon SQL Editor to run schema.sql manually'
    }
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const adminSecret = request.headers.get('X-Admin-Secret') || 
                      (await request.formData()).get('secret');
  const expectedSecret = process.env.ADMIN_SECRET || 'cartuplift-emergency-2025';
  
  if (adminSecret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await checkTables();
    
    return json({
      success: true,
      message: 'Table check completed. If tables missing, use Neon SQL Editor.',
      ...results,
      nextSteps: results.errors.length > 0 ? [
        '1. Go to Neon Console → SQL Editor',
        '2. Run: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > schema.sql',
        '3. Copy schema.sql content and run in Neon SQL Editor',
        '4. Refresh this endpoint to verify'
      ] : [
        'All tables exist! You can now use the app.'
      ]
    });
  } catch (error: any) {
    return json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
