/**
 * Manual Attribution Test Script
 * 
 * Run this to manually check why attribution isn't working:
 * node scripts/test-attribution.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAttribution() {
  console.log('\n🔍 TESTING ATTRIBUTION SYSTEM\n');
  
  const shop = 'sectionappblocks.myshopify.com';
  
  try {
    // 1. Check TrackingEvent table
    console.log('📊 STEP 1: Checking TrackingEvent table...');
    const trackingEvents = await prisma.trackingEvent.findMany({
      where: { shop },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`   Found ${trackingEvents.length} tracking events`);
    
    const mlEvents = trackingEvents.filter(e => e.event === 'ml_recommendation_served');
    console.log(`   Found ${mlEvents.length} ml_recommendation_served events`);
    
    if (mlEvents.length > 0) {
      const latestEvent = mlEvents[0];
      console.log('\n   Latest ml_recommendation_served event:');
      console.log(`   - ID: ${latestEvent.id}`);
      console.log(`   - Created: ${latestEvent.createdAt}`);
      console.log(`   - SessionId: ${latestEvent.sessionId}`);
      console.log(`   - CustomerId: ${latestEvent.customerId}`);
      
      try {
        const metadata = typeof latestEvent.metadata === 'string' 
          ? JSON.parse(latestEvent.metadata) 
          : latestEvent.metadata;
        console.log(`   - Recommendations: ${metadata?.recommendationIds?.length || 0} products`);
        console.log(`   - Product IDs: ${(metadata?.recommendationIds || []).slice(0, 3).join(', ')}...`);
      } catch (e) {
        console.log(`   - Metadata parse error: ${e.message}`);
      }
    } else {
      console.log('   ⚠️  NO ml_recommendation_served events found!');
      console.log('   This means recommendations aren\'t being tracked properly.');
    }
    
    // 2. Check RecommendationAttribution table
    console.log('\n📊 STEP 2: Checking RecommendationAttribution table...');
    const attributions = await prisma.recommendationAttribution.findMany({
      where: { shop },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`   Found ${attributions.length} attribution records`);
    
    if (attributions.length > 0) {
      console.log('\n   Recent attributions:');
      attributions.slice(0, 3).forEach(attr => {
        console.log(`   - Order ${attr.orderId}: £${attr.attributedRevenue.toFixed(2)} from product ${attr.productId}`);
      });
    } else {
      console.log('   ❌ NO attribution records found!');
      console.log('   This confirms the webhook isn\'t creating attributions.');
    }
    
    // 3. Simulate attribution logic
    console.log('\n📊 STEP 3: Simulating attribution for latest ml_recommendation_served...');
    
    if (mlEvents.length > 0) {
      const event = mlEvents[0];
      try {
        const metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        
        const recommendedIds = metadata?.recommendationIds || [];
        console.log(`   Recommended product IDs: ${recommendedIds.join(', ')}`);
        
        // Check if we have any recent orders
        console.log('\n📦 Checking recent test orders...');
        console.log('   (Note: This script can\'t access Shopify orders directly)');
        console.log('   You need to check your Shopify admin for order product IDs');
        console.log('   Compare them with the recommended IDs above');
        
      } catch (e) {
        console.log(`   Error parsing metadata: ${e.message}`);
      }
    }
    
    // 4. Check webhook endpoint
    console.log('\n📊 STEP 4: Webhook configuration check...');
    console.log('   Expected webhook URL: https://cartuplift.vercel.app/webhooks/orders/create');
    console.log('   ⚠️  Go to Shopify Admin → Settings → Notifications → Webhooks');
    console.log('   ⚠️  Verify "orders/create" webhook is listed and enabled');
    
    // 5. Recommendations
    console.log('\n💡 DIAGNOSIS:');
    if (mlEvents.length === 0) {
      console.log('   ❌ Problem: No ml_recommendation_served events');
      console.log('   Solution: Check cart drawer extension tracking');
    } else if (attributions.length === 0) {
      console.log('   ❌ Problem: Tracking works but webhook doesn\'t create attributions');
      console.log('   Possible causes:');
      console.log('   1. Webhook not registered in Shopify');
      console.log('   2. Webhook failing silently');
      console.log('   3. Product IDs don\'t match (format issue)');
      console.log('\n   Next steps:');
      console.log('   1. Check Vercel function logs for webhook errors');
      console.log('   2. Manually trigger webhook test in Shopify admin');
      console.log('   3. Check if product IDs in orders match tracking events');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAttribution();
