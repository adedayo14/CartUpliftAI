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

    if (error instanceof Response) {
      console.error(`❌ Order webhook error after ${duration}ms:`, {
        status: error.status,
        statusText: error.statusText,
      });

      if (error.status === 401) {
        console.error("🚫 Webhook unauthorized details:", {
          shopHeader: request.headers.get("X-Shopify-Shop-Domain"),
          topicHeader: request.headers.get("X-Shopify-Topic"),
          hmacPresent: request.headers.has("X-Shopify-Hmac-Sha256"),
          apiSecretConfigured: Boolean(process.env.SHOPIFY_API_SECRET),
        });
      }

      return error;
    }

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
    
    // Find recent tracking events for this shop - get BOTH served AND clicked events
    const recentEvents = await (db as any).trackingEvent?.findMany({
      where: {
        shop,
        event: { in: ['ml_recommendation_served', 'click'] },
        createdAt: { gte: sevenDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 500 // Increased to get both impression and click events
    });
    
    console.log(`📦 Found ${recentEvents?.length || 0} tracking events (served + clicks)`);
    
    if (!recentEvents || recentEvents.length === 0) {
      console.log("ℹ️ No recent recommendations found for attribution");
      return;
    }
    
    // Separate served and clicked events
    const servedEvents = recentEvents.filter((e: any) => e.event === 'ml_recommendation_served');
    const clickEvents = recentEvents.filter((e: any) => e.event === 'click');
    
    console.log(`📊 Event breakdown: ${servedEvents.length} served, ${clickEvents.length} clicks`);
    
    // Build a set of clicked product IDs
    const clickedProductIds = new Set(
      clickEvents
        .map((e: any) => e.productId)
        .filter(Boolean)
        .map(String) // Normalize to strings
    );
    
    console.log(`👆 Clicked products: ${Array.from(clickedProductIds).slice(0, 5).join(', ')}${clickedProductIds.size > 5 ? '...' : ''}`);
    
    // Parse metadata to find recommended products that were ALSO clicked
    let attributedProducts: string[] = [];
    let recommendationIds: string[] = [];
    
    for (const event of servedEvents) {
      try {
        const metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        
        const recommendedIds = metadata?.recommendationIds || [];
        
        console.log(`📝 Served Event ${event.id}:`);
        console.log(`   - Recommended IDs (${recommendedIds.length}): ${recommendedIds.slice(0, 3).join(', ')}...`);
        
        // Check if any purchased products were:
        // 1. In recommendations AND
        // 2. Were clicked by customer AND
        // 3. Were purchased
        const matches = purchasedProductIds.filter((pid: string) => {
          const wasRecommended = recommendedIds.includes(pid) || recommendedIds.includes(Number(pid)) || recommendedIds.includes(String(pid));
          const wasClicked = clickedProductIds.has(String(pid));
          return wasRecommended && wasClicked;
        });
        
        if (matches.length > 0) {
          console.log(`✅ ATTRIBUTED! Products ${matches.join(', ')} were recommended, clicked, AND purchased`);
          attributedProducts.push(...matches);
          recommendationIds.push(event.id);
        } else {
          // Debug: Show what was missing
          const recommended = purchasedProductIds.filter((pid: string) => 
            recommendedIds.includes(pid) || recommendedIds.includes(Number(pid)) || recommendedIds.includes(String(pid))
          );
          if (recommended.length > 0) {
            console.log(`   ⚠️ Products ${recommended.join(', ')} were recommended but NOT clicked`);
          }
        }
      } catch (e) {
        console.warn("Failed to parse event metadata:", e);
      }
    }
    
    // Remove duplicates
    attributedProducts = [...new Set(attributedProducts)];
    
    console.log(`🎯 Attribution summary:`, {
      totalPurchased: purchasedProductIds.length,
      totalRecommended: servedEvents.length,
      totalClicked: clickedProductIds.size,
      totalAttributed: attributedProducts.length,
      attributedProducts,
      recommendationEventIds: recommendationIds
    });
    
    if (attributedProducts.length === 0) {
      console.log("ℹ️ No attributed products (recommendations were not clicked or different items purchased)");
      
      // Still valuable: track what they bought INSTEAD
      await trackMissedOpportunity(shop, purchasedProductIds, servedEvents[0]);
      return;
    }
    
    console.log(`✅ Attribution found! ${attributedProducts.length} products: recommended → clicked → purchased`);
    
    // Calculate total attributed revenue for this order
    const totalAttributedRevenue = attributedProducts.reduce((sum, productId) => 
      sum + calculateProductRevenue(order, productId), 0
    );
    
    // Calculate uplift percentage
    const baseOrderValue = orderValue - totalAttributedRevenue;
    const upliftPercentage = baseOrderValue > 0 ? ((totalAttributedRevenue / baseOrderValue) * 100) : 0;
    
    console.log(`💰 Order breakdown:`, {
      totalOrderValue: orderValue,
      baseValue: baseOrderValue,
      attributedRevenue: totalAttributedRevenue,
      upliftPercentage: `${upliftPercentage.toFixed(1)}%`,
      message: `Customer would've spent £${baseOrderValue.toFixed(2)}, our recommendations added £${totalAttributedRevenue.toFixed(2)} (${upliftPercentage.toFixed(1)}% increase)`
    });
    
    // Create attribution records
    const attributionPromises = attributedProducts.map(productId => {
      const productRevenue = calculateProductRevenue(order, productId);
      
      return (db as any).recommendationAttribution?.create({
        data: {
          shop,
          productId,
          orderId: order.id?.toString(),
          orderNumber,
          orderValue, // Total order value
          customerId,
          recommendationEventIds: recommendationIds,
          attributedRevenue: productRevenue, // Revenue from this specific product
          conversionTimeMinutes: calculateConversionTime(recentEvents[0]),
          createdAt: new Date()
        }
      }).catch((e: any) => console.warn("Failed to create attribution:", e));
    });
    
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
          coPurchaseScore: 1.0, // Start at 1.0 for first co-purchase
          sampleSize: 1,
          computedAt: new Date()
        },
        update: {
          coPurchaseScore: { increment: 0.1 }, // Increase by 0.1 each time they're bought together
          overallScore: { increment: 0.05 }, // Gradually learn this is a good pairing
          sampleSize: { increment: 1 },
          computedAt: new Date()
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
