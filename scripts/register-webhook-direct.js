#!/usr/bin/env node

/**
 * Direct Webhook Registration Script
 * 
 * This script registers the orders/create webhook directly
 * using the Shopify Admin API, bypassing the web UI entirely.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function registerWebhook() {
  console.log('🔧 Direct Webhook Registration Tool\n');
  
  const shop = 'sectionappblocks.myshopify.com';
  
  try {
    // Get the session from database
    console.log(`📦 Fetching session for ${shop}...`);
    const session = await prisma.session.findFirst({
      where: { shop },
      orderBy: { expires: 'desc' }
    });
    
    if (!session) {
      console.error(`❌ No session found for ${shop}`);
      console.log('This means the app needs to be reinstalled or authenticated.');
      process.exit(1);
    }
    
    console.log(`✅ Found session (expires: ${session.expires})`);
    
    const accessToken = session.accessToken;
    const apiVersion = '2025-01';
    
    // Register webhook via GraphQL
    console.log('\n🔗 Registering ORDERS_CREATE webhook...');
    
    const mutation = `
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
      }
    `;
    
    const variables = {
      topic: 'ORDERS_CREATE',
      webhookSubscription: {
        callbackUrl: 'https://cartuplift.vercel.app/webhooks/orders/create',
        format: 'JSON'
      }
    };
    
    const response = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query: mutation, variables })
    });
    
    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ GraphQL Errors:', result.errors);
      process.exit(1);
    }
    
    const { webhookSubscription, userErrors } = result.data.webhookSubscriptionCreate;
    
    if (userErrors && userErrors.length > 0) {
      if (userErrors.some(e => e.message?.includes('already exists'))) {
        console.log('ℹ️  Webhook already exists!');
        console.log('\n✅ Success! Webhook is registered.');
      } else {
        console.error('❌ User Errors:', userErrors);
        process.exit(1);
      }
    } else {
      console.log('✅ Webhook created successfully!');
      console.log(`   ID: ${webhookSubscription.id}`);
      console.log(`   Topic: ${webhookSubscription.topic}`);
    }
    
    console.log('\n📋 Verification:');
    console.log('Visit: https://admin.shopify.com/store/sectionappblocks/settings/notifications/webhooks');
    console.log('You should see:');
    console.log('  - Event: Order creation');
    console.log('  - URL: https://cartuplift.vercel.app/webhooks/orders/create');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

registerWebhook();
