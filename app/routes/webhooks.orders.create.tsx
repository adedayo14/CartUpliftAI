import { type ActionFunctionArgs } from "@remix-run/node";
import db from "~/db.server";
import { authenticate } from "~/shopify.server";

/**
 * 🎯 PURCHASE ATTRIBUTION WEBHOOK
 * 
 * Purpose: Track which recommended products were actually purchased
 * Triggered: Every time a customer completes an order
 * 
 * Process:
 * 1. Receive order data from Shopify
 * 2. Extract purchased product IDs
 * 3. Look up recommendations shown in last 7 days for this customer
 * 4. Match purchases to recommendations
 * 5. Create attribution records (revenue tracking)
 * 6. Update MLUserProfile with purchase data
 */

export const action = async ({ request }: ActionFunctionArgs) => {
  const startTime = Date.now();
  try {
    console.log("🎯 Order webhook START:", new Date().toISOString());
    
    const { topic, shop, payload } = await authenticate.webhook(request);
    
    console.log("✅ Webhook authenticated:", { 
      topic, 
      shop, 
      orderId: payload.id,
      orderNumber: payload.order_number || payload.number,
      lineItemCount: payload.line_items?.length || 0
    });
    
    if (topic !== "ORDERS_CREATE") {
      console.error("❌ Invalid topic:", topic);
      return new Response("Invalid topic", { status: 400 });
    }
    
    // Process the order for ML learning
    await processOrderForAttribution(shop, payload);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Order webhook complete in ${duration}ms`);
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Order webhook error after ${duration}ms:`, error);
    return new Response("Error", { status: 500 });
  }
};

async function processOrderForAttribution(shop: string, order: any) {
  try {
    console.log("🔍 Processing attribution for order:", order.id);
    
    const customerId = order.customer?.id?.toString();
    const orderNumber = order.order_number || order.number;
    const orderValue = parseFloat(order.total_price || 0);
    
    console.log("📊 Order details:", { 
      customerId, 
      orderNumber, 
      orderValue,
      lineItemCount: order.line_items?.length 
    });
    
    // Extract purchased product IDs
    const purchasedProductIds = order.line_items?.map((item: any) => {
      const productId = item.product_id?.toString();
      return productId;
    }).filter(Boolean) || [];
    
    console.log("🛍️ Purchased products:", purchasedProductIds);
    
    if (purchasedProductIds.length === 0) {
      console.log("⚠️ No products in order, skipping attribution");
      return;
    }
    
    console.log(`🔍 Checking attribution for ${purchasedProductIds.length} products`);
    
    // Look up recommendations shown in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    console.log("📅 Looking for recommendations since:", sevenDaysAgo.toISOString());
    
    // Find recent tracking events for this shop (not filtering by customer since tracking may not have customer ID)
    const recentEvents = await (db as any).trackingEvent?.findMany({
      where: {
        shop,
        event: 'ml_recommendation_served',
        createdAt: { gte: sevenDaysAgo }
        // Intentionally NOT filtering by customerId - tracking events may not have it
        // We'll match based on product IDs instead
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    console.log(`📦 Found ${recentEvents?.length || 0} recommendation events`);
    
    if (!recentEvents || recentEvents.length === 0) {
      console.log("ℹ️ No recent recommendations found for attribution");
      return;
    }
    
    // Parse metadata to find recommended products
    let attributedProducts: string[] = [];
    let recommendationIds: string[] = [];
    
    for (const event of recentEvents) {
      try {
        const metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        
        const recommendedIds = metadata?.recommendationIds || [];
        
        console.log(`📝 Event ${event.id}:`);
        console.log(`   - Recommended IDs (${recommendedIds.length}): ${recommendedIds.slice(0, 3).join(', ')}...`);
        console.log(`   - Purchased IDs: ${purchasedProductIds.join(', ')}`);
        console.log(`   - ID types: recommended[0]=${typeof recommendedIds[0]}, purchased[0]=${typeof purchasedProductIds[0]}`);
        
        // Check if any purchased products were in recommendations
        const matches = purchasedProductIds.filter((pid: string) => 
          recommendedIds.includes(pid) || recommendedIds.includes(Number(pid)) || recommendedIds.includes(String(pid))
        );
        
        if (matches.length > 0) {
          console.log(`✅ MATCH! Products ${matches.join(', ')} were recommended`);
          attributedProducts.push(...matches);
          recommendationIds.push(event.id);
        } else {
          console.log(`   No matches for this event`);
        }
      } catch (e) {
        console.warn("Failed to parse event metadata:", e);
      }
    }
    
    // Remove duplicates
    attributedProducts = [...new Set(attributedProducts)];
    
    console.log(`🎯 Attribution summary:`, {
      totalAttributed: attributedProducts.length,
      attributedProducts,
      recommendationEventIds: recommendationIds
    });
    
    if (attributedProducts.length === 0) {
      console.log("ℹ️ No attributed products (customer bought different items)");
      
      // Still valuable: track what they bought INSTEAD
      await trackMissedOpportunity(shop, purchasedProductIds, recentEvents[0]);
      return;
    }
    
    console.log(`✅ Attribution found! ${attributedProducts.length} products matched recommendations`);
    
    // Create attribution records
    const attributionPromises = attributedProducts.map(productId => 
      (db as any).recommendationAttribution?.create({
        data: {
          shop,
          productId,
          orderId: order.id?.toString(),
          orderNumber,
          orderValue,
          customerId,
          recommendationEventIds: recommendationIds,
          attributedRevenue: calculateProductRevenue(order, productId),
          conversionTimeMinutes: calculateConversionTime(recentEvents[0]),
          createdAt: new Date()
        }
      }).catch((e: any) => console.warn("Failed to create attribution:", e))
    );
    
    await Promise.all(attributionPromises);
    
    // Update user profile with purchase data
    if (customerId) {
      await updateUserProfilePurchase(shop, customerId, purchasedProductIds);
    }
    
    console.log(`💰 Attribution complete: ${attributedProducts.length} products, $${orderValue}`);
    
  } catch (error) {
    console.error("❌ Attribution processing error:", error);
  }
}

async function trackMissedOpportunity(shop: string, purchasedIds: string[], lastRecommendationEvent: any) {
  // Track what they bought that we DIDN'T recommend
  // This is gold for learning!
  try {
    const metadata = typeof lastRecommendationEvent.metadata === 'string'
      ? JSON.parse(lastRecommendationEvent.metadata)
      : lastRecommendationEvent.metadata;
    
    const anchors = metadata?.anchors || [];
    
    // For each purchased product, create a "missed opportunity" signal
    for (const productId of purchasedIds) {
      await (db as any).mLProductSimilarity?.upsert({
        where: {
          shop_productId1_productId2: {
            shop,
            productId1: anchors[0] || 'unknown',
            productId2: productId
          }
        },
        create: {
          shop,
          productId1: anchors[0] || 'unknown',
          productId2: productId,
          overallScore: 0.5,
          cooccurrenceCount: 1,
          updatedAt: new Date()
        },
        update: {
          cooccurrenceCount: { increment: 1 },
          overallScore: { increment: 0.05 }, // Gradually learn this is a good pairing
          updatedAt: new Date()
        }
      }).catch((e: any) => console.warn("Failed to update similarity:", e));
    }
  } catch (e) {
    console.warn("Failed to track missed opportunity:", e);
  }
}

function calculateProductRevenue(order: any, productId: string): number {
  const lineItem = order.line_items?.find((item: any) => 
    item.product_id?.toString() === productId
  );
  
  if (!lineItem) return 0;
  
  return parseFloat(lineItem.price || 0) * (lineItem.quantity || 1);
}

function calculateConversionTime(recommendationEvent: any): number {
  if (!recommendationEvent?.createdAt) return 0;
  
  const recommendedAt = new Date(recommendationEvent.createdAt);
  const now = new Date();
  const diffMs = now.getTime() - recommendedAt.getTime();
  
  return Math.floor(diffMs / 60000); // Convert to minutes
}

async function updateUserProfilePurchase(shop: string, customerId: string, productIds: string[]) {
  try {
    // Find or create user profile
    const profiles = await (db as any).mLUserProfile?.findMany({
      where: { shop, customerId }
    });
    
    if (profiles && profiles.length > 0) {
      // Update existing profile(s)
      for (const profile of profiles) {
        const existingPurchased = Array.isArray(profile.purchasedProducts) 
          ? profile.purchasedProducts 
          : [];
        
        const newPurchased = [...new Set([...existingPurchased, ...productIds])];
        
        await (db as any).mLUserProfile?.update({
          where: { id: profile.id },
          data: {
            purchasedProducts: newPurchased,
            lastActivity: new Date(),
            updatedAt: new Date()
          }
        });
      }
    }
  } catch (e) {
    console.warn("Failed to update user profile:", e);
  }
}
