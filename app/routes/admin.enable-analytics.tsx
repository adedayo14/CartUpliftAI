import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import db from "~/db.server";

/**
 * Quick admin endpoint to enable analytics tracking
 * Visit: /admin/enable-analytics
 */

export const action: ActionFunction = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const settings = await db.settings.upsert({
      where: { shop },
      update: { 
        enableAnalytics: true 
      },
      create: {
        shop,
        enableAnalytics: true,
        enableApp: true,
      },
    });

    return json({
      success: true,
      message: "Analytics enabled successfully!",
      enableAnalytics: settings.enableAnalytics,
    });
  } catch (error) {
    console.error("Error enabling analytics:", error);
    return json(
      { 
        success: false, 
        error: "Failed to enable analytics" 
      },
      { status: 500 }
    );
  }
};

export const loader = async ({ request }: { request: Request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const settings = await db.settings.findUnique({
      where: { shop },
      select: {
        enableAnalytics: true,
        enableApp: true,
      },
    });

    return json({
      shop,
      settings,
      message: "Send a POST request to this endpoint to enable analytics",
    });
  } catch (_error) {
    return json({ error: "Failed to load settings" }, { status: 500 });
  }
};
