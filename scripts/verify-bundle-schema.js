// Quick verification script to check new Bundle schema fields
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verifySchema() {
  console.log('🔍 Verifying Bundle Schema...\n');
  
  try {
    // Check if we can query with new fields
    const testQuery = await prisma.bundle.findFirst({
      select: {
        id: true,
        name: true,
        // NEW FIELDS - If these work, migration succeeded
        assignedProducts: true,
        bundleStyle: true,
        selectMinQty: true,
        selectMaxQty: true,
        tierConfig: true,
        allowDeselect: true,
        mainProductId: true,
        hideIfNoML: true,
      },
      take: 1
    });
    
    console.log('✅ ALL NEW FIELDS VERIFIED!\n');
    console.log('Schema includes:');
    console.log('  ✓ assignedProducts');
    console.log('  ✓ bundleStyle');
    console.log('  ✓ selectMinQty');
    console.log('  ✓ selectMaxQty');
    console.log('  ✓ tierConfig');
    console.log('  ✓ allowDeselect');
    console.log('  ✓ mainProductId');
    console.log('  ✓ hideIfNoML\n');
    
    if (testQuery) {
      console.log('Sample bundle found:', testQuery.name);
      console.log('Bundle style:', testQuery.bundleStyle || 'grid (default)');
    } else {
      console.log('No bundles in database yet (this is normal)');
    }
    
    // Check BundleProduct fields
    const testBundleProduct = await prisma.bundleProduct.findFirst({
      select: {
        id: true,
        isRemovable: true,
        isAnchor: true,
        tierPricing: true,
      },
      take: 1
    });
    
    console.log('\n✅ BundleProduct fields verified!');
    console.log('  ✓ isRemovable');
    console.log('  ✓ isAnchor');
    console.log('  ✓ tierPricing\n');
    
    console.log('🎉 MIGRATION SUCCESSFUL!\n');
    console.log('Next steps:');
    console.log('1. Go to: https://cartuplift.vercel.app/admin/bundle-management-simple');
    console.log('2. Create a test bundle with new features');
    console.log('3. Test on storefront\n');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.log('\nIf you see "Unknown field" errors, run:');
    console.log('  npx prisma generate\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema();
