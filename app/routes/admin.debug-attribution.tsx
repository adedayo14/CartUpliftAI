import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  try {
    // Check tracking events
    const trackingEvents = await (db as any).trackingEvent?.findMany({
      where: { 
        shop: session.shop,
        event: 'ml_recommendation_served'
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    // Check attribution records
    const attributions = await (db as any).recommendationAttribution?.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    // Check recent orders (if we have access)
    let recentOrders = [];
    try {
      const ordersData = await (db as any).order?.findMany({
        where: { shop: session.shop },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      recentOrders = ordersData || [];
    } catch (e) {
      console.log("No orders table:", e);
    }
    
    return json({
      shop: session.shop,
      trackingEventCount: trackingEvents?.length || 0,
      trackingEvents: trackingEvents?.map((e: any) => ({
        id: e.id,
        event: e.event,
        productId: e.productId,
        metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
        createdAt: e.createdAt
      })) || [],
      attributionCount: attributions?.length || 0,
      attributions: attributions?.map((a: any) => ({
        id: a.id,
        productId: a.productId,
        orderId: a.orderId,
        orderNumber: a.orderNumber,
        orderValue: a.orderValue,
        attributedRevenue: a.attributedRevenue,
        createdAt: a.createdAt
      })) || [],
      recentOrderCount: recentOrders.length
    });
  } catch (error: any) {
    console.error("Debug error:", error);
    return json({ error: error.message }, { status: 500 });
  }
}
