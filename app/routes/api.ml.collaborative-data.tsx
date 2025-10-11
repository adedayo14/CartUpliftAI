import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prismaClient from "~/db.server";

const prisma: any = prismaClient as any;

export async function action({ request }: ActionFunctionArgs) {
  try {
    const data = await request.json();
    const { shop, privacy_level, include_user_similarities, session_id } = data;
    
    if (!shop) {
      return json({ error: 'Shop parameter required' }, { status: 400 });
    }
    
    if (privacy_level === 'basic') {
      return json({
        item_similarities: await getAggregatedItemSimilarities(shop),
        global_stats: await getGlobalStats(shop),
        user_item_interactions: [],
        user_similarities: []
      });
    }
    
    const response = {
      item_similarities: await getItemSimilarities(shop),
      global_stats: await getGlobalStats(shop),
      user_item_interactions: privacy_level === 'advanced' ? 
        await getUserItemInteractions(shop, session_id) : [],
      user_similarities: include_user_similarities && privacy_level === 'advanced' ? 
        await getUserSimilarities(shop, session_id) : []
    };
    
    return json(response);
    
  } catch (error) {
    console.error('Collaborative filtering data error:', error);
    return json({ error: 'Failed to load collaborative data' }, { status: 500 });
  }
}

async function getAggregatedItemSimilarities(shop: string) {
  try {
    const similarities = await prisma.mLProductSimilarity.findMany({
      where: { shop },
      orderBy: { overallScore: 'desc' },
      take: 100,
      select: {
        productId1: true,
        productId2: true,
        overallScore: true
      }
    });
    
    return similarities.map((sim: any) => ({
      item1_id: sim.productId1,
      item2_id: sim.productId2,
      similarity: sim.overallScore
    }));
  } catch (error) {
    console.error('Error fetching aggregated similarities:', error);
    return [];
  }
}

async function getItemSimilarities(shop: string) {
  try {
    const similarities = await prisma.mLProductSimilarity.findMany({
      where: { shop },
      orderBy: { overallScore: 'desc' },
      take: 200
    });
    
    return similarities.map((sim: any) => ({
      item1_id: sim.productId1,
      item2_id: sim.productId2,
      similarity: sim.overallScore,
      category_score: sim.categoryScore || 0,
      price_score: sim.priceScore || 0,
      support: sim.cooccurrenceCount || 0
    }));
  } catch (error) {
    console.error('Error fetching item similarities:', error);
    return [];
  }
}

async function getGlobalStats(shop: string) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const trackingEvents = await prisma.trackingEvent.findMany({
      where: {
        shop,
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        eventType: true
      }
    });
    
    const totalInteractions = trackingEvents.length;
    const viewCount = trackingEvents.filter((e: any) => e.eventType === 'view').length;
    const cartCount = trackingEvents.filter((e: any) => e.eventType === 'add_to_cart').length;
    const purchaseCount = trackingEvents.filter((e: any) => e.eventType === 'purchase').length;
    
    const conversionRate = viewCount > 0 ? purchaseCount / viewCount : 0;
    const cartRate = viewCount > 0 ? cartCount / viewCount : 0;
    
    return {
      total_interactions: totalInteractions,
      view_count: viewCount,
      cart_count: cartCount,
      purchase_count: purchaseCount,
      conversion_rate: conversionRate,
      cart_rate: cartRate,
      data_quality: totalInteractions > 1000 ? 'good' : totalInteractions > 100 ? 'moderate' : 'limited'
    };
  } catch (error) {
    console.error('Error fetching global stats:', error);
    return {
      total_interactions: 0,
      view_count: 0,
      cart_count: 0,
      purchase_count: 0,
      conversion_rate: 0,
      cart_rate: 0,
      data_quality: 'limited'
    };
  }
}

async function getUserItemInteractions(shop: string, sessionId?: string) {
  try {
    if (!sessionId) {
      return [];
    }
    
    const profile = await prisma.mLUserProfile.findUnique({
      where: {
        shop_sessionId: {
          shop,
          sessionId
        }
      }
    });
    
    if (!profile) {
      return [];
    }
    
    const interactions = [];
    
    if (profile.viewedProducts) {
      profile.viewedProducts.forEach((productId: string) => {
        interactions.push({
          product_id: productId,
          interaction_type: 'view',
          weight: 1.0
        });
      });
    }
    
    if (profile.cartedProducts) {
      profile.cartedProducts.forEach((productId: string) => {
        interactions.push({
          product_id: productId,
          interaction_type: 'cart',
          weight: 2.0
        });
      });
    }
    
    if (profile.purchasedProducts) {
      profile.purchasedProducts.forEach((productId: string) => {
        interactions.push({
          product_id: productId,
          interaction_type: 'purchase',
          weight: 3.0
        });
      });
    }
    
    return interactions;
  } catch (error) {
    console.error('Error fetching user interactions:', error);
    return [];
  }
}

async function getUserSimilarities(shop: string, sessionId?: string) {
  try {
    if (!sessionId) {
      return [];
    }
    
    const currentProfile = await prisma.mLUserProfile.findUnique({
      where: {
        shop_sessionId: {
          shop,
          sessionId
        }
      }
    });
    
    if (!currentProfile) {
      return [];
    }
    
    const allProfiles = await prisma.mLUserProfile.findMany({
      where: {
        shop,
        sessionId: { not: sessionId }
      },
      take: 50
    });
    
    const currentProducts = new Set([
      ...(currentProfile.viewedProducts || []),
      ...(currentProfile.cartedProducts || []),
      ...(currentProfile.purchasedProducts || [])
    ]);
    
    const similarities = allProfiles
      .map((profile: any) => {
        const otherProducts = new Set([
          ...(profile.viewedProducts || []),
          ...(profile.cartedProducts || []),
          ...(profile.purchasedProducts || [])
        ]);
        
        const intersection = new Set(
          [...currentProducts].filter(p => otherProducts.has(p))
        );
        
        const union = new Set([...currentProducts, ...otherProducts]);
        
        const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;
        
        return {
          user_id: profile.sessionId,
          similarity: jaccardSimilarity,
          common_products: intersection.size
        };
      })
      .filter(s => s.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
    
    return similarities;
  } catch (error) {
    console.error('Error fetching user similarities:', error);
    return [];
  }
}
