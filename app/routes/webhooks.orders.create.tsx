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
    
    // 🛡️ DUPLICATE PREVENTION: Check if we already processed this order
    const existingAttribution = await (db as any).recommendationAttribution?.findFirst({
      where: {
        shop,
        orderId: order.id?.toString()
      }
    });
    
    if (existingAttribution) {
      console.log(`⚠️ Order ${orderNumber} already attributed, skipping duplicate processing`);
      return;
    }
    
    // 🎁 BUNDLE TRACKING: Check for bundle purchases and update analytics
    await processBundlePurchases(shop, order);
    
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
    // 🎯 KEY: Only attribute by PRODUCT ID to avoid duplicates (not variants)
    const attributedProductIds = new Set<string>(); // Use Set to prevent duplicates
    let recommendationIds: string[] = [];
    
    for (const event of servedEvents) {
      try {
        const metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        
        const recommendedIds = metadata?.recommendationIds || [];
        
        console.log(`📝 Served Event ${event.id}:`);
        console.log(`   - Recommended IDs (${recommendedIds.length}): ${recommendedIds.slice(0, 3).join(', ')}...`);
        
        // Check each purchased PRODUCT to see if it was recommended AND clicked
        // We only attribute by product ID, never by variant ID (to avoid duplicates)
        for (const productId of uniqueProductIds) {
          // Skip if already attributed
          if (attributedProductIds.has(productId)) continue;
          
          // Was this product recommended?
          const wasRecommended = recommendedIds.includes(productId) || 
                                recommendedIds.includes(Number(productId)) || 
                                recommendedIds.includes(String(productId));
          
          if (!wasRecommended) continue;
          
          // Was this product (or any of its variants) clicked?
          let wasClicked = clickedProductIds.has(productId);
          
          if (!wasClicked && productToVariantsMap.has(productId)) {
            // Check if any variant of this product was clicked
            const variants = productToVariantsMap.get(productId)!;
            wasClicked = variants.some(vid => clickedVariantIds.has(vid));
          }
          
          console.log(`   🔍 Product ${productId}: recommended=${wasRecommended}, clicked=${wasClicked}`);
          
          if (wasClicked) {
            attributedProductIds.add(productId);
            recommendationIds.push(event.id);
            console.log(`   ✅ ATTRIBUTED: Product ${productId}`);
          }
        }
      } catch (e) {
        console.warn("Failed to parse event metadata:", e);
      }
    }
    
    // Convert Set to Array for processing
    const attributedProducts = Array.from(attributedProductIds);
    
    console.log(`🎯 Attribution summary:`, {
      totalProducts: uniqueProductIds.length,
      totalVariants: uniqueVariantIds.length,
      totalRecommended: servedEvents.length,
      totalClicked: clickedProductIds.size + clickedVariantIds.size,
      totalAttributed: attributedProducts.length,
      attributedProducts,
      recommendationEventIds: [...new Set(recommendationIds)] // Remove duplicate event IDs
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
  // First try matching by product_id
  let lineItem = order.line_items?.find((item: any) => 
    item.product_id?.toString() === productId
  );
  
  // If not found, try matching by variant_id (since attributed products could be variants)
  if (!lineItem) {
    lineItem = order.line_items?.find((item: any) => 
      item.variant_id?.toString() === productId
    );
  }
  
  if (!lineItem) {
    console.warn(`⚠️ Could not find line item for product/variant ${productId}`);
    return 0;
  }
  
  const revenue = parseFloat(lineItem.price || 0) * (lineItem.quantity || 1);
  console.log(`💰 Product ${productId}: £${lineItem.price} × ${lineItem.quantity} = £${revenue.toFixed(2)}`);
  
  return revenue;
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

/**
 * 🎁 Process Bundle Purchases
 * Track bundle purchases and update analytics
 */
async function processBundlePurchases(shop: string, order: any) {
  try {
    const orderId = order.id?.toString();
    console.log("🎁 Checking for bundle purchases in order:", orderId);
    
    // 🛡️ DUPLICATE PREVENTION: Check if we already tracked bundles for this order
    const existingBundleTracking = await (db as any).bundlePurchase?.findFirst({
      where: {
        shop,
        orderId
      }
    });
    
    if (existingBundleTracking) {
      console.log(`⚠️ Bundle tracking already exists for order ${orderId}, skipping duplicate`);
      return;
    }
    
    // Group line items by bundle_id from properties
    const bundleGroups = new Map<string, any[]>();
    
    order.line_items?.forEach((item: any) => {
      const properties = item.properties || [];
      
      // Find bundle properties (Shopify stores custom properties as array of {name, value} objects)
      let bundleId: string | null = null;
      let bundleName: string | null = null;
      
      properties.forEach((prop: any) => {
        if (prop.name === '_bundle_id') {
          bundleId = prop.value;
          console.log(`🔍 Found _bundle_id: ${bundleId} in line item: ${item.title}`);
        }
        if (prop.name === '_bundle_name') {
          bundleName = prop.value;
          console.log(`🔍 Found _bundle_name: ${bundleName}`);
        }
      });
      
      if (bundleId) {
        if (!bundleGroups.has(bundleId)) {
          bundleGroups.set(bundleId, []);
        }
        bundleGroups.get(bundleId)!.push({
          ...item,
          bundleName
        });
      }
    });
    
    if (bundleGroups.size === 0) {
      console.log("ℹ️ No bundle purchases found in this order");
      return;
    }
    
    console.log(`🎁 Found ${bundleGroups.size} bundle purchase(s) in order`);
    
    // Process each bundle purchase
    for (const [bundleId, items] of bundleGroups) {
      try {
        const bundleName = items[0].bundleName || 'Unknown Bundle';
        
        // Calculate total revenue for this bundle purchase
        let totalRevenue = 0;
        items.forEach((item: any) => {
          const price = parseFloat(item.price || 0);
          const quantity = parseInt(item.quantity || 1);
          totalRevenue += price * quantity;
        });
        
        console.log(`🎁 Bundle ${bundleId} (${bundleName}): £${totalRevenue.toFixed(2)} from ${items.length} items`);
        
        // Strip "ai-" prefix if present (AI bundles have format "ai-123")
        const dbBundleId = bundleId.startsWith('ai-') ? bundleId.replace('ai-', '') : bundleId;
        console.log(`🔍 Looking up bundle in DB: original=${bundleId}, dbId=${dbBundleId}`);
        
        // Try multiple lookup strategies
        let bundle = await (db as any).bundle?.findFirst({
          where: {
            shop,
            id: dbBundleId
          }
        });
        
        // If not found, try with original ID (in case it's already stored correctly)
        if (!bundle && bundleId !== dbBundleId) {
          console.log(`🔍 Trying original ID: ${bundleId}`);
          bundle = await (db as any).bundle?.findFirst({
            where: {
              shop,
              id: bundleId
            }
          });
        }
        
        // If still not found, try by name as last resort
        if (!bundle && bundleName) {
          console.log(`🔍 Trying by name: ${bundleName}`);
          bundle = await (db as any).bundle?.findFirst({
            where: {
              shop,
              name: bundleName
            }
          });
        }
        
        if (bundle) {
          console.log(`✅ Found bundle in DB: ${bundle.name} (type: ${bundle.type})`);
          const currentPurchases = bundle.totalPurchases || 0;
          const currentRevenue = bundle.totalRevenue || 0;
          
          await (db as any).bundle?.update({
            where: { id: bundle.id },
            data: {
              totalPurchases: currentPurchases + 1,
              totalRevenue: currentRevenue + totalRevenue,
              updatedAt: new Date()
            }
          });
          
          console.log(`✅ Updated bundle ${bundleId}: purchases ${currentPurchases} → ${currentPurchases + 1}, revenue £${currentRevenue} → £${(currentRevenue + totalRevenue).toFixed(2)}`);
        } else {
          console.warn(`⚠️ Bundle ${bundleId} (dbId: ${dbBundleId}) not found in database for shop: ${shop}`);
        }
        
      } catch (err) {
        console.error(`❌ Failed to process bundle ${bundleId}:`, err);
      }
    }
    
    // 📝 Create tracking record to prevent duplicate processing
    try {
      await (db as any).bundlePurchase?.create({
        data: {
          shop,
          orderId: order.id?.toString(),
          orderNumber: order.order_number || order.number,
          bundleCount: bundleGroups.size,
          createdAt: new Date()
        }
      });
      console.log(`✅ Created bundle purchase tracking record for order ${order.id}`);
    } catch (err) {
      console.error("❌ Failed to create bundle purchase tracking:", err);
    }
    
  } catch (error) {
    console.error("❌ Failed to process bundle purchases:", error);
  }
}
