const { PrismaClient } = require('../node_modules/@prisma/client');

(async () => {
  const db = new PrismaClient();
  const shop = 'sectionappblocks.myshopify.com';
  try {
    await db.settings.update({
      where: { shop },
      data: {
        discountLinkText: '+ Hello from script',
        notesLinkText: '+ Notes script',
      },
    });
    const data = await db.settings.findUnique({ where: { shop } });
    console.log('Updated settings:', {
      discountLinkText: data?.discountLinkText,
      notesLinkText: data?.notesLinkText,
    });
  } catch (error) {
    console.error('Update failed:', error);
  } finally {
    await db.$disconnect();
  }
})();
