#!/usr/bin/env node

/**
 * Webhook Setup Verification Tool
 * 
 * This script helps diagnose webhook configuration issues by:
 * 1. Testing if the webhook endpoint is accessible
 * 2. Checking database for tracking events (recommendations served)
 * 3. Checking database for attribution records (purchases tracked)
 * 4. Providing clear next steps
 */

import https from 'https';

console.log('🔍 CartUplift Webhook Verification Tool\n');

// Test 1: Check if webhook endpoint is accessible
console.log('📡 Test 1: Webhook Endpoint Accessibility');
console.log('Testing: https://cartuplift.vercel.app/webhooks/orders/create');

https.get('https://cartuplift.vercel.app/webhooks/orders/create', (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  if (res.statusCode === 405) {
    console.log('✅ Endpoint exists (405 = Method Not Allowed for GET, expects POST)\n');
  } else if (res.statusCode === 200) {
    console.log('✅ Endpoint is accessible\n');
  } else {
    console.log(`⚠️  Unexpected status: ${res.statusCode}\n`);
  }
  
  // Test 2: Database checks
  console.log('📊 Test 2: Database Status');
  console.log('To check database records, run these queries in Prisma Studio or via CLI:\n');
  
  console.log('-- Check tracking events (recommendations served)');
  console.log('SELECT COUNT(*) as total_tracking_events FROM "TrackingEvent" WHERE "eventType" = \'ml_recommendation_served\';');
  console.log('SELECT "metadata" FROM "TrackingEvent" WHERE "eventType" = \'ml_recommendation_served\' LIMIT 5;\n');
  
  console.log('-- Check attribution records (purchases tracked)');
  console.log('SELECT COUNT(*) as total_attributions FROM "RecommendationAttribution";');
  console.log('SELECT * FROM "RecommendationAttribution" ORDER BY "createdAt" DESC LIMIT 5;\n');
  
  // Test 3: Shopify webhook registration
  console.log('🔗 Test 3: Shopify Webhook Registration');
  console.log('Manual check required:');
  console.log('1. Visit: https://admin.shopify.com/store/sectionappblocks/settings/notifications/webhooks');
  console.log('2. Look for webhook with:');
  console.log('   - Event: Order creation');
  console.log('   - URL: https://cartuplift.vercel.app/webhooks/orders/create');
  console.log('   - Format: JSON\n');
  
  // Test 4: Setup button
  console.log('🎯 Test 4: Manual Webhook Setup');
  console.log('If webhook is missing in Shopify:');
  console.log('1. Open your app dashboard: https://admin.shopify.com/store/sectionappblocks/apps/cartuplift-2');
  console.log('2. Look for blue banner with "Setup Revenue Tracking" button');
  console.log('3. Click the button');
  console.log('4. Wait for "✓ Webhooks configured" message');
  console.log('5. Refresh Shopify webhook settings page to verify\n');
  
  // Test 5: End-to-end test
  console.log('🧪 Test 5: End-to-End Attribution Test');
  console.log('After webhook is registered:');
  console.log('1. Visit your store: https://sectionappblocks.myshopify.com');
  console.log('2. Add products to cart');
  console.log('3. Open cart drawer (should show recommendations)');
  console.log('4. Add a recommended product');
  console.log('5. Complete checkout');
  console.log('6. Check Vercel logs for "🎯 Order webhook START"');
  console.log('7. Refresh dashboard - attribution should show > £0\n');
  
  console.log('📋 Expected Log Flow in Vercel:');
  console.log('When order is placed with recommended product:');
  console.log('- "🎯 Order webhook START: Shop sectionappblocks.myshopify.com"');
  console.log('- "📦 Processing order #[number]"');
  console.log('- "Purchased product IDs: [9654262522156, 9654270976300]"');
  console.log('- "Found X ml_recommendation_served events"');
  console.log('- "✅ Created attribution record for product [ID]"');
  console.log('- "💰 Total attributed revenue: £[amount]"\n');
  
  console.log('🔍 Vercel Logs:');
  console.log('https://vercel.com/adedayo14/cartuplift/logs\n');
  
  console.log('✅ Verification complete!');
  console.log('If you need help, check ATTRIBUTION_NOT_WORKING.md for detailed troubleshooting.');
  
}).on('error', (err) => {
  console.error('❌ Failed to reach webhook endpoint:', err.message);
  console.log('\nThis could mean:');
  console.log('- Vercel deployment is down');
  console.log('- DNS issue');
  console.log('- Network connectivity problem\n');
});
