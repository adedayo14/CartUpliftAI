/**
 * Product-Specific Bundle API
 * Returns bundles assigned to a specific product (manual) or AI-generated bundles
 * 
 * GET /api/bundles?product_id=123&context=product
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getBundleInsights } from "../models/bundleInsights.server";

interface BundleProduct {
  id: string;
  title: string;
  handle: string;
  price: number;
  comparePrice?: number;
  image?: string;
  variantId?: string;
  isAnchor?: boolean;
  isRemovable?: boolean;
}

interface BundleResponse {
  id: string;
  name: string;
  description?: string;
  type: string;
  bundleStyle: string;
  discountType: string;
  discountValue: number;
  products: BundleProduct[];
  bundle_price?: number;
  regular_total?: number;
  discount_percent?: number;
  tierConfig?: Array<{ qty: number; discount: number }>;
  selectMinQty?: number;
  selectMaxQty?: number;
  allowDeselect?: boolean;
  mainProductId?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get('product_id');
  const context = url.searchParams.get('context') || 'product';
  
  console.log('[Bundles API] Request:', { productId, context });
  
  if (!productId) {
    return json({ 
      success: false, 
      error: 'Missing product_id parameter',
      bundles: [] 
    }, { status: 400 });
  }

  try {
    const { session, admin } = await authenticate.admin(request);
    const shop = session.shop;

    // Get settings to check if bundles are enabled
    const settings = await prisma.settings.findUnique({
      where: { shop }
    });

    if (!settings?.enableSmartBundles) {
      console.log('[Bundles API] Smart bundles disabled for shop');
      return json({ 
        success: true, 
        bundles: [],
        message: 'Smart bundles not enabled'
      });
    }

    // Step 1: Check for manual bundles assigned to this product
    const manualBundles = await prisma.bundle.findMany({
      where: {
        shop,
        status: 'active',
        OR: [
          // Check if product is in assignedProducts JSON array
          { assignedProducts: { contains: productId } },
          // Also check if product is in the bundle's products
          { productIds: { contains: productId } }
        ]
      },
      include: {
        bundles: {
          orderBy: { position: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('[Bundles API] Found manual bundles:', manualBundles.length);

    if (manualBundles.length > 0) {
      // Format manual bundles
      const formattedBundles = await Promise.all(
        manualBundles.map(async (bundle) => {
          // Fetch product details from Shopify
          const productDetails = await fetchProductDetails(
            admin,
            bundle.bundles.map(bp => bp.productId)
          );

          const products: BundleProduct[] = bundle.bundles.map(bp => {
            const details = productDetails[bp.productId] || {};
            return {
              id: bp.productId,
              title: bp.productTitle || details.title || 'Unknown Product',
              handle: bp.productHandle || details.handle || '',
              price: bp.productPrice || details.price || 0,
              comparePrice: details.comparePrice,
              image: details.image,
              variantId: bp.variantId || details.variantId,
              isAnchor: bp.isAnchor || bp.productId === productId,
              isRemovable: bp.isRemovable
            };
          });

          // Calculate totals
          const regularTotal = products.reduce((sum, p) => sum + (p.comparePrice || p.price), 0);
          const bundlePrice = bundle.discountType === 'percentage'
            ? regularTotal * (1 - bundle.discountValue / 100)
            : regularTotal - bundle.discountValue;

          const discountPercent = regularTotal > 0
            ? Math.round(((regularTotal - bundlePrice) / regularTotal) * 100)
            : 0;

          // Parse tier config if exists
          let tierConfig;
          try {
            tierConfig = bundle.tierConfig ? JSON.parse(bundle.tierConfig) : undefined;
          } catch (e) {
            console.warn('[Bundles API] Failed to parse tierConfig:', e);
          }

          return {
            id: bundle.id,
            name: bundle.displayTitle || bundle.name,
            description: bundle.description,
            type: bundle.type,
            bundleStyle: bundle.bundleStyle,
            discountType: bundle.discountType,
            discountValue: bundle.discountValue,
            products,
            bundle_price: bundlePrice,
            regular_total: regularTotal,
            discount_percent: discountPercent,
            tierConfig,
            selectMinQty: bundle.selectMinQty,
            selectMaxQty: bundle.selectMaxQty,
            allowDeselect: bundle.allowDeselect,
            mainProductId: bundle.mainProductId
          } as BundleResponse;
        })
      );

      return json({
        success: true,
        bundles: formattedBundles,
        source: 'manual',
        settings: {
          defaultDiscount: settings.defaultBundleDiscount,
          autoApply: settings.autoApplyBundleDiscounts
        }
      });
    }

    // Step 2: No manual bundles, try AI-generated bundles
    console.log('[Bundles API] No manual bundles, checking AI bundles...');
    
    const mlBundles = await getBundleInsights({
      shop,
      admin,
      orderLimit: 40,
      minPairOrders: 2
    });

    console.log('[Bundles API] AI bundles found:', mlBundles.bundles.length);

    if (mlBundles.bundles.length > 0) {
      // Find bundles that include the current product
      const relevantBundles = mlBundles.bundles.filter(b => 
        b.productIds.includes(productId)
      );

      console.log('[Bundles API] Relevant AI bundles:', relevantBundles.length);

      // Format AI bundles
      const formattedAIBundles = await Promise.all(
        relevantBundles.slice(0, 3).map(async (bundle) => {
          // Fetch product details
          const productDetails = await fetchProductDetails(admin, bundle.productIds);

          const products: BundleProduct[] = bundle.productIds.map((pid, idx) => {
            const details = productDetails[pid] || {};
            return {
              id: pid,
              title: bundle.productTitles[idx] || details.title || 'Unknown Product',
              handle: details.handle || '',
              price: details.price || 0,
              comparePrice: details.comparePrice,
              image: details.image,
              variantId: details.variantId,
              isAnchor: pid === productId,
              isRemovable: pid !== productId
            };
          });

          return {
            id: `ai-${bundle.id}`,
            name: `${bundle.name} (AI Recommended)`,
            description: `Customers who bought these items together saved ${bundle.averageDiscountPercent}% on average`,
            type: 'ai_suggested',
            bundleStyle: 'grid', // Default to grid for AI bundles
            discountType: 'percentage',
            discountValue: bundle.averageDiscountPercent,
            products,
            bundle_price: bundle.revenue / bundle.orderCount,
            regular_total: bundle.regularRevenue / bundle.orderCount,
            discount_percent: bundle.averageDiscountPercent,
            allowDeselect: true
          } as BundleResponse;
        })
      );

      return json({
        success: true,
        bundles: formattedAIBundles,
        source: 'ai',
        confidence: mlBundles.bundles[0]?.status === 'active' ? 'high' : 'medium',
        settings: {
          defaultDiscount: settings.defaultBundleDiscount,
          autoApply: settings.autoApplyBundleDiscounts
        }
      });
    }

    // Step 3: No bundles found
    console.log('[Bundles API] No bundles found for product:', productId);
    return json({
      success: true,
      bundles: [],
      source: 'none',
      message: 'No bundles available for this product'
    });

  } catch (error) {
    console.error('[Bundles API] Error:', error);
    return json({
      success: false,
      error: 'Failed to fetch bundles',
      bundles: []
    }, { status: 500 });
  }
};

/**
 * Fetch product details from Shopify GraphQL
 */
async function fetchProductDetails(
  admin: any,
  productIds: string[]
): Promise<Record<string, any>> {
  if (!productIds || productIds.length === 0) return {};

  try {
    // Build GraphQL query for multiple products
    const queries = productIds.map((id, idx) => {
      const gid = id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;
      return `
        product${idx}: product(id: "${gid}") {
          id
          title
          handle
          priceRangeV2 {
            minVariantPrice {
              amount
            }
          }
          compareAtPriceRange {
            minVariantPrice {
              amount
            }
          }
          featuredImage {
            url(transform: {maxWidth: 400})
          }
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      `;
    }).join('\n');

    const response = await admin.graphql(`
      #graphql
      query getProductDetails {
        ${queries}
      }
    `);

    const data = await response.json();
    
    if (data.errors) {
      console.error('[Bundles API] GraphQL errors:', data.errors);
      return {};
    }

    // Parse response into map
    const productMap: Record<string, any> = {};
    
    productIds.forEach((id, idx) => {
      const product = data.data[`product${idx}`];
      if (product) {
        const cleanId = id.replace('gid://shopify/Product/', '');
        const price = parseFloat(product.priceRangeV2?.minVariantPrice?.amount || '0');
        const comparePrice = parseFloat(product.compareAtPriceRange?.minVariantPrice?.amount || '0');
        
        productMap[cleanId] = {
          title: product.title,
          handle: product.handle,
          price: price * 100, // Convert to cents
          comparePrice: comparePrice > 0 ? comparePrice * 100 : undefined,
          image: product.featuredImage?.url,
          variantId: product.variants?.edges[0]?.node?.id
        };
      }
    });

    return productMap;
  } catch (error) {
    console.error('[Bundles API] Failed to fetch product details:', error);
    return {};
  }
}
