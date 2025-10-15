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
    
    // Extract purchased product IDs AND variant IDs (for matching with tracking)
    // Build comprehensive maps for attribution matching
    const purchasedProductIds: string[] = [];
    const purchasedVariantIds: string[] = [];
    const variantToProductMap = new Map<string, string>();
    const productToVariantsMap = new Map<string, string[]>();
    
    order.line_items?.forEach((item: any) => {
      const productId = item.product_id?.toString();
      const variantId = item.variant_id?.toString();
      
      if (productId) {
        purchasedProductIds.push(productId);
        
        // Track all variants for this product
        if (!productToVariantsMap.has(productId)) {
          productToVariantsMap.set(productId, []);
        }
        if (variantId) {
          productToVariantsMap.get(productId)!.push(variantId);
        }
      }
      
      if (variantId) {
        purchasedVariantIds.push(variantId);
        if (productId) {
          variantToProductMap.set(variantId, productId);
        }
      }
    });
    
    // Deduplicate
    const uniqueProductIds = [...new Set(purchasedProductIds)];
    const uniqueVariantIds = [...new Set(purchasedVariantIds)];
    
    console.log("🛍️ Purchased products:", { productIds: uniqueProductIds, variantIds: uniqueVariantIds });
    console.log("🔗 Variant→Product map:", Array.from(variantToProductMap.entries()).slice(0, 5));
    console.log("🔗 Product→Variants map:", Array.from(productToVariantsMap.entries()).slice(0, 5));
    
    if (uniqueProductIds.length === 0 && uniqueVariantIds.length === 0) {
      console.log("⚠️ No products in order, skipping attribution");
      return;
    }
    
    console.log(`🔍 Checking attribution for ${uniqueProductIds.length} products, ${uniqueVariantIds.length} variants`);
    
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
    
    // Build a set of clicked product IDs AND variant IDs
    // Need to check both because clicks might be tracked as variants
    const clickedProductIds = new Set<string>();
    const clickedVariantIds = new Set<string>();
    
    clickEvents.forEach((e: any) => {
      const id = String(e.productId);
      
      // Add the clicked ID (could be variant or product)
      if (id.length > 10) {
        // Likely a variant ID
        clickedVariantIds.add(id);
      } else {
        // Likely a product ID
        clickedProductIds.add(id);
      }
      
      // Check metadata for parent product ID and variant ID
      try {
        const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
        
        // New tracking format: parentProductId is the product, variantId is the variant
        if (metadata?.variantId) {
          clickedVariantIds.add(String(metadata.variantId));
        }
        if (metadata?.productId) {
          clickedProductIds.add(String(metadata.productId));
        }
      } catch (_err) {
        // Ignore parse errors
      }
    });
    
    console.log(`👆 Clicked IDs:`, { 
      products: Array.from(clickedProductIds).slice(0, 5),
      variants: Array.from(clickedVariantIds).slice(0, 5),
      totalClicks: clickEvents.length
    });
    console.log(`🛒 Purchased IDs:`, { 
      products: uniqueProductIds.slice(0, 5),
      variants: uniqueVariantIds.slice(0, 5)
    });
    
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
        // 1. In recommendations (check both product IDs and variant IDs) AND
        // 2. Were clicked by customer (check both product IDs and variant IDs) AND
        // 3. Were purchased
        const matches: string[] = [];
        
        // Check product IDs
        for (const productId of uniqueProductIds) {
          const wasRecommended = recommendedIds.includes(productId) || 
                                recommendedIds.includes(Number(productId)) || 
                                recommendedIds.includes(String(productId));
          
          if (!wasRecommended) continue;
          
          // Check if THIS product ID was clicked directly, or if any of its variants were clicked
          let wasClicked = clickedProductIds.has(productId);
          
          if (!wasClicked && productToVariantsMap.has(productId)) {
            // Check if any variant of this product was clicked
            const variants = productToVariantsMap.get(productId)!;
            wasClicked = variants.some(vid => clickedVariantIds.has(vid));
          }
          
          console.log(`   🔍 Product ${productId}: recommended=true, clicked=${wasClicked}`);
          
          if (wasClicked) {
            matches.push(productId);
          }
        }
        
        // Also check variant IDs that were purchased
        for (const variantId of uniqueVariantIds) {
          // Was this variant's parent product recommended?
          const parentProductId = variantToProductMap.get(variantId);
          
          const wasRecommended = recommendedIds.includes(variantId) || 
                                recommendedIds.includes(Number(variantId)) ||
                                (parentProductId && (
                                  recommendedIds.includes(parentProductId) ||
                                  recommendedIds.includes(Number(parentProductId))
                                ));
          
          if (!wasRecommended) continue;
          
          // Check if this variant was clicked, or if its parent product was clicked
          let wasClicked = clickedVariantIds.has(variantId) || clickedProductIds.has(variantId);
          
          if (!wasClicked && parentProductId) {
            wasClicked = clickedProductIds.has(parentProductId);
          }
          
          console.log(`   🔍 Variant ${variantId} (product ${parentProductId}): recommended=true, clicked=${wasClicked}`);
          
          if (wasClicked && !matches.includes(variantId)) {
            matches.push(variantId);
          }
        }
        
        if (matches.length > 0) {
          console.log(`✅ ATTRIBUTED! Products/Variants ${matches.join(', ')} were recommended, clicked, AND purchased`);
          attributedProducts.push(...matches);
          recommendationIds.push(event.id);
        } else {
          // Debug: Show what was missing
          const recommended = [...uniqueProductIds, ...uniqueVariantIds].filter((id: string) => 
            recommendedIds.includes(id) || 
            recommendedIds.includes(Number(id)) || 
            recommendedIds.includes(String(id)) ||
            (variantToProductMap.has(id) && recommendedIds.includes(variantToProductMap.get(id)!))
          );
          if (recommended.length > 0) {
            console.log(`   ⚠️ Items ${recommended.slice(0, 3).join(', ')} were recommended but NOT clicked`);
          }
        }
      } catch (e) {
        console.warn("Failed to parse event metadata:", e);
      }
    }
    
    // Remove duplicates
    attributedProducts = [...new Set(attributedProducts)];
    
    console.log(`🎯 Attribution summary:`, {
      totalProducts: uniqueProductIds.length,
      totalVariants: uniqueVariantIds.length,
      totalRecommended: servedEvents.length,
      totalClicked: clickedProductIds.size + clickedVariantIds.size,
      totalAttributed: attributedProducts.length,
      attributedProducts,
      recommendationEventIds: recommendationIds
    });
    
    if (attributedProducts.length === 0) {
      console.log("ℹ️ No attributed products (recommendations were not clicked or different items purchased)");
      
      // Still valuable: track what they bought INSTEAD
      await trackMissedOpportunity(shop, uniqueProductIds, servedEvents[0]);
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
