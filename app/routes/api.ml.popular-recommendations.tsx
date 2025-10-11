import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { unauthenticated } from "~/shopify.server";
import prismaClient from "~/db.server";

const prisma: any = prismaClient as any;

export async function action({ request }: ActionFunctionArgs) {
  try {
    const data = await request.json();
    const { shop, exclude_ids, customer_preferences, privacy_level } = data;
    
    if (!shop) {
      return json({ error: 'Shop parameter required' }, { status: 400 });
    }
    
    const recommendations = await generatePopularRecommendations(
      shop,
      exclude_ids || [],
      customer_preferences,
      privacy_level || 'basic'
    );
    
    return json({ recommendations });
    
  } catch (error) {
    console.error('Popular recommendations error:', error);
    return json({ error: 'Failed to generate popular recommendations' }, { status: 500 });
  }
}

async function generatePopularRecommendations(
  shop: string,
  excludeIds: string[],
  customerPreferences: any,
  privacyLevel: string
) {
  try {
    const popularProducts = await getPopularProducts(shop, excludeIds);
    
    if (popularProducts.length === 0) {
      return await getFallbackPopularProducts(shop, excludeIds);
    }
    
    if (privacyLevel === 'basic') {
      return popularProducts.slice(0, 20).map(product => ({
        product_id: product.product_id,
        score: product.popularity_score,
        reason: 'Trending product',
        strategy: 'popularity_basic',
        popularity_metrics: {
          view_count: product.view_count,
          purchase_count: product.purchase_count,
          cart_count: product.cart_count,
          conversion_rate: product.conversion_rate
        }
      }));
    }
    
    const personalizedRecommendations = applyPersonalizationFilters(
      popularProducts,
      customerPreferences
    );
    
    return personalizedRecommendations.slice(0, 20);
  } catch (error) {
    console.error('Error generating popular recommendations:', error);
    return [];
  }
}

async function getPopularProducts(shop: string, excludeIds: string[]) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const trackingEvents = await prisma.trackingEvent.findMany({
      where: {
        shop: shop,
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        productId: true,
        eventType: true
      }
    });
    
    if (trackingEvents.length === 0) {
      return [];
    }
    
    const productMetrics = new Map<string, { views: number; carts: number; purchases: number }>();
    
    trackingEvents.forEach((event: any) => {
      if (!event.productId) return;
      
      const existing = productMetrics.get(event.productId) || { views: 0, carts: 0, purchases: 0 };
      
      if (event.eventType === 'view') existing.views++;
      if (event.eventType === 'add_to_cart') existing.carts++;
      if (event.eventType === 'purchase') existing.purchases++;
      
      productMetrics.set(event.productId, existing);
    });
    
    const popularProducts = Array.from(productMetrics.entries())
      .filter(([productId]) => !excludeIds.includes(productId))
      .map(([productId, metrics]) => {
        const conversionRate = metrics.views > 0 ? metrics.purchases / metrics.views : 0;
        const popularityScore = 
          (metrics.views * 0.3) +
          (metrics.carts * 0.5) +
          (metrics.purchases * 2.0) +
          (conversionRate * 100);
        
        return {
          product_id: productId,
          view_count: metrics.views,
          cart_count: metrics.carts,
          purchase_count: metrics.purchases,
          conversion_rate: conversionRate,
          popularity_score: popularityScore
        };
      })
      .sort((a, b) => b.popularity_score - a.popularity_score);
    
    return popularProducts;
  } catch (error) {
    console.error('Error fetching popular products:', error);
    return [];
  }
}

async function getFallbackPopularProducts(shop: string, excludeIds: string[]) {
  try {
    const { admin } = await unauthenticated.admin(shop);
    
    const productsResp = await admin.graphql(
      `#graphql
        query getPopularProducts($first: Int!) {
          products(first: $first, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `,
      { variables: { first: 30 } }
    );
    
    if (!productsResp.ok) {
      return [];
    }
    
    const data: any = await productsResp.json();
    const products = data?.data?.products?.edges || [];
    
    return products
      .filter((edge: any) => {
        const pid = edge.node.id.replace('gid://shopify/Product/', '');
        return !excludeIds.includes(pid);
      })
      .map((edge: any, index: number) => ({
        product_id: edge.node.id.replace('gid://shopify/Product/', ''),
        score: 1.0 - (index * 0.02),
        reason: 'Best selling product',
        strategy: 'popularity_fallback'
      }))
      .slice(0, 20);
  } catch (error) {
    console.error('Error fetching fallback products:', error);
    return [];
  }
}

function applyPersonalizationFilters(
  popularProducts: any[],
  customerPreferences: any
) {
  if (!customerPreferences?.sessionId) {
    return popularProducts.map(product => ({
      product_id: product.product_id,
      score: product.popularity_score,
      reason: 'Trending product',
      strategy: 'popularity_standard',
      popularity_metrics: {
        view_count: product.view_count,
        purchase_count: product.purchase_count,
        cart_count: product.cart_count,
        conversion_rate: product.conversion_rate
      }
    }));
  }
  
  return popularProducts.map(product => ({
    product_id: product.product_id,
    score: product.popularity_score,
    reason: 'Trending in your interests',
    strategy: 'popularity_personalized',
    popularity_metrics: {
      view_count: product.view_count,
      purchase_count: product.purchase_count,
      cart_count: product.cart_count,
      conversion_rate: product.conversion_rate
    }
  }));
}
