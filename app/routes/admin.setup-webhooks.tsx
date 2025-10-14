import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  console.log(`🔧 Manually registering webhooks for shop: ${session.shop}`);
  
  try {
    // First, check if webhook already exists
    const existingWebhooks = await admin.graphql(
      `#graphql
      query {
        webhookSubscriptions(first: 50) {
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
            }
          }
        }
      }`
    );
    
    const existingData = await existingWebhooks.json();
    const webhooks = existingData.data?.webhookSubscriptions?.edges || [];
    
    const ordersCreateExists = webhooks.some((edge: any) => 
      edge.node.topic === 'ORDERS_CREATE'
    );
    
    if (ordersCreateExists) {
      console.log(`ℹ️  ORDERS_CREATE webhook already exists for ${session.shop}`);
      return json({ 
        success: true, 
        message: 'Webhook already registered',
        webhooks: webhooks.map((e: any) => ({
          id: e.node.id,
          topic: e.node.topic,
          callbackUrl: e.node.endpoint?.callbackUrl
        }))
      });
    }
    
    // Create the webhook
    const response = await admin.graphql(
      `#graphql
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            topic
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          topic: 'ORDERS_CREATE',
          webhookSubscription: {
            callbackUrl: `${process.env.SHOPIFY_APP_URL}/webhooks/orders/create`,
            format: 'JSON',
          },
        },
      }
    );
    
    const result = await response.json();
    
    if (result.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
      const errors = result.data.webhookSubscriptionCreate.userErrors;
      console.error(`❌ Webhook registration errors:`, errors);
      return json({ 
        success: false, 
        errors 
      }, { status: 400 });
    }
    
    console.log(`✅ Webhook registered successfully for ${session.shop}`);
    console.log(`Webhook ID: ${result.data?.webhookSubscriptionCreate?.webhookSubscription?.id}`);
    
    return json({ 
      success: true, 
      message: 'Webhook registered successfully',
      webhook: result.data?.webhookSubscriptionCreate?.webhookSubscription
    });
    
  } catch (error: any) {
    console.error(`❌ Failed to register webhook:`, error);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function loader() {
  return json({ message: 'POST to this endpoint to register webhooks' });
}
