// Unified tracking endpoint for cart analytics and recommendations
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    
    const eventType = formData.get("eventType") as string;
    const shop = formData.get("shop") as string;
    const sessionId = formData.get("sessionId") as string;
    
    if (!eventType || !shop) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Handle recommendation/product tracking (for ML analytics)
    if (eventType === "impression" || eventType === "click" || eventType === "add_to_cart") {
      const productId = formData.get("productId") as string;
      const productTitle = formData.get("productTitle") as string | null;
      const source = formData.get("source") as string | null;
      const position = formData.get("position") ? parseInt(formData.get("position") as string) : null;

      if (!productId) {
        return json({ error: "Missing productId for product event" }, { status: 400 });
      }

      await (db as any).trackingEvent.create({
        data: {
          shop,
          event: eventType,
          productId,
          productTitle: productTitle || undefined,
          sessionId: sessionId || undefined,
          source: source || "cart_drawer",
          position,
          createdAt: new Date(),
        },
      });

      return json({ success: true }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Handle cart analytics tracking (cart open/close, checkout, etc.)
    const productId = formData.get("productId") as string | null;
    const productTitle = formData.get("productTitle") as string | null;
    const revenue = formData.get("revenue") ? parseFloat(formData.get("revenue") as string) : null;
    const orderId = formData.get("orderId") as string | null;

    await (db as any).analyticsEvent.create({
      data: {
        shop,
        eventType,
        sessionId: sessionId || undefined,
        orderId: orderId || undefined,
        orderValue: revenue ? revenue : undefined,
        productIds: productId ? JSON.stringify([productId]) : undefined,
        metadata: {
          productTitle,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      },
    });

    return json({ success: true }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Tracking error:", error);
    return json({ error: "Failed to track event" }, { status: 500 });
  }
};

// Support CORS preflight
export const loader = async ({ request }: ActionFunctionArgs) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  return json({ status: 'ok' });
};
