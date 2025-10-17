const { PrismaClient } = require('../node_modules/@prisma/client');

(async () => {
  const db = new PrismaClient();
  try {
    const shop = 'sectionappblocks.myshopify.com';
    const data = await db.settings.findUnique({ where: { shop } });
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await db.$disconnect();
  }
})();
