const { PrismaClient } = require('../node_modules/@prisma/client');

(async () => {
  const db = new PrismaClient();
  try {
    const shop = 'sectionappblocks.myshopify.com';
    const data = await db.settings.findUnique({ where: { shop } });
    console.log('DB Settings for', shop);
    console.log({
      discountLinkText: data?.discountLinkText,
      notesLinkText: data?.notesLinkText,
      enableRecommendationTitleCaps: data?.enableRecommendationTitleCaps,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
  } finally {
    await db.$disconnect();
  }
})();
