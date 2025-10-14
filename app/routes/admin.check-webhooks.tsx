/**
 * Check for duplicate webhook subscriptions
 * Create an admin route that lists webhooks via the admin API
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../app/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  console.log(`🔍 Checking webhooks for ${session.shop}...`);
  
  try {
    const response = await admin.graphql(`
      query {
        webhookSubscriptions(first: 20, topics: ORDERS_CREATE) {
          edges {
            node {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
              createdAt
              updatedAt
            }
          }
        }
      }
    `);
    
    const result = await response.json();
    
    console.log("\n📋 ORDERS_CREATE Webhook Subscriptions:");
    console.log(JSON.stringify(result, null, 2));
    
    const webhooks = result.data?.webhookSubscriptions?.edges || [];
    
    return json({
      shop: session.shop,
      count: webhooks.length,
      webhooks: webhooks.map((edge: any) => ({
        id: edge.node.id,
        topic: edge.node.topic,
        url: edge.node.endpoint?.callbackUrl,
        created: edge.node.createdAt,
        updated: edge.node.updatedAt
      }))
    });
    
  } catch (error: any) {
    console.error("❌ Error checking webhooks:", error);
    return json({ error: error.message }, { status: 500 });
  }
}
