// Check what's in the attribution records
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAttribution() {
  try {
    const shop = 'sectionappblocks.myshopify.com';
    
    console.log('\n📊 Checking attribution records...\n');
    
    const attributions = await prisma.recommendationAttribution.findMany({
      where: { shop },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`Found ${attributions.length} attribution records:\n`);
    
    attributions.forEach((attr, i) => {
      console.log(`${i + 1}. Order ${attr.orderNumber}:`);
      console.log(`   Product ID: ${attr.productId}`);
      console.log(`   Attributed Revenue: £${attr.attributedRevenue?.toFixed(2) || '0.00'}`);
      console.log(`   Total Order Value: £${attr.orderValue?.toFixed(2) || '0.00'}`);
      console.log(`   Customer: ${attr.customerId}`);
      console.log(`   Created: ${attr.createdAt?.toISOString()}`);
      console.log('');
    });
    
    const totalAttributed = attributions.reduce((sum, a) => sum + (a.attributedRevenue || 0), 0);
    console.log(`💰 Total attributed revenue: £${totalAttributed.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAttribution();
