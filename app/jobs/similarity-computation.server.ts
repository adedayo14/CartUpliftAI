/**
 * ============================================================================
 * SIMILARITY COMPUTATION JOB
 * ============================================================================
 * 
 * PURPOSE:
 * Analyzes actual order data to compute product-to-product similarity scores.
 * Fills MLProductSimilarity table with real co-purchase patterns.
 * 
 * RUNS: Weekly (more compute-intensive than daily learning)
 * 
 * LOGIC:
 * 1. Get all orders from last 90 days
 * 2. Build co-purchase matrix (which products bought together)
 * 3. Calculate similarity scores using:
 *    - Co-purchase frequency (how often bought together)
 *    - Jaccard similarity (overlap in customer base)
 *    - Category overlap (same category = bonus)
 * 4. Store top N similar products per product
 * 
 * METRICS:
 * - Co-purchase count: Raw frequency
 * - Similarity score: 0-1 normalized score
 * - Confidence: Based on sample size
 */

import prisma from "~/db.server";
import { startHealthLog } from "~/services/health-logger.server";

interface ProductPair {
  productId1: string;
  productId2: string;
  coPurchaseCount: number;
  sharedCustomers: Set<string>;
}

interface ProductMetadata {
  id: string;
  category?: string;
  totalOrders: number;
  customers: Set<string>;
}

/**
 * Run similarity computation for a single shop
 */
export async function runSimilarityComputation(shop: string) {
  const logger = await startHealthLog(shop, 'similarity_computation');
  
  console.log(`🔄 [SIMILARITY] Starting computation for shop: ${shop}`);
  
  try {
    // Get orders from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // Get purchase events from last 90 days (using tracking events as data source)
    const purchaseEvents = await prisma.trackingEvent.findMany({
      where: {
        shop,
        event: 'purchase',
        createdAt: { gte: ninetyDaysAgo },
        orderId: { not: null }
      },
      select: {
        orderId: true,
        productId: true,
        sessionId: true
      }
    });
    
    if (purchaseEvents.length === 0) {
      console.log(`⚠️  [SIMILARITY] No order data for ${shop} - skipping`);
      return { shop, analyzed: 0, similaritiesCreated: 0 };
    }
    
    // Build order map: orderId -> [productIds]
    const orderMap = new Map<string, Set<string>>();
    const productMetadata = new Map<string, ProductMetadata>();
    
    for (const event of purchaseEvents) {
      if (!event.orderId) continue;
      
      if (!orderMap.has(event.orderId)) {
        orderMap.set(event.orderId, new Set());
      }
      orderMap.get(event.orderId)!.add(event.productId);
      
      // Track product metadata
      if (!productMetadata.has(event.productId)) {
        productMetadata.set(event.productId, {
          id: event.productId,
          totalOrders: 0,
          customers: new Set()
        });
      }
      const meta = productMetadata.get(event.productId)!;
      meta.totalOrders++;
      meta.customers.add(event.orderId); // Using orderId as proxy for customer
    }
    
    // Build co-purchase matrix
    const pairMap = new Map<string, ProductPair>();
    
    for (const [orderId, productIds] of orderMap.entries()) {
      const productsArray = Array.from(productIds);
      
      // For each pair of products in the order
      for (let i = 0; i < productsArray.length; i++) {
        for (let j = i + 1; j < productsArray.length; j++) {
          const [id1, id2] = [productsArray[i], productsArray[j]].sort();
          const pairKey = `${id1}|${id2}`;
          
          if (!pairMap.has(pairKey)) {
            pairMap.set(pairKey, {
              productId1: id1,
              productId2: id2,
              coPurchaseCount: 0,
              sharedCustomers: new Set()
            });
          }
          
          const pair = pairMap.get(pairKey)!;
          pair.coPurchaseCount++;
          pair.sharedCustomers.add(orderId);
        }
      }
    }
    
    console.log(`📊 [SIMILARITY] Found ${pairMap.size} product pairs from ${orderMap.size} orders`);
    
    // Calculate similarity scores and create records
    const similarityRecords: Array<{
      shop: string;
      productId1: string;
      productId2: string;
      categoryScore: number;
      priceScore: number;
      coViewScore: number;
      coPurchaseScore: number;
      overallScore: number;
      sampleSize: number;
    }> = [];
    
    for (const [_pairKey, pair] of pairMap.entries()) {
      const meta1 = productMetadata.get(pair.productId1)!;
      const meta2 = productMetadata.get(pair.productId2)!;
      
      // Calculate Jaccard similarity: |intersection| / |union|
      const intersection = pair.sharedCustomers.size;
      const union = meta1.customers.size + meta2.customers.size - intersection;
      const jaccardScore = union > 0 ? intersection / union : 0;
      
      // Co-purchase frequency: normalized by total orders
      const maxOrders = Math.max(meta1.totalOrders, meta2.totalOrders);
      const frequencyScore = maxOrders > 0 ? pair.coPurchaseCount / maxOrders : 0;
      
      // Combined similarity score (weighted average)
      const similarityScore = (jaccardScore * 0.6) + (frequencyScore * 0.4);
      
      // Only store if meaningful (similarity > 0.1, co-purchase >= 2)
      if (similarityScore > 0.1 && pair.coPurchaseCount >= 2) {
        // Create bidirectional records
        similarityRecords.push({
          shop,
          productId1: pair.productId1,
          productId2: pair.productId2,
          categoryScore: 0, // TODO: Add category similarity
          priceScore: 0, // TODO: Add price similarity
          coViewScore: 0, // TODO: Add co-view tracking
          coPurchaseScore: frequencyScore,
          overallScore: similarityScore,
          sampleSize: pair.coPurchaseCount
        });
        
        similarityRecords.push({
          shop,
          productId1: pair.productId2,
          productId2: pair.productId1,
          categoryScore: 0,
          priceScore: 0,
          coViewScore: 0,
          coPurchaseScore: frequencyScore,
          overallScore: similarityScore,
          sampleSize: pair.coPurchaseCount
        });
      }
    }
    
    // Store in database (replace all existing similarities for this shop)
    await prisma.$transaction(async (tx) => {
      // Delete old similarities
      await tx.mLProductSimilarity.deleteMany({
        where: { shop }
      });
      
      // Insert new similarities (in batches to avoid query limits)
      const batchSize = 1000;
      for (let i = 0; i < similarityRecords.length; i += batchSize) {
        const batch = similarityRecords.slice(i, i + batchSize);
        await tx.mLProductSimilarity.createMany({
          data: batch,
          skipDuplicates: true
        });
      }
    });
    
    console.log(`✅ [SIMILARITY] ${shop}: Created ${similarityRecords.length} similarity records`);
    
    await logger.success({
      recordsProcessed: pairMap.size,
      recordsCreated: similarityRecords.length,
      metadata: {
        purchaseEvents: purchaseEvents.length,
        orderCount: orderMap.size,
        productCount: productMetadata.size
      }
    });
    
    return {
      shop,
      analyzed: pairMap.size,
      similaritiesCreated: similarityRecords.length
    };
    
  } catch (error) {
    console.error(`❌ [SIMILARITY] Error for ${shop}:`, error);
    
    await logger.failure(error as Error);
    
    return {
      shop,
      analyzed: 0,
      similaritiesCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Run similarity computation for all shops
 */
export async function runSimilarityComputationForAllShops() {
  console.log(`🚀 [SIMILARITY] Starting computation for all shops`);
  
  try {
    // Get all unique shops
    const shops = await prisma.settings.findMany({
      select: { shop: true }
    });
    
    console.log(`📋 [SIMILARITY] Found ${shops.length} shops to process`);
    
    const results = [];
    for (const { shop } of shops) {
      const result = await runSimilarityComputation(shop);
      results.push(result);
    }
    
    const successCount = results.filter(r => !r.error).length;
    const totalSimilarities = results.reduce((sum, r) => sum + r.similaritiesCreated, 0);
    
    console.log(`✅ [SIMILARITY] Batch complete: ${successCount}/${shops.length} shops, ${totalSimilarities} similarities created`);
    
    return {
      success: true,
      totalShops: shops.length,
      successfulShops: successCount,
      totalSimilarities,
      results
    };
    
  } catch (error) {
    console.error('❌ [SIMILARITY] Batch computation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
