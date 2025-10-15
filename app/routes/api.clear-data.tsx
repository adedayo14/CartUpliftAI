import { authenticate } from "../shopify.server";
import db from "../db.server";
import type { ActionFunctionArgs } from "@remix-run/node";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  if (!session?.shop) {
    return new Response("No session", { status: 401 });
  }

  try {
    // Count before deletion
    const attributionCount = await (db as any).recommendationAttribution?.count?.({
      where: { shop: session.shop }
    }) ?? 0;
    
    const trackingCount = await (db as any).trackingEvent?.count?.({
      where: { shop: session.shop }
    }) ?? 0;
    
    const analyticsCount = await (db as any).analyticsEvent?.count?.({
      where: { shop: session.shop }
    }) ?? 0;

    // Delete all tracking data for this shop
    await Promise.all([
      (db as any).recommendationAttribution?.deleteMany?.({
        where: { shop: session.shop }
      }),
      (db as any).trackingEvent?.deleteMany?.({
        where: { shop: session.shop }
      }),
      (db as any).analyticsEvent?.deleteMany?.({
        where: { shop: session.shop }
      })
    ]);

    console.log(`🗑️ [Data Reset] Cleared data for ${session.shop}:
      - ${attributionCount} attribution records
      - ${trackingCount} tracking events
      - ${analyticsCount} analytics events`);

    return new Response(JSON.stringify({ 
      success: true,
      cleared: {
        attributions: attributionCount,
        tracking: trackingCount,
        analytics: analyticsCount,
        total: attributionCount + trackingCount + analyticsCount
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Failed to clear data:", e);
    return new Response(JSON.stringify({ error: "Failed to clear data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

// Simple GET endpoint that returns instructions
export const loader = async () => {
  return new Response(`
    <html>
      <head><title>Clear Attribution Data</title></head>
      <body style="font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px;">
        <h1>🗑️ Clear Attribution Data</h1>
        <p>This will delete ALL tracking data for your shop:</p>
        <ul>
          <li>Attribution records (Revenue from AI Recommendations)</li>
          <li>Tracking events (clicks, impressions)</li>
          <li>Analytics events (cart opens)</li>
        </ul>
        <p><strong>Your settings and orders will NOT be affected.</strong></p>
        <button onclick="clearData()" style="
          background: #c41e3a;
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 20px;
        ">
          Clear All Data (Cannot be undone)
        </button>
        <div id="result" style="margin-top: 20px;"></div>
        <script>
          async function clearData() {
            if (!confirm('Are you sure? This cannot be undone!')) return;
            
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = 'Clearing...';
            
            try {
              const response = await fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              
              const data = await response.json();
              
              if (data.success) {
                document.getElementById('result').innerHTML = 
                  '<div style="background: #d4edda; padding: 15px; border-radius: 6px; color: #155724;">' +
                  '<strong>✅ Success!</strong><br>' +
                  'Cleared ' + data.cleared.total + ' total records:<br>' +
                  '• ' + data.cleared.attributions + ' attributions<br>' +
                  '• ' + data.cleared.tracking + ' tracking events<br>' +
                  '• ' + data.cleared.analytics + ' analytics events<br><br>' +
                  '<a href="/app/dashboard">Go to Dashboard →</a>' +
                  '</div>';
                btn.style.display = 'none';
              } else {
                throw new Error(data.error || 'Unknown error');
              }
            } catch (e) {
              document.getElementById('result').innerHTML = 
                '<div style="background: #f8d7da; padding: 15px; border-radius: 6px; color: #721c24;">' +
                '<strong>❌ Error:</strong> ' + e.message +
                '</div>';
              btn.disabled = false;
              btn.textContent = 'Clear All Data (Cannot be undone)';
            }
          }
        </script>
      </body>
    </html>
  `, {
    status: 200,
    headers: { "Content-Type": "text/html" }
  });
};
