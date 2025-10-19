import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Get all bundles with their assigned products
  const bundles = await prisma.bundle.findMany({
    where: { shop: session.shop },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      bundleStyle: true,
      assignedProducts: true,
      productIds: true,
      discountType: true,
      discountValue: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  return json({
    success: true,
    shop: session.shop,
    bundles: bundles.map(b => ({
      ...b,
      assignedProducts_parsed: b.assignedProducts ? JSON.parse(b.assignedProducts) : null,
      productIds_parsed: b.productIds ? JSON.parse(b.productIds) : null,
    }))
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
