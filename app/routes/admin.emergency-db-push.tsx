import { json, type ActionFunctionArgs } from "@remix-run/node";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * EMERGENCY SCHEMA PUSH ENDPOINT
 * Only accessible with admin secret
 * POST /admin/emergency-db-push with header X-Admin-Secret
 */
export async function action({ request }: ActionFunctionArgs) {
  // Basic security: require secret header
  const adminSecret = request.headers.get('X-Admin-Secret');
  const expectedSecret = process.env.ADMIN_SECRET || 'cartuplift-emergency-2025';
  
  if (adminSecret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🚨 EMERGENCY: Running prisma db push...');
    
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss', {
      env: { ...process.env },
      timeout: 60000 // 60 second timeout
    });
    
    console.log('✅ Schema push completed');
    console.log('STDOUT:', stdout);
    if (stderr) console.log('STDERR:', stderr);
    
    return json({
      success: true,
      stdout,
      stderr,
      message: 'Schema pushed successfully'
    });
  } catch (error: any) {
    console.error('❌ Schema push failed:', error);
    return json({
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    }, { status: 500 });
  }
}

export async function loader() {
  return json({
    message: 'Use POST with X-Admin-Secret header to trigger emergency schema push',
    warning: 'This will apply schema changes to production database'
  });
}
