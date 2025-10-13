/**
 * Enable Analytics Tracking
 * 
 * Quick script to enable analytics tracking in the database.
 * The enableAnalytics field exists in the schema but has no UI toggle yet.
 * 
 * Usage: DATABASE_URL="your-db-url" node scripts/enable-analytics.js
 */

import { PrismaClient } from '@prisma/client';

// Check for DATABASE_URL
if (!process.env.DATABASE_URL && !process.env.POSTGRES_PRISMA_URL) {
  console.error('❌ DATABASE_URL or POSTGRES_PRISMA_URL environment variable is required');
  console.error('');
  console.error('Run this script with:');
  console.error('  DATABASE_URL="your-neon-db-url" node scripts/enable-analytics.js');
  console.error('');
  console.error('Or get the URL from Vercel dashboard → Settings → Environment Variables');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL
    }
  }
});

async function enableAnalytics() {
  const shop = 'sectionappblocks.myshopify.com';
  
  console.log(`🔧 Enabling analytics for shop: ${shop}`);
  
  try {
    const settings = await prisma.settings.upsert({
      where: { shop },
      update: { 
        enableAnalytics: true 
      },
      create: {
        shop,
        enableAnalytics: true,
        enableApp: true,
      },
    });
    
    console.log('✅ Analytics enabled successfully!');
    console.log('📊 Settings:', {
      shop: settings.shop,
      enableAnalytics: settings.enableAnalytics,
      enableApp: settings.enableApp,
    });
    
  } catch (error) {
    console.error('❌ Error enabling analytics:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

enableAnalytics()
  .catch(console.error);
