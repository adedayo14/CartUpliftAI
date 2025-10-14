import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

/**
 * Track ML recommendation served events
 * Called by theme extension when recommendations are displayed
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { shop, sessionId, customerId, anchorProducts, recommendedProducts } = body;

    if (!shop || !anchorProducts || !recommendedProducts) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log('📈 Saving ml_recommendation_served event', {
      shop,
      anchorCount: anchorProducts.length,
      recommendedCount: recommendedProducts.length
    });

    // Save the ml_recommendation_served event
    await (db as any).trackingEvent.create({
      data: {
        shop,
        event: 'ml_recommendation_served',
        productId: anchorProducts[0] || '',
        sessionId: sessionId || null,
        customerId: customerId || null,
        source: 'cart_drawer',
        metadata: JSON.stringify({
          anchors: anchorProducts,
          recommendationCount: recommendedProducts.length,
          recommendationIds: recommendedProducts, // 🎯 KEY: For purchase attribution
          clientGenerated: true,
          timestamp: new Date().toISOString()
        }),
        createdAt: new Date()
      }
    });

    console.log('✅ ml_recommendation_served event saved successfully');

    return json({ success: true }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });

  } catch (error) {
    console.error('❌ Failed to save ml_recommendation_served event:', error);
    return json({ error: "Failed to save event" }, { status: 500 });
  }
};

// Handle OPTIONS for CORS
export const loader = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
};
