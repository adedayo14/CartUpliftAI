import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  DeliveryMethod,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: true,
  webhooks: {
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/create",
    },
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // Register webhooks automatically after merchant installs/authenticates
      console.log(`🔧 Registering webhooks for shop: ${session.shop}`);
      
      try {
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
          // Check if it's just a duplicate webhook error
          if (errors.some((e: any) => e.message?.includes('already exists'))) {
            console.log(`ℹ️  Webhook already exists for ${session.shop}`);
          } else {
            console.error(`❌ Webhook registration errors:`, errors);
          }
        } else {
          console.log(`✅ Webhook registered successfully for ${session.shop}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to register webhook:`, error);
      }
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
