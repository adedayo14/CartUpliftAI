/**
 * Clear Attribution Data Script
 * Run this locally: node clear-data.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SHOP = 'sectionappblocks.myshopify.com';

async function clearData() {
  try {
    console.log(`🗑️  Clearing data for shop: ${SHOP}`);
    console.log('');

    // Count before deletion
    const attributionCount = await prisma.recommendationAttribution.count({
      where: { shop: SHOP }
    });
    
    const trackingCount = await prisma.trackingEvent.count({
      where: { shop: SHOP }
    });
    
    const analyticsCount = await prisma.analyticsEvent.count({
      where: { shop: SHOP }
    });

    console.log('📊 Current counts:');
    console.log(`   • RecommendationAttribution: ${attributionCount}`);
    console.log(`   • TrackingEvent: ${trackingCount}`);
    console.log(`   • AnalyticsEvent: ${analyticsCount}`);
    console.log('');

    if (attributionCount === 0 && trackingCount === 0 && analyticsCount === 0) {
      console.log('✅ Already clean! No data to delete.');
      return;
    }

    // Delete all data
    console.log('🔥 Deleting data...');
    
    await Promise.all([
      prisma.recommendationAttribution.deleteMany({
        where: { shop: SHOP }
      }),
      prisma.trackingEvent.deleteMany({
        where: { shop: SHOP }
      }),
      prisma.analyticsEvent.deleteMany({
        where: { shop: SHOP }
      })
    ]);

    console.log('');
    console.log('✅ Success! Deleted:');
    console.log(`   • ${attributionCount} attribution records`);
    console.log(`   • ${trackingCount} tracking events`);
    console.log(`   • ${analyticsCount} analytics events`);
    console.log('');
    console.log('💰 Dashboard metrics will now show £0.00');
    console.log('🎯 Place a new order to start fresh!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
