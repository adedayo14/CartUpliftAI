/**
 * Delete a specific webhook subscription by ID
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  const formData = await request.formData();
  const webhookId = formData.get("webhookId") as string;
  
  if (!webhookId) {
    return json({ error: "Webhook ID required" }, { status: 400 });
  }
  
  console.log(`🗑️ Deleting webhook ${webhookId} for ${session.shop}...`);
  
  try {
    const response = await admin.graphql(`
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
      variables: {
        id: webhookId
      }
    });
    
    const result = await response.json();
    
    console.log("\n✅ Delete result:");
    console.log(JSON.stringify(result, null, 2));
    
    if (result.data?.webhookSubscriptionDelete?.userErrors?.length > 0) {
      return json({ 
        error: result.data.webhookSubscriptionDelete.userErrors[0].message 
      }, { status: 400 });
    }
    
    return json({
      success: true,
      deletedId: result.data?.webhookSubscriptionDelete?.deletedWebhookSubscriptionId
    });
    
  } catch (error: any) {
    console.error("❌ Error deleting webhook:", error);
    return json({ error: error.message }, { status: 500 });
  }
}
