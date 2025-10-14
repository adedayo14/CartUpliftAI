/**
 * Remove ALL webhook subscriptions and recreate them
 * This fixes the duplicate webhook 401 issue
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  console.log(`🔄 Deleting duplicate webhooks for ${session.shop}...`);
  
  try {
    // 1. Get all ORDERS_CREATE webhooks
    const listResponse = await admin.graphql(`
      query {
        webhookSubscriptions(first: 50, topics: ORDERS_CREATE) {
          edges {
            node {
              id
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
          }
        }
      }
    `);
    
    const listResult = await listResponse.json();
    const webhooks = listResult.data?.webhookSubscriptions?.edges || [];
    
    console.log(`📋 Found ${webhooks.length} ORDERS_CREATE webhooks`);
    
    // 2. Delete all of them
    const deleted = [];
    for (const webhook of webhooks) {
      const webhookId = webhook.node.id;
      const url = webhook.node.endpoint?.callbackUrl;
      console.log(`🗑️ Deleting: ${webhookId} (${url})`);
      
      await admin.graphql(`
        mutation webhookSubscriptionDelete($id: ID!) {
          webhookSubscriptionDelete(id: $id) {
            deletedWebhookSubscriptionId
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: { id: webhookId }
      });
      
      deleted.push({ id: webhookId, url });
    }
    
    console.log(`✅ Deleted ${deleted.length} webhooks`);
    console.log("ℹ️ Webhooks will be recreated automatically on next app install/auth");
    
    return json({
      success: true,
      deleted: deleted.length,
      webhooks: deleted,
      message: "Webhooks deleted. They will be recreated automatically when you reload the app."
    });
    
  } catch (error: any) {
    console.error("❌ Error deleting webhooks:", error);
    return json({ error: error.message }, { status: 500 });
  }
}
