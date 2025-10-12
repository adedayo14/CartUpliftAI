import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTracking() {
  console.log('\n🔍 CHECKING TRACKING DATA FOR DASHBOARD...\n');
  
  try {
    // Check TrackingEvent for impressions/clicks
    const impressions = await prisma.trackingEvent.count({
      where: { event: 'impression' }
    });
    
    const clicks = await prisma.trackingEvent.count({
      where: { event: 'click' }
    });
    
    console.log('📊 TRACKING EVENTS:');
    console.log(`   Impressions: ${impressions}`);
    console.log(`   Clicks: ${clicks}`);
    
    if (impressions === 0) {
      console.log('   ⚠️  NO IMPRESSIONS - Cart drawer recommendations not showing or tracking not firing\n');
    }
    
    if (clicks === 0 && impressions > 0) {
      console.log('   ⚠️  NO CLICKS - Recommendations showing but not being clicked\n');
    }
    
    // Check RecommendationAttribution for orders
    const attributions = await prisma.recommendationAttribution.count();
    const attributedOrders = await prisma.recommendationAttribution.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        orderId: true,
        attributedRevenue: true,
        createdAt: true
      }
    });
    
    console.log('\n💰 ATTRIBUTION DATA:');
    console.log(`   Total attributions: ${attributions}`);
    
    if (attributions === 0) {
      console.log('   ⚠️  NO ATTRIBUTIONS - Orders not being tracked or webhook not processing\n');
    } else {
      console.log('   Recent attributions:');
      attributedOrders.forEach(attr => {
        console.log(`      Order: ${attr.orderId}, Revenue: £${(attr.attributedRevenue / 100).toFixed(2)}, Date: ${attr.createdAt}`);
      });
    }
    
    // Calculate setup progress
    const hasRecommendations = impressions > 0;
    const hasClicks = clicks > 0;
    const hasAttributions = attributions > 0;
    
    const setupProgress = !hasRecommendations ? 0 :
                          !hasClicks ? 33 :
                          !hasAttributions ? 66 : 100;
    
    console.log('\n🚀 SETUP PROGRESS:');
    console.log(`   Progress: ${setupProgress}%`);
    console.log(`   ${hasRecommendations ? '✅' : '❌'} Recommendations showing (impressions > 0)`);
    console.log(`   ${hasClicks ? '✅' : '❌'} Customers clicking (clicks > 0)`);
    console.log(`   ${hasAttributions ? '✅' : '❌'} Sales tracked (attributions > 0)`);
    
    if (setupProgress < 100) {
      console.log('\n📋 NEXT STEPS:');
      if (!hasRecommendations) {
        console.log('   1. Check if cart drawer extension is enabled in your theme');
        console.log('   2. Verify recommendations are loading in the cart');
        console.log('   3. Check browser console for tracking errors');
      } else if (!hasClicks) {
        console.log('   1. Click on a recommended product in the cart drawer');
        console.log('   2. Verify click tracking is firing (check /api/track endpoint)');
      } else if (!hasAttributions) {
        console.log('   1. Complete an order with a clicked recommendation');
        console.log('   2. Check order webhook is processing (/webhooks/orders/create)');
        console.log('   3. Verify RecommendationAttribution records are created');
      }
    } else {
      console.log('\n✅ DASHBOARD SHOULD BE VISIBLE NOW!');
    }
    
  } catch (error) {
    console.error('❌ Error checking tracking:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTracking();
