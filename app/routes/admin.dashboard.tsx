import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Grid,
  DataTable,
  Icon,
  Select,
  Modal,
  Checkbox,
  Box,
  ProgressBar,
  Banner,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { 
  CashDollarIcon, 
  OrderIcon,
  MagicIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getSettings } from "../models/settings.server";
import prisma from "../db.server";
import { getShopCurrency } from "../services/currency.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const timeframe = url.searchParams.get("timeframe") || "30d";
  const search = url.search;
  const customStartDate = url.searchParams.get("startDate");
  const customEndDate = url.searchParams.get("endDate");
  
  // Calculate date range based on timeframe or custom dates
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  
  if (customStartDate && customEndDate) {
    startDate = new Date(customStartDate);
    endDate = new Date(customEndDate);
    // Ensure end date includes the full day
    endDate.setHours(23, 59, 59, 999);
  } else {
    switch (timeframe) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "ytd":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "all":
        startDate = new Date(2020, 0, 1); // Go back to 2020 for "all time"
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  // Calculate previous period dates for real comparisons
  const periodDuration = endDate.getTime() - startDate.getTime();
  const previousPeriodEnd = new Date(startDate.getTime() - 1); // 1ms before current period
  const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodDuration);

  // Fetch comprehensive analytics data
  try {
    // 🔍 CRITICAL: Verify session and shop exist
    if (!session || !session.shop) {
      console.error('❌ CRITICAL: No session or shop in loader');
      console.error('Session:', session);
      throw new Error('No authenticated session - user may need to reinstall app');
    }

    // 🔍 CRITICAL: Test database connection first
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbError) {
      console.error('❌ DATABASE CONNECTION FAILED:', dbError);
      throw new Error(`Database connection error: ${dbError instanceof Error ? dbError.message : 'Unknown DB error'}`);
    }

    // ⚠️ WORKAROUND: Check if app has order access, if not use tracking data only
    let ordersData: any = null;
    let shopData: any = null;
    let hasOrderAccess = true;
    
    try {
      // Get real orders with detailed line items - NO date filter to start
      console.log('🔍 DEBUG: Fetching ALL orders (no filter)');
      
      const ordersResponse = await admin.graphql(`
        #graphql
        query getAllOrders {
          orders(first: 250, reverse: true) {
            edges {
              node {
                id
                name
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                createdAt
                processedAt
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      quantity
                      originalTotalSet {
                        shopMoney {
                          amount
                        }
                      }
                      product {
                        title
                        id
                      }
                      variant {
                        id
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `);

      ordersData = await ordersResponse.json();
      
      console.log('🔍 DEBUG: Orders response:', {
        hasData: !!ordersData?.data,
        hasOrders: !!ordersData?.data?.orders,
        orderCount: ordersData?.data?.orders?.edges?.length || 0,
        hasErrors: !!ordersData?.errors,
        errors: ordersData?.errors,
        firstOrderDate: ordersData?.data?.orders?.edges?.[0]?.node?.createdAt
      });
      
      // Check for GraphQL errors
      if (ordersData.errors) {
        console.error('❌ GraphQL errors:', JSON.stringify(ordersData.errors, null, 2));
        hasOrderAccess = false;
        ordersData = null;
      } else if (!ordersData?.data?.orders) {
        console.error('❌ No orders data in response');
        hasOrderAccess = false;
        ordersData = null;
      }
    } catch (orderError) {
      console.error('❌ Exception fetching orders:', orderError);
      hasOrderAccess = false;
      ordersData = null;
    }

    // Get shop analytics for real cart data
    const shopResponse = await admin.graphql(`
      #graphql
      query getShop {
        shop {
          name
          myshopifyDomain
          plan {
            displayName
          }
        }
      }
    `);

    shopData = await shopResponse.json();
    
    // Get app settings for free shipping threshold analysis
    const settings = await getSettings(session.shop);
    
    // Handle order data - use empty array if no access
    const allOrders = (hasOrderAccess && ordersData?.data?.orders?.edges) ? ordersData.data.orders.edges : [];
    
    // Filter orders by date range for CURRENT period
    const orders = allOrders.filter((order: any) => {
      const orderDate = new Date(order.node.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
    
    // Filter orders for PREVIOUS period (for real comparisons)
    const previousOrders = allOrders.filter((order: any) => {
      const orderDate = new Date(order.node.createdAt);
      return orderDate >= previousPeriodStart && orderDate <= previousPeriodEnd;
    });
    
    console.log('🔍 DEBUG: Final order processing:', {
      hasOrderAccess,
      allOrdersLength: allOrders.length,
      currentPeriodOrders: orders.length,
      previousPeriodOrders: previousOrders.length,
      timeframe,
      currentPeriod: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      previousPeriod: `${previousPeriodStart.toISOString()} to ${previousPeriodEnd.toISOString()}`,
    });
    
    const shop = shopData.data?.shop;
    
    // Fetch shop currency
    const shopCurrency = await getShopCurrency(session.shop);
    const storeCurrency = orders.length > 0 ? 
      orders[0].node.totalPriceSet?.shopMoney?.currencyCode || shopCurrency.code : shopCurrency.code;
    
    // ⚠️ Log if order fetch failed
    if (!hasOrderAccess) {
      console.warn('⚠️ Could not fetch order data - check API permissions or network');
    }
    
    // Helper function to calculate metrics for any period
    const calculatePeriodMetrics = (periodOrders: any[]) => {
      const totalOrders = periodOrders.length;
      const totalRevenue = periodOrders.reduce((sum: number, order: any) => {
        return sum + parseFloat(order.node.totalPriceSet.shopMoney.amount);
      }, 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      // Count multi-product orders (potential upsells)
      const multiProductOrders = periodOrders.filter((order: any) => {
        const lineItemCount = order.node.lineItems?.edges?.length || 0;
        return lineItemCount > 1;
      });
      
      // ❌ REMOVED: No more 30% rule-of-thumb attribution
      // We now use ONLY real tracked revenue from RecommendationAttribution table
      // This will be calculated separately from attribution data
      
      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        multiProductOrderCount: multiProductOrders.length
      };
    };
    
    // Calculate metrics for CURRENT period
    const currentMetrics = calculatePeriodMetrics(orders);
    const totalOrders = currentMetrics.totalOrders;
    const totalRevenue = currentMetrics.totalRevenue;
    const averageOrderValue = currentMetrics.averageOrderValue;
    
    // Calculate metrics for PREVIOUS period
    const previousMetrics = calculatePeriodMetrics(previousOrders);
    
    console.log('🔍 DEBUG: Metrics comparison:', {
      current: currentMetrics,
      previous: previousMetrics,
      change: {
        orders: totalOrders - previousMetrics.totalOrders,
        revenue: totalRevenue - previousMetrics.totalRevenue,
        aov: averageOrderValue - previousMetrics.averageOrderValue
      }
    });
    
    // 📊 Query REAL cart open tracking data
    let cartImpressions = 0;
    let cartOpensToday = 0;
    
    try {
      // Get all cart_open events in the current period
      const cartOpenEvents = await (db as any).analyticsEvent?.findMany?.({
        where: {
          shop: session.shop,
          eventType: 'cart_open',
          createdAt: { gte: startDate, lte: endDate }
        }
      }) ?? [];
      
      cartImpressions = cartOpenEvents.length;
      
      // If today, get today's cart opens
      if (timeframe === "today") {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEvents = await (db as any).analyticsEvent?.findMany?.({
          where: {
            shop: session.shop,
            eventType: 'cart_open',
            createdAt: { gte: todayStart, lte: endDate }
          }
        }) ?? [];
        cartOpensToday = todayEvents.length;
      } else {
        cartOpensToday = cartImpressions;
      }
      
      console.log(`📊 [Cart Tracking] Cart Opens: ${cartImpressions}, Today: ${cartOpensToday}`);
    } catch (e) {
      console.warn("Failed to fetch cart opens:", e);
      // If tracking not available, show 0 instead of estimate
      cartImpressions = 0;
      cartOpensToday = 0;
    }
    
    const checkoutsCompleted = totalOrders;
    const cartToCheckoutRate = cartImpressions > 0 ? (totalOrders / cartImpressions) * 100 : 0;
    
    // ✅ FREE SHIPPING THRESHOLD TRACKING - Simple percentage calculation
    const freeShippingThreshold = settings?.freeShippingThreshold || 0;
    
    let ordersWithFreeShipping = 0;
    let ordersWithoutFreeShipping = 0;
    let avgAOVWithFreeShipping = 0;
    let avgAOVWithoutFreeShipping = 0;
    let freeShippingRevenue = 0;
    let nonFreeShippingRevenue = 0;
    
    // Always calculate - check if each order reached the threshold
    orders.forEach((order: any) => {
      const orderTotal = parseFloat(order.node.totalPriceSet.shopMoney.amount);
      if (orderTotal >= freeShippingThreshold) {
        ordersWithFreeShipping += 1;
        freeShippingRevenue += orderTotal;
      } else {
        ordersWithoutFreeShipping += 1;
        nonFreeShippingRevenue += orderTotal;
      }
    });
    
    avgAOVWithFreeShipping = ordersWithFreeShipping > 0 ? freeShippingRevenue / ordersWithFreeShipping : 0;
    avgAOVWithoutFreeShipping = ordersWithoutFreeShipping > 0 ? nonFreeShippingRevenue / ordersWithoutFreeShipping : 0;
    
    // Calculate free shipping bar effectiveness
    const freeShippingConversionRate = totalOrders > 0 ? (ordersWithFreeShipping / totalOrders) * 100 : 0;
    const freeShippingAOVLift = avgAOVWithoutFreeShipping > 0 ? 
      ((avgAOVWithFreeShipping - avgAOVWithoutFreeShipping) / avgAOVWithoutFreeShipping) * 100 : 0;
    
    // Calculate average amount added to reach free shipping threshold
    const avgAmountAddedForFreeShipping = avgAOVWithFreeShipping > freeShippingThreshold 
      ? avgAOVWithFreeShipping - freeShippingThreshold 
      : 0;
    
    // ✅ GIFT THRESHOLD IMPACT ANALYSIS (NEW TRACKING)
    let giftThresholds: Array<{ threshold: number; productId: string; productTitle: string }> = [];
    
    // Parse gift thresholds first to determine if gift gating is enabled
    if (settings?.giftThresholds) {
      try {
        giftThresholds = JSON.parse(settings.giftThresholds);
      } catch (e) {
        console.error('Error parsing gift thresholds:', e);
      }
    }
    
    let ordersReachingGifts = 0;
    let ordersNotReachingGifts = 0;
    let avgAOVWithGift = 0;
    let avgAOVWithoutGift = 0;
    let giftRevenue = 0;
    let nonGiftRevenue = 0;
    let giftThresholdBreakdown: Array<{ threshold: number; ordersReached: number; percentReached: number }> = [];
    
    // Always calculate if thresholds exist
    if (giftThresholds.length > 0) {
      // Find the lowest gift threshold (first milestone)
      const lowestThreshold = Math.min(...giftThresholds.map(g => g.threshold));
      
      if (lowestThreshold > 0) {
          orders.forEach((order: any) => {
            const orderTotal = parseFloat(order.node.totalPriceSet.shopMoney.amount);
            if (orderTotal >= lowestThreshold) {
              ordersReachingGifts += 1;
              giftRevenue += orderTotal;
            } else {
              ordersNotReachingGifts += 1;
              nonGiftRevenue += orderTotal;
            }
          });
          
          avgAOVWithGift = ordersReachingGifts > 0 ? giftRevenue / ordersReachingGifts : 0;
          avgAOVWithoutGift = ordersNotReachingGifts > 0 ? nonGiftRevenue / ordersNotReachingGifts : 0;
          
          // Calculate breakdown for each threshold
          giftThresholdBreakdown = giftThresholds.map(gift => {
            const ordersReached = orders.filter((order: any) => 
              parseFloat(order.node.totalPriceSet.shopMoney.amount) >= gift.threshold
            ).length;
            return {
              threshold: gift.threshold,
              ordersReached,
              percentReached: totalOrders > 0 ? (ordersReached / totalOrders) * 100 : 0
            };
          });
        }
    }
    
    // Calculate gift conversion metrics
    const giftConversionRate = totalOrders > 0 ? (ordersReachingGifts / totalOrders) * 100 : 0;
    const giftAOVLift = avgAOVWithoutGift > 0 ? 
      ((avgAOVWithGift - avgAOVWithoutGift) / avgAOVWithoutGift) * 100 : 0;
    
    // Calculate average amount added to reach gift threshold
    const lowestGiftThreshold = giftThresholds.length > 0 
      ? Math.min(...giftThresholds.map(g => g.threshold)) 
      : 0;
    const avgAmountAddedForGift = lowestGiftThreshold > 0 && avgAOVWithGift > lowestGiftThreshold
      ? avgAOVWithGift - lowestGiftThreshold
      : 0;
    
    // Calculate product performance from real order line items
    const productStats = new Map();
    orders.forEach((order: any) => {
      order.node.lineItems?.edges?.forEach((lineItem: any) => {
        const productTitle = lineItem.node.product?.title;
        if (productTitle) {
          const existing = productStats.get(productTitle) || { orders: 0, revenue: 0, quantity: 0 };
          existing.orders += 1;
          existing.revenue += parseFloat(lineItem.node.originalTotalSet?.shopMoney?.amount || '0');
          existing.quantity += lineItem.node.quantity;
          productStats.set(productTitle, existing);
        }
      });
    });
    
    // Generate top performing products from REAL data
    const topProducts = Array.from(productStats.entries())
      .sort(([,a], [,b]) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(([title, stats]) => ({
        product: title,
        orders: stats.orders,
        quantity: stats.quantity,
        revenue: stats.revenue,
        avgOrderValue: stats.orders > 0 ? (stats.revenue / stats.orders).toFixed(2) : '0.00'
      }));
    
    // Top upsells populated from tracking data below (after fetching TrackingEvent records)
    const topUpsells: Array<any> = [];

    // ✅ SMART BUNDLE OPPORTUNITIES (REAL CO-OCCURRENCE ANALYSIS)
    const bundleOpportunities = [];
    if (orders.length > 10) { // Only analyze if we have enough data
      const productPairs = new Map();
      const productNames = new Map(); // Track individual product names and IDs
      
      // Build product co-occurrence matrix from real orders
      orders.forEach((order: any) => {
        const lineItems = order.node.lineItems?.edges || [];
        const products = lineItems.map((item: any) => ({
          id: item.node.product?.id,
          title: item.node.product?.title
  })).filter((p: { id?: string; title?: string }) => p.id && p.title);
        
        // Track individual products
  products.forEach((product: { id: string; title: string }) => {
          productNames.set(product.id, product.title);
        });
        
        // Generate pairs for this order
        for (let i = 0; i < products.length; i++) {
          for (let j = i + 1; j < products.length; j++) {
            const pair = [products[i].id, products[j].id].sort().join('|');
            const pairInfo = productPairs.get(pair) || {
              product1: { id: products[i].id, title: products[i].title },
              product2: { id: products[j].id, title: products[j].title },
              count: 0
            };
            pairInfo.count += 1;
            productPairs.set(pair, pairInfo);
          }
        }
      });
      
      // Calculate co-occurrence percentages and filter for high-frequency pairs
      const totalOrdersWithMultipleItems = orders.filter((order: any) => {
        const lineItemCount = order.node.lineItems?.edges?.length || 0;
        return lineItemCount > 1;
      }).length;
      
      if (totalOrdersWithMultipleItems > 0) {
        const highFrequencyPairs = Array.from(productPairs.entries())
          .map(([, pairData]) => ({
            ...pairData,
            coOccurrenceRate: Math.round((pairData.count / totalOrdersWithMultipleItems) * 100)
          }))
          .filter(pair => pair.coOccurrenceRate >= 60) // 60%+ threshold as requested
          .sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate)
          .slice(0, 3); // Top 3 opportunities
        
        bundleOpportunities.push(...highFrequencyPairs);
      }
    }

    // Pull lightweight rec tracking from DB (best-effort)
    let recSummary = { totalImpressions: 0, totalClicks: 0, ctr: 0 };
    let recCTRSeries: Array<{ date: string; impressions: number; clicks: number; ctr: number }> = [];
    let topRecommended: Array<{ productId: string; productTitle: string; impressions: number; clicks: number; ctr: number; revenueCents: number }> = [];
    try {
      const events = await (db as any).trackingEvent?.findMany?.({
        where: { shop: session.shop, createdAt: { gte: startDate, lte: endDate } }
      }) ?? [];
      
      // Check for ML recommendation events (used for attribution)
      const mlEvents = events.filter((e: any) => e.event === 'ml_recommendation_served');
      console.log(`📊 [Tracking Debug] Total events: ${events.length}, ML recommendation events: ${mlEvents.length}`);
      
      if (mlEvents.length > 0) {
        const sample = mlEvents[0];
        console.log(`📋 [Tracking Debug] Sample ML event:`, {
          id: sample.id,
          event: sample.event,
          productId: sample.productId,
          metadata: typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : sample.metadata,
          createdAt: sample.createdAt
        });
      }
      
      const impressions = events.filter((e: any) => e.event === 'impression').length;
      const clicks = events.filter((e: any) => e.event === 'click').length;
      recSummary.totalImpressions = impressions;
      recSummary.totalClicks = clicks;
      recSummary.ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      // Build CTR series by day (UTC)
      const byDay: Record<string, { imp: number; clk: number }> = {};
      for (const e of events) {
        const d = new Date(e.createdAt);
        const key = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
        const b = byDay[key] || (byDay[key] = { imp: 0, clk: 0 });
        if (e.event === 'impression') b.imp++;
        else if (e.event === 'click') b.clk++;
      }
      recCTRSeries = Object.entries(byDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, impressions: v.imp, clicks: v.clk, ctr: v.imp > 0 ? (v.clk / v.imp) * 100 : 0 }));

      // Top recommended items by clicks (with impressions, ctr, revenue)
      const byProduct: Record<string, { title: string; imp: number; clk: number; rev: number }>= {};
      for (const e of events) {
        const pid = e.productId as string | null;
        if (!pid) continue;
        
        // Filter out non-product tracking events (cart_event, empty_cart, etc.)
        if (pid.includes('_') || pid === 'undefined' || pid === 'null') continue;
        
        const rec = byProduct[pid] || (byProduct[pid] = { title: e.productTitle || '', imp: 0, clk: 0, rev: 0 });
        if (e.event === 'impression') rec.imp++;
        else if (e.event === 'click') rec.clk++;
        if (typeof e.revenueCents === 'number' && isFinite(e.revenueCents)) rec.rev += e.revenueCents;
        if (e.productTitle && !rec.title) rec.title = e.productTitle;
      }
      topRecommended = Object.entries(byProduct)
        .filter(([productId]) => productId && !productId.includes('_')) // Extra safety filter
        .map(([productId, v]) => ({ 
          productId, 
          productTitle: v.title || productId, 
          impressions: v.imp, 
          clicks: v.clk, 
          ctr: v.imp > 0 ? (v.clk / v.imp) * 100 : 0, 
          revenueCents: v.rev 
        }))
        .sort((a,b) => (b.clicks - a.clicks) || (b.impressions - a.impressions))
        .slice(0, 10);
  } catch (trackingError) { 
    console.error('❌ [Tracking Debug] Error fetching tracking events:', trackingError);
  }

    // ============================================
    // 🎯 Merge Real Tracking Data with Revenue Data for Upsell Performance
    // ============================================
    // NOTE: topUpsells will be populated after we fetch attribution data below

    // ============================================
    // 🎯 CRITICAL: Real Attribution Data (Phase 1 Implementation!)
    // ============================================
    let attributedRevenue = 0;
    let attributedOrders = 0;
    let topAttributedProducts: Array<{ productId: string; productTitle: string; revenue: number; orders: number }> = [];
    let orderUpliftBreakdown: Array<{ orderNumber: string; totalValue: number; baseValue: number; attributedValue: number; upliftPercentage: number; products: string[] }> = [];
    
    try {
      const attributions = await (db as any).recommendationAttribution?.findMany?.({
        where: {
          shop: session.shop,
          createdAt: { gte: startDate, lte: endDate }
        }
      }) ?? [];
      
      console.log(`🔍 [Attribution Debug] Found ${attributions.length} attribution records for ${session.shop}`);
      console.log(`📅 [Attribution Debug] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      console.log(`🔢 [Attribution Debug] CODE VERSION: NO-ESTIMATES-v2 (commit 06ddebc)`);
      
      if (attributions.length > 0) {
        console.log(`📊 [Attribution Debug] Sample record:`, {
          productId: attributions[0].productId,
          orderId: attributions[0].orderId,
          orderNumber: attributions[0].orderNumber,
          attributedRevenue: attributions[0].attributedRevenue,
          createdAt: attributions[0].createdAt
        });
        
        // Show breakdown by order
        const orderBreakdown = new Map();
        attributions.forEach((a: any) => {
          const key = a.orderNumber || a.orderId;
          if (!orderBreakdown.has(key)) {
            orderBreakdown.set(key, { count: 0, total: 0, products: [] });
          }
          const o = orderBreakdown.get(key);
          o.count++;
          o.total += (a.attributedRevenue || 0);
          o.products.push({ id: a.productId, revenue: a.attributedRevenue });
        });
        
        console.log(`📦 [Attribution Debug] Breakdown by order:`, Array.from(orderBreakdown.entries()).map(([order, data]) => ({
          order,
          products: data.count,
          totalRevenue: data.total,
          productDetails: data.products
        })));
      } else {
        // Check if we have ANY attribution records at all
        const allAttributions = await (db as any).recommendationAttribution?.findMany?.({
          where: { shop: session.shop },
          take: 5
        }) ?? [];
        
        console.log(`⚠️ [Attribution Debug] No attributions in date range. Total count: ${allAttributions.length}`);
        
        if (allAttributions.length > 0) {
          console.log(`📋 [Attribution Debug] Latest attribution:`, {
            productId: allAttributions[0].productId,
            orderId: allAttributions[0].orderId,
            orderNumber: allAttributions[0].orderNumber,
            attributedRevenue: allAttributions[0].attributedRevenue,
            createdAt: allAttributions[0].createdAt
          });
        }
      }
      
      // Calculate total attributed revenue (already in currency, not cents)
      attributedRevenue = attributions.reduce((sum: number, a: any) => 
        sum + (a.attributedRevenue || 0), 0
      );
      
      console.log(`💰 [Attribution Debug] Total attributed revenue: ${attributedRevenue}`);
      
      // Count unique orders with attributed sales
      const uniqueOrderIds = new Set(attributions.map((a: any) => a.orderId));
      attributedOrders = uniqueOrderIds.size;
      
      // Build product ID to title map from orders
      const productTitlesMap = new Map<string, string>();
      orders.forEach((order: any) => {
        order.node.lineItems?.edges?.forEach((lineItem: any) => {
          const productGid = lineItem.node.product?.id; // gid://shopify/Product/123
          const variantGid = lineItem.node.variant?.id; // gid://shopify/ProductVariant/456
          const productTitle = lineItem.node.product?.title;
          const variantTitle = lineItem.node.variant?.title;
          
          // Full title includes variant if it exists (e.g., "Snow Boots - Black")
          const fullTitle = variantTitle && variantTitle !== 'Default Title' 
            ? `${productTitle} - ${variantTitle}` 
            : productTitle;
          
          if (fullTitle) {
            // Map both product ID and variant ID to the title
            if (productGid) {
              const productId = productGid.split('/').pop();
              productTitlesMap.set(productId!, fullTitle);
            }
            if (variantGid) {
              const variantId = variantGid.split('/').pop();
              productTitlesMap.set(variantId!, fullTitle);
            }
          }
        });
      });
      
      // Group by product to find top performers
      const productMap = new Map<string, { revenue: number; orders: Set<string>; title: string }>();
      for (const attr of attributions) {
        const pid = attr.productId;
        if (!productMap.has(pid)) {
          productMap.set(pid, { revenue: 0, orders: new Set(), title: '' });
        }
        const p = productMap.get(pid)!;
        p.revenue += attr.attributedRevenue || 0;
        p.orders.add(attr.orderId);
      }
      
      topAttributedProducts = Array.from(productMap.entries())
        .map(([productId, data]) => {
          // Try to find title from our map (works for both product IDs and variant IDs)
          const numericId = productId.includes('/') ? productId.split('/').pop()! : productId;
          const title = productTitlesMap.get(numericId) || productTitlesMap.get(productId) || `Product ${numericId}`;
          
          return {
            productId,
            productTitle: title,
            revenue: data.revenue,
            orders: data.orders.size
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      
      // Also build order-level uplift data (for "Order Breakdown" display)
      // Key insight: Multiple products from same order share the same orderValue
      // We need to group by order FIRST, then calculate once per order
      const orderUpliftMap = new Map<string, { 
        orderNumber: string; 
        totalValue: number; 
        attributedValue: number; 
        products: Set<string>;
        productCount: number;
      }>();
      
      for (const attr of attributions) {
        const orderKey = attr.orderId;
        if (!orderUpliftMap.has(orderKey)) {
          orderUpliftMap.set(orderKey, {
            orderNumber: attr.orderNumber || orderKey,
            totalValue: attr.orderValue || 0, // This is the SAME for all products in this order
            attributedValue: 0,
            products: new Set(),
            productCount: 0
          });
        }
        const orderData = orderUpliftMap.get(orderKey)!;
        
        // Add attributed revenue for this product
        orderData.attributedValue += attr.attributedRevenue || 0;
        orderData.productCount++;
        
        // Get product title (deduplicate with Set)
        const pid = attr.productId;
        const numericId = pid.includes('/') ? pid.split('/').pop()! : pid;
        const title = productTitlesMap.get(numericId) || productTitlesMap.get(pid) || `Product ${numericId}`;
        orderData.products.add(title);
      }
      
      // Convert to array and calculate uplift percentages
      orderUpliftBreakdown = Array.from(orderUpliftMap.values())
        .map(order => {
          // Fix: If attributedValue > totalValue, it means all items were recommended
          // Cap attributedValue at totalValue to prevent overflow
          const cappedAttributedValue = Math.min(order.attributedValue, order.totalValue);
          
          // Base value = what they would've spent without recommendations
          const baseValue = order.totalValue - cappedAttributedValue;
          
          // Uplift percentage = how much of the order came from AI recommendations
          // Calculate as % of total order value from recommendations
          const upliftPercentage = order.totalValue > 0 ? ((cappedAttributedValue / order.totalValue) * 100) : 0;
          
          return {
            orderNumber: order.orderNumber,
            totalValue: order.totalValue,
            baseValue: Math.max(0, baseValue),
            attributedValue: cappedAttributedValue, // Use capped value
            upliftPercentage,
            products: Array.from(order.products), // Convert Set to Array
            productCount: order.productCount
          };
        })
        .filter(order => order.attributedValue > 0 && order.totalValue > 0) // Only valid orders
        .sort((a, b) => b.upliftPercentage - a.upliftPercentage) // Sort by highest uplift %
        .slice(0, 10); // Top 10 orders by uplift impact
      
      // Enrich topRecommended with revenue from attribution data
      if (topRecommended.length > 0) {
        topRecommended = topRecommended.map(rec => {
          // Find attribution revenue for this product
          const attribution = topAttributedProducts.find(p => 
            p.productId === rec.productId || 
            p.productTitle === rec.productTitle ||
            p.productId.includes(rec.productId)
          );
          
          return {
            ...rec,
            revenueCents: attribution ? Math.round(attribution.revenue * 100) : rec.revenueCents
          };
        });
      }
      
      // ============================================
      // 🎯 Build topUpsells with CORRECT attribution data (not total store orders)
      // ============================================
      // Create a map of attributed products by title for quick lookup
      const attributedProductMap = new Map<string, { revenue: number; orders: number }>();
      topAttributedProducts.forEach((product) => {
        attributedProductMap.set(product.productTitle, {
          revenue: product.revenue,
          orders: product.orders
        });
      });
      
      // Populate topUpsells with real tracking data merged with ATTRIBUTED revenue
      topUpsells.push(...topRecommended.slice(0, 10).map((tracked) => {
        const attributedData = attributedProductMap.get(tracked.productTitle);
        const orders = attributedData?.orders || 0;
        const revenue = attributedData?.revenue || 0;
        
        // ✅ CORRECT: Calculate conversion rate using ATTRIBUTED orders (not total store orders)
        // Conversion rate = (attributed orders / clicks) * 100
        const conversionRate = tracked.clicks > 0 ? ((orders / tracked.clicks) * 100).toFixed(1) : '0.0';
        
        return {
          product: tracked.productTitle,
          impressions: tracked.impressions,
          clicks: tracked.clicks,
          conversions: orders, // ✅ Shows attributed orders, not all store orders
          conversionRate: conversionRate, // ✅ Shows realistic % (e.g., 100%, not 3000%)
          revenue: revenue.toFixed(2), // ✅ Shows attributed revenue, not total product revenue
          ctr: tracked.ctr.toFixed(1)
        };
      }));
        
    } catch (error) {
      console.error('Error fetching attribution data:', error);
    }
    
    // 🎯 Calculate PREVIOUS PERIOD attribution for real comparisons
    let previousAttributedRevenue = 0;
    let previousAttributedOrders = 0;
    
    try {
      const previousAttributions = await (db as any).recommendationAttribution?.findMany?.({
        where: {
          shop: session.shop,
          createdAt: { gte: previousPeriodStart, lte: previousPeriodEnd }
        }
      }) ?? [];
      
      previousAttributedRevenue = previousAttributions.reduce((sum: number, a: any) => 
        sum + (a.attributedRevenue || 0), 0
      );
      
      const previousUniqueOrders = new Set(previousAttributions.map((a: any) => a.orderId));
      previousAttributedOrders = previousUniqueOrders.size;
      
      console.log(`💰 [Previous Period Attribution] Revenue: ${previousAttributedRevenue}, Orders: ${previousAttributedOrders}`);
    } catch (e) {
      console.warn("Failed to fetch previous period attributions:", e);
    }
    
    // ============================================
    // 🧠 ML System Status (Phase 2 & 3 Implementation!)
    // ============================================
    let mlStatus = {
      productsAnalyzed: 0,
      highPerformers: 0,
      blacklistedProducts: 0,
      performanceChange: 0,
      lastUpdated: null as Date | null
    };
    
    try {
      // Use actual tracking data if MLProductPerformance isn't populated yet
      const mlPerformance = await (db as any).mLProductPerformance?.findMany?.({
        where: { shop: session.shop }
      }) ?? [];
      
      if (mlPerformance.length > 0) {
        // Use ML tables if available
        mlStatus.productsAnalyzed = mlPerformance.length;
        mlStatus.highPerformers = mlPerformance.filter((p: any) => p.confidence > 0.7).length;
        mlStatus.blacklistedProducts = mlPerformance.filter((p: any) => p.isBlacklisted).length;
      } else {
        // Fallback to tracking data
        mlStatus.productsAnalyzed = topRecommended.length;
        mlStatus.highPerformers = topRecommended.filter(p => p.ctr > 5).length; // 5% CTR = high performer
      }
      
      // Get latest system health job OR use latest tracking event
      const latestJob = await (db as any).mLSystemHealth?.findFirst?.({
        where: { shop: session.shop },
        orderBy: { completedAt: 'desc' }
      });
      
      if (latestJob?.completedAt) {
        mlStatus.lastUpdated = latestJob.completedAt;
      } else if (topRecommended.length > 0 || recSummary.totalImpressions > 0) {
        // Use most recent tracking event as last updated
        const latestTracking = await (db as any).trackingEvent?.findFirst?.({
          where: { shop: session.shop },
          orderBy: { createdAt: 'desc' }
        });
        if (latestTracking?.createdAt) {
          mlStatus.lastUpdated = latestTracking.createdAt;
        }
      }
      
      // Calculate performance trend from recent CTR data
      if (recCTRSeries.length >= 14) {
        const recentWeek = recCTRSeries.slice(-7);
        const previousWeek = recCTRSeries.slice(-14, -7);
        const recentAvg = recentWeek.reduce((sum, d) => sum + d.ctr, 0) / recentWeek.length;
        const previousAvg = previousWeek.reduce((sum, d) => sum + d.ctr, 0) / previousWeek.length;
        if (previousAvg > 0) {
          mlStatus.performanceChange = ((recentAvg - previousAvg) / previousAvg) * 100;
        }
      }
      
    } catch (error) {
      console.error('Error fetching ML status:', error);
    }

    // Calculate app cost and ROI
    const appCost = 49; // Base cost, can be dynamic based on plan
    const roi = appCost > 0 && attributedRevenue > 0 ? (attributedRevenue / appCost) : 0;
    
    // Determine setup progress for new installs
    const hasRecommendations = recSummary.totalImpressions > 0;
    const hasClicks = recSummary.totalClicks > 0;
    const hasAttributions = attributedOrders > 0;
    
    const setupProgress = !hasRecommendations ? 0 :
                          !hasClicks ? 33 :
                          !hasAttributions ? 66 : 100;

    return json({
      debug: {
        hasOrderAccess,
        ordersDataExists: !!ordersData,
        ordersLength: orders.length,
        timeframe,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        shop: session.shop
      },
      analytics: {
        // Core metrics - CURRENT PERIOD
        totalOrders,
        totalRevenue,
        averageOrderValue,
        checkoutsCompleted: checkoutsCompleted,
        
        // Previous period metrics for REAL comparisons
        previousMetrics: {
          totalOrders: previousMetrics.totalOrders,
          totalRevenue: previousMetrics.totalRevenue,
          averageOrderValue: previousMetrics.averageOrderValue,
          attributedRevenue: previousAttributedRevenue, // ✅ Real data from RecommendationAttribution
          attributedOrders: previousAttributedOrders, // ✅ Real data from RecommendationAttribution
        },
        
        // 🎯 NEW: Attribution metrics (REAL from RecommendationAttribution)
        attributedRevenue,
        attributedOrders,
        appCost,
        roi,
        topAttributedProducts,
        orderUpliftBreakdown, // Order-by-order uplift analysis
        
        // 🧠 NEW: ML System Status (REAL from MLProductPerformance & MLSystemHealth)
        mlStatus,
        
        // Setup progress for new installs
        setupProgress,
        setupComplete: setupProgress === 100,
        
        // Cart-specific metrics (REAL tracking data)
        cartImpressions: cartImpressions,
        cartOpensToday: cartOpensToday,
        cartToCheckoutRate,
        
        // Product performance - REAL DATA
        topProducts,
  topUpsells,
  // NEW: real rec tracking summary
  recImpressions: recSummary.totalImpressions,
  recClicks: recSummary.totalClicks,
  recCTR: recSummary.ctr,
  recCTRSeries,
  topRecommended,
        bundleOpportunities,
        
        // Additional metrics - calculated from real data only
        cartAbandonmentRate: cartToCheckoutRate > 0 ? 100 - cartToCheckoutRate : 0,
        
        // ✅ THRESHOLD ANALYTICS - Always calculated
        freeShippingThreshold,
        ordersWithFreeShipping,
        ordersWithoutFreeShipping,
        avgAOVWithFreeShipping,
        avgAOVWithoutFreeShipping,
        freeShippingConversionRate,
        freeShippingAOVLift,
        freeShippingRevenue,
        avgAmountAddedForFreeShipping,
        
        // ✅ GIFT THRESHOLD ANALYTICS (NEW)
        
        // ✅ GIFT THRESHOLD ANALYTICS - Always calculated
        giftThresholds,
        ordersReachingGifts,
        ordersNotReachingGifts,
        avgAOVWithGift,
        avgAOVWithoutGift,
        giftConversionRate,
        giftAOVLift,
        giftRevenue,
        avgAmountAddedForGift,
        giftThresholdBreakdown,
        
        // Metadata
        timeframe,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isCustomDateRange: !!(customStartDate && customEndDate),
        shopName: shop?.name || session.shop,
        currency: storeCurrency
      },
      shop: session.shop,
      search
    });
  } catch (error) {
    console.error('❌ DASHBOARD LOADER ERROR:', error);
    
    // 🔍 Detailed error categorization
    let errorType = 'UNKNOWN';
    let errorDetails = 'Unknown error';
    
    if (error instanceof Error) {
      errorDetails = error.message;
      
      // Categorize error types
      if (errorDetails.includes('not approved to access') || errorDetails.includes('protected customer data')) {
        errorType = 'PROTECTED_DATA_PERMISSION';
      } else if (errorDetails.includes('Database connection') || errorDetails.includes('PrismaClient')) {
        errorType = 'DATABASE';
      } else if (errorDetails.includes('session') || errorDetails.includes('authenticate')) {
        errorType = 'AUTHENTICATION';
      } else if (errorDetails.includes('GraphQL') || errorDetails.includes('admin.graphql')) {
        errorType = 'SHOPIFY_API';
      } else if (errorDetails.includes('prisma') || errorDetails.includes('query')) {
        errorType = 'DATABASE_QUERY';
      }
    }
    
    console.error('Error classification:', {
      type: errorType,
      message: errorDetails,
      stack: error instanceof Error ? error.stack : undefined,
      shop: session?.shop || 'NO SHOP',
      timeframe,
      timestamp: new Date().toISOString(),
      envCheck: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasShopifyApiKey: !!process.env.SHOPIFY_API_KEY,
        nodeEnv: process.env.NODE_ENV
      }
    });
    
    // Get currency for error fallback
    let fallbackCurrency = 'USD';
    try {
      const shopCurrency = await getShopCurrency(session.shop);
      fallbackCurrency = shopCurrency.code;
    } catch (_e) {
      console.warn('Could not fetch currency in error handler');
    }
    
    return json({
      debug: {
        hasOrderAccess: false,
        ordersDataExists: false,
        ordersLength: 0,
        timeframe: "30d",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        shop: session?.shop || 'unknown',
        errorType,
        errorMessage: errorDetails
      },
      analytics: {
        // Core metrics
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        checkoutsCompleted: 0,
        
        // Previous period metrics (all zero for error case)
        previousMetrics: {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          attributedRevenue: 0,
          attributedOrders: 0,
        },
        
        // ✅ NEW: Attribution metrics (fallback)
        attributedRevenue: 0,
        attributedOrders: 0,
        appCost: 49,
        roi: 0,
        topAttributedProducts: [],
        
        // ✅ NEW: ML system status (fallback)
        mlStatus: {
          productsAnalyzed: 0,
          highPerformers: 0,
          blacklistedProducts: 0,
          performanceChange: 0,
          lastUpdated: null
        },
        
        // Cart-specific metrics
        cartImpressions: 0,
        cartOpensToday: 0,
        cartToCheckoutRate: 0,
        
        // Product performance
        topProducts: [],
  topUpsells: [],
  recImpressions: 0,
  recClicks: 0,
  recCTR: 0,
  recCTRSeries: [],
  topRecommended: [],
        bundleOpportunities: [],
        
        // Additional metrics
        cartAbandonmentRate: 0,
        
        // Free shipping metrics (fallback)
        freeShippingEnabled: false,
        freeShippingThreshold: 100,
        ordersWithFreeShipping: 0,
        ordersWithoutFreeShipping: 0,
        avgAOVWithFreeShipping: 0,
        avgAOVWithoutFreeShipping: 0,
        freeShippingConversionRate: 0,
        freeShippingAOVLift: 0,
        freeShippingRevenue: 0,
        avgAmountAddedForFreeShipping: 0,
        
        // Gift threshold metrics (fallback)
        giftGatingEnabled: false,
        giftThresholds: [],
        ordersReachingGifts: 0,
        ordersNotReachingGifts: 0,
        avgAOVWithGift: 0,
        avgAOVWithoutGift: 0,
        giftConversionRate: 0,
        giftAOVLift: 0,
        giftRevenue: 0,
        avgAmountAddedForGift: 0,
        giftThresholdBreakdown: [],
        
        // ✅ Setup progress (fallback)
        setupProgress: 0,
        setupComplete: false,
        
        // 🔍 ERROR DEBUG INFO
        errorType: errorType,
        errorMessage: errorDetails,
        
        // Metadata
        timeframe: "30d",
        shopName: "demo-shop",
        currency: fallbackCurrency, // Use detected store currency or USD fallback
      },
      shop: 'demo-shop',
      search
    });
  }
};

export default function Dashboard() {
  const { analytics, debug, search } = useLoaderData<typeof loader>();
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showTopPerformersModal, setShowTopPerformersModal] = useState(false);
  const [forceShowDashboard, setForceShowDashboard] = useState(false);
  const [webhookSetupState, setWebhookSetupState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [webhookMessage, setWebhookMessage] = useState('');
  const [selectedOrderProducts, setSelectedOrderProducts] = useState<{orderNumber: string; products: string[]; totalValue: number; attributedValue: number; upliftPercentage: number} | null>(null);
  
  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboard-collapsed-sections");
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    }
    return new Set<string>();
  });
  
  // Toggle section collapsed state
  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboard-collapsed-sections", JSON.stringify(Array.from(newCollapsed)));
    }
  };
  
  // Open product details modal
  const showOrderProducts = (orderNumber: string, products: string[], totalValue: number, attributedValue: number, upliftPercentage: number) => {
    setSelectedOrderProducts({ orderNumber, products, totalValue, attributedValue, upliftPercentage });
  };
  
  // Close product details modal
  const closeProductModal = () => {
    setSelectedOrderProducts(null);
  };
  
  // 🔍 CLIENT-SIDE DEBUG: Log loader data
  useEffect(() => {
    console.log('🔍 CLIENT DEBUG v2: Dashboard loaded with:', {
      debug,
      totalOrders: analytics.totalOrders,
      totalRevenue: analytics.totalRevenue,
      hasTopProducts: analytics.topProducts?.length > 0,
      version: 'webhook-fix-oct14-v2'
    });
  }, [debug, analytics]);
  
  const setupWebhooks = async () => {
    console.log('🔧 Starting webhook setup...');
    setWebhookSetupState('loading');
    setWebhookMessage('');
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const url = `/admin/setup-webhooks?${urlParams.toString()}`;
      console.log('📡 Fetching:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not OK:', response.status, errorText);
        setWebhookSetupState('error');
        setWebhookMessage(`HTTP ${response.status} - Check console`);
        return;
      }
      
      const contentType = response.headers.get('content-type');
      console.log('📦 Content-Type:', contentType);
      
      let result;
      try {
        result = await response.json();
        console.log('✅ Response data:', result);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        const text = await response.text();
        console.error('❌ Response text:', text);
        setWebhookSetupState('error');
        setWebhookMessage('Invalid JSON response - check console');
        return;
      }
      
      if (result.success) {
        setWebhookSetupState('success');
        setWebhookMessage(result.message || 'Webhooks configured successfully');
      } else {
        setWebhookSetupState('error');
        setWebhookMessage(result.error || 'Failed to setup webhooks');
        console.error('Webhook setup failed:', result);
      }
    } catch (error) {
      setWebhookSetupState('error');
      setWebhookMessage('Network error - check console');
      console.error('🚨 Webhook setup error:', error);
    }
  };
  
  // 📥 CSV EXPORT UTILITIES
  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAttributionData = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Attributed Sales', formatCurrency(analytics.attributedRevenue)],
      ['Attributed Orders', analytics.attributedOrders.toString()],
      ['ROI', `${analytics.roi.toFixed(1)}x`],
      ['App Cost', formatCurrency(analytics.appCost)],
      ['Average Order Value', formatCurrency(analytics.attributedOrders > 0 ? analytics.attributedRevenue / analytics.attributedOrders : 0)],
      ['Time Period', analytics.timeframe],
      ['Shop', analytics.shopName]
    ];
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(`attribution-summary-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportTopProducts = () => {
    if (!analytics.topAttributedProducts || analytics.topAttributedProducts.length === 0) return;
    const headers = ['Product', 'Orders', 'Sales', 'Average per Order'];
    const rows = analytics.topAttributedProducts.map((p: any) => [
      `"${p.productTitle || p.productId}"`,
      p.orders,
      analytics.currency + p.revenue.toFixed(2),
      analytics.currency + (p.revenue / p.orders).toFixed(2)
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(`top-products-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportMLStatus = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Products Analyzed', analytics.mlStatus.productsAnalyzed.toString()],
      ['High Performers', analytics.mlStatus.highPerformers.toString()],
      ['Blacklisted Products', analytics.mlStatus.blacklistedProducts.toString()],
      ['Performance Change', `${analytics.mlStatus.performanceChange.toFixed(1)}%`],
      ['Last Updated', analytics.mlStatus.lastUpdated || 'Never'],
      ['Confidence Rate', analytics.mlStatus.productsAnalyzed > 0 
        ? `${((analytics.mlStatus.highPerformers / analytics.mlStatus.productsAnalyzed) * 100).toFixed(0)}%` 
        : '0%']
    ];
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(`ml-status-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportRecommendations = () => {
    if (!analytics.topRecommended || analytics.topRecommended.length === 0) return;
    const headers = ['Product', 'Times Shown', 'Times Clicked', 'Click Rate', 'Sales'];
    const rows = analytics.topRecommended.map((r: any) => [
      `"${r.productTitle || r.productId}"`,
      r.impressions || 0,
      r.clicks || 0,
      `${(r.ctr || 0).toFixed(1)}%`,
      analytics.currency + ((r.revenueCents || 0) / 100).toFixed(2)
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(`recommendations-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const exportFullDashboard = () => {
    const sections = [];
    
    // Attribution Summary
    sections.push('ATTRIBUTION SUMMARY');
    sections.push('Metric,Value');
    sections.push(`Attributed Revenue,${formatCurrency(analytics.attributedRevenue)}`);
    sections.push(`Attributed Orders,${analytics.attributedOrders}`);
    sections.push(`ROI,${analytics.roi.toFixed(1)}x`);
    sections.push(`App Cost,${formatCurrency(analytics.appCost)}`);
    sections.push('');
    
    // Core Metrics
    sections.push('CORE METRICS');
    sections.push('Metric,Value');
    sections.push(`Total Orders,${analytics.totalOrders}`);
    sections.push(`Total Revenue,${formatCurrency(analytics.totalRevenue)}`);
    sections.push(`Average Order Value,${formatCurrency(analytics.averageOrderValue)}`);
    sections.push(`Recommendation Click Rate,${analytics.recCTR.toFixed(1)}%`);
    sections.push('');
    
    // ML Status
    sections.push('ML LEARNING STATUS');
    sections.push('Metric,Value');
    sections.push(`Products Analyzed,${analytics.mlStatus.productsAnalyzed}`);
    sections.push(`High Performers,${analytics.mlStatus.highPerformers}`);
    sections.push(`Performance Change,${analytics.mlStatus.performanceChange.toFixed(1)}%`);
    sections.push('');
    
    // Top Products
    if (analytics.topAttributedProducts && analytics.topAttributedProducts.length > 0) {
      sections.push('TOP SALES GENERATORS');
      sections.push('Product,Orders,Sales,Avg per Order');
      analytics.topAttributedProducts.forEach((p: any) => {
        sections.push(`"${p.productTitle || p.productId}",${p.orders},${analytics.currency}${p.revenue.toFixed(2)},${analytics.currency}${(p.revenue / p.orders).toFixed(2)}`);
      });
      sections.push('');
    }
    
    // Free Shipping Metrics
    if (analytics.freeShippingThreshold > 0) {
      sections.push('FREE SHIPPING METRICS');
      sections.push('Metric,Value');
      sections.push(`Free Shipping Threshold,${formatCurrency(analytics.freeShippingThreshold)}`);
      sections.push(`Achievement Rate,${analytics.freeShippingConversionRate.toFixed(1)}%`);
      sections.push(`Orders With Free Shipping,${analytics.ordersWithFreeShipping}`);
      sections.push(`Orders Without Free Shipping,${analytics.ordersWithoutFreeShipping}`);
      sections.push(`AOV With Free Shipping,${formatCurrency(analytics.avgAOVWithFreeShipping)}`);
      sections.push(`AOV Without Free Shipping,${formatCurrency(analytics.avgAOVWithoutFreeShipping)}`);
      sections.push(`AOV Lift,${analytics.freeShippingAOVLift.toFixed(1)}%`);
      sections.push(`Free Shipping Sales,${formatCurrency(analytics.freeShippingRevenue)}`);
      sections.push('');
    }
    
    // Gift Threshold Metrics
    if (analytics.giftThresholds.length > 0) {
      sections.push('GIFT THRESHOLD METRICS');
      sections.push('Metric,Value');
      sections.push(`Gift Achievement Rate,${analytics.giftConversionRate.toFixed(1)}%`);
      sections.push(`Orders Reaching Gifts,${analytics.ordersReachingGifts}`);
      sections.push(`Orders Not Reaching Gifts,${analytics.ordersNotReachingGifts}`);
      sections.push(`AOV With Gift,${formatCurrency(analytics.avgAOVWithGift)}`);
      sections.push(`AOV Without Gift,${formatCurrency(analytics.avgAOVWithoutGift)}`);
      sections.push(`Gift AOV Lift,${analytics.giftAOVLift.toFixed(1)}%`);
      sections.push(`Gift-Driven Revenue,${formatCurrency(analytics.giftRevenue)}`);
      sections.push('');
      
      // Per-threshold breakdown
      if (analytics.giftThresholdBreakdown.length > 0) {
        sections.push('PER-THRESHOLD BREAKDOWN');
        sections.push('Threshold,Orders Reached,Percent Reached');
        analytics.giftThresholdBreakdown.forEach((t: any) => {
          sections.push(`${formatCurrency(t.threshold)},${t.ordersReached},${t.percentReached.toFixed(1)}%`);
        });
        sections.push('');
      }
    }
    
    const csv = sections.join('\n');
    downloadCSV(`dashboard-full-export-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };
  
  // Top 3 most important metrics by default
  const topMetricIds = ["upsell_revenue", "cart_uplift_impact", "recommendation_conversion"];
  
  // Initialize selectedCards from localStorage or default to top 3
  const [selectedCards, setSelectedCards] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboard-selected-cards");
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    }
    return new Set(topMetricIds);
  });

  // Save to localStorage when selectedCards changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboard-selected-cards", JSON.stringify(Array.from(selectedCards)));
    }
  }, [selectedCards]);

  const settingsHref = `/app/settings${search ?? ""}`;

  const getTimeframeLabel = (timeframe: string) => {
    switch (timeframe) {
      case "today": return "Today";
      case "7d": return "7 days";
      case "30d": return "30 days";
      case "90d": return "90 days";
      case "ytd": return "Year to Date";
      case "all": return "All time";
      default: return "30 days";
    }
  };

  const toggleCardVisibility = (cardId: string) => {
    const newSelectedCards = new Set(selectedCards);
    if (newSelectedCards.has(cardId)) {
      newSelectedCards.delete(cardId);
    } else {
      newSelectedCards.add(cardId);
    }
    setSelectedCards(newSelectedCards);
  };

  // Helper function to format currency dynamically
  const formatCurrency = (amount: number) => {
    const currencySymbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'CAD': 'C$',
      'AUD': 'A$',
      'JPY': '¥',
      'INR': '₹',
      'BRL': 'R$',
      'MXN': '$',
      'SGD': 'S$',
      'HKD': 'HK$',
    }; 
    
    const symbol = currencySymbols[analytics.currency] || analytics.currency + ' ';
    const formattedAmount = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${symbol}${formattedAmount}`;
  };

  // Helper to calculate REAL change percentage between current and previous period
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // ✅ Cart Uplift metrics - ALL WITH REAL COMPARISONS
  // Compares current period vs previous period using actual Shopify data
  // 📊 LOGICALLY ARRANGED: Top Row (Overall Performance) → Middle Row (Engagement & Conversion) → Bottom Row (Order Metrics)
  const allMetrics = [
    // ========================================
    // TOP ROW - OVERALL PERFORMANCE (Big Picture)
    // ========================================
    {
      id: "total_revenue",
      title: "Total Store Sales",
      value: formatCurrency(analytics.totalRevenue),
      previousValue: formatCurrency(analytics.previousMetrics.totalRevenue),
      changePercent: Math.abs(calculateChange(analytics.totalRevenue, analytics.previousMetrics.totalRevenue)),
      changeDirection: analytics.totalRevenue >= analytics.previousMetrics.totalRevenue ? "up" : "down",
      comparison: `vs. ${formatCurrency(analytics.previousMetrics.totalRevenue)} last period`,
      icon: CashDollarIcon,
    },
    {
      id: "upsell_revenue",
      title: "Sales from AI Recommendations",
      value: formatCurrency(analytics.attributedRevenue),
      previousValue: formatCurrency(analytics.previousMetrics.attributedRevenue),
      changePercent: Math.abs(calculateChange(analytics.attributedRevenue, analytics.previousMetrics.attributedRevenue)),
      changeDirection: analytics.attributedRevenue >= analytics.previousMetrics.attributedRevenue ? "up" : "down",
      comparison: `vs. ${formatCurrency(analytics.previousMetrics.attributedRevenue)} last period`,
      icon: CashDollarIcon,
    },
    {
      id: "cart_uplift_impact",
      title: "Sales from Recommendations",
      value: `${analytics.attributedRevenue > 0 && analytics.totalRevenue > 0 ? ((analytics.attributedRevenue / analytics.totalRevenue) * 100).toFixed(1) : "0.0"}%`,
      previousValue: `${analytics.previousMetrics.attributedRevenue > 0 && analytics.previousMetrics.totalRevenue > 0 ? ((analytics.previousMetrics.attributedRevenue / analytics.previousMetrics.totalRevenue) * 100).toFixed(1) : "0.0"}%`,
      changePercent: Math.abs(calculateChange(
        analytics.attributedRevenue / (analytics.totalRevenue || 1),
        analytics.previousMetrics.attributedRevenue / (analytics.previousMetrics.totalRevenue || 1)
      )),
      changeDirection: (analytics.attributedRevenue / (analytics.totalRevenue || 1)) >= (analytics.previousMetrics.attributedRevenue / (analytics.previousMetrics.totalRevenue || 1)) ? "up" : "down",
      comparison: `vs. previous ${getTimeframeLabel(analytics.timeframe).toLowerCase()}`,
      icon: OrderIcon,
    },
    // ========================================
    // MIDDLE ROW - ENGAGEMENT & CONVERSION (Funnel)
    // ========================================
    {
      id: "recommendation_ctr",
      title: "Average Click Rate",
      value: `${analytics.topUpsells.length > 0 ? (analytics.topUpsells.filter((item: any) => item != null).reduce((sum: number, item: any) => sum + parseFloat(item.ctr || "0"), 0) / analytics.topUpsells.filter((item: any) => item != null).length).toFixed(1) : "0.0"}%`,
      previousValue: "N/A",
      changePercent: 0,
      changeDirection: "neutral" as const,
      comparison: `Avg across all recommendations`,
      icon: OrderIcon,
    },
    {
      id: "recommendation_conversion",
      title: "Average Conversion Rate",
      value: `${analytics.topUpsells.length > 0 ? (analytics.topUpsells.filter((item: any) => item != null).reduce((sum: number, item: any) => sum + parseFloat(item.conversionRate || "0"), 0) / analytics.topUpsells.filter((item: any) => item != null).length).toFixed(1) : "0.0"}%`,
      previousValue: "N/A",
      changePercent: 0,
      changeDirection: "neutral" as const,
      comparison: `Avg across all recommendations`,
      icon: OrderIcon,
    },
    {
      id: "cart_conversion",
      title: "Overall Cart Conversion",
      value: `${analytics.cartToCheckoutRate.toFixed(1)}%`,
      previousValue: "N/A",
      changePercent: 0,
      changeDirection: "neutral" as const,
      comparison: "From tracked cart opens",
      icon: OrderIcon,
    },
    // ========================================
    // BOTTOM ROW - ORDER METRICS (Transaction Details)
    // ========================================
    {
      id: "orders_with_upsells",
      title: "Orders with AI Recommendations",
      value: `${analytics.attributedOrders || 0}`,
      previousValue: `0`, // TODO: Calculate previous period attributed orders
      changePercent: 0,
      changeDirection: "neutral" as const,
      comparison: `Real tracked orders`,
      icon: OrderIcon,
    },
    {
      id: "aov",
      title: "Average Order Value",
      value: formatCurrency(analytics.averageOrderValue),
      previousValue: formatCurrency(analytics.previousMetrics.averageOrderValue),
      changePercent: Math.abs(calculateChange(analytics.averageOrderValue, analytics.previousMetrics.averageOrderValue)),
      changeDirection: analytics.averageOrderValue >= analytics.previousMetrics.averageOrderValue ? "up" : "down",
      comparison: `vs. ${formatCurrency(analytics.previousMetrics.averageOrderValue)} last period`,
      icon: CashDollarIcon,
    },
    {
      id: "avg_upsell_value",
      title: "Average Additional Sale Value",
      value: `${analytics.attributedOrders > 0 ? formatCurrency(analytics.attributedRevenue / analytics.attributedOrders) : formatCurrency(0)}`,
      previousValue: `${analytics.previousMetrics.attributedRevenue > 0 && analytics.previousMetrics.attributedOrders > 0 ? formatCurrency(analytics.previousMetrics.attributedRevenue / analytics.previousMetrics.attributedOrders) : "N/A"}`,
      changePercent: analytics.previousMetrics.attributedRevenue > 0 && analytics.previousMetrics.attributedOrders > 0 ? Math.abs(calculateChange(analytics.attributedRevenue / analytics.attributedOrders, analytics.previousMetrics.attributedRevenue / analytics.previousMetrics.attributedOrders)) : 0,
      changeDirection: analytics.attributedOrders > 0 && analytics.previousMetrics.attributedOrders > 0 ? ((analytics.attributedRevenue / analytics.attributedOrders) >= (analytics.previousMetrics.attributedRevenue / analytics.previousMetrics.attributedOrders) ? "up" : "down") : "neutral" as const,
      comparison: `Per order with attributed recommendations`,
      icon: CashDollarIcon,
    },
    // ✅ SIMPLE THRESHOLD METRICS - Always visible
    {
      id: "free_shipping_success_rate", 
      title: "Free Shipping Achievement Rate",
      value: `${analytics.freeShippingConversionRate.toFixed(1)}%`,
      previousValue: "N/A",
      changePercent: 0,
      changeDirection: "neutral" as const,
      comparison: `${analytics.ordersWithFreeShipping} of ${analytics.totalOrders} orders reached threshold`,
      icon: OrderIcon,
    },
    {
      id: "gift_achievement_rate", 
      title: "Gift Achievement Rate",
      value: `${analytics.giftConversionRate.toFixed(1)}%`,
      previousValue: "N/A",
      changePercent: 0,
      changeDirection: "neutral" as const,
      comparison: `${analytics.ordersReachingGifts} of ${analytics.totalOrders} orders reached threshold`,
      icon: OrderIcon,
    },
      {
      comparison: `${analytics.ordersReachingGifts} of ${analytics.totalOrders} orders reached threshold`,
      icon: OrderIcon,
    },
  ];

  // Filter metrics based on user preferences - show only selected cards
  const keyMetrics = allMetrics.filter(metric => metric.id && selectedCards.has(metric.id));

  const upsellTableRows = analytics.topUpsells.map((item: any) => [
    item.product,
    item.impressions.toLocaleString(),
    item.clicks.toLocaleString(),
    `${item.ctr}%`,
    `${item.conversionRate}%`,
    `$${item.revenue}`
  ]);

  const topProductRows = analytics.topProducts.map((item: any) => [
    item.product,
    item.orders.toString(),
    item.quantity.toString(),
    `$${item.revenue.toFixed(2)}`,
    `$${item.avgOrderValue}`
  ]);

  // New: Recommendation CTR over time (date, impressions, clicks, CTR)
  const recCTRRows = (analytics.recCTRSeries || []).map((p: any) => [
    p.date,
    (p.impressions ?? 0).toString(),
    (p.clicks ?? 0).toString(),
    `${(p.ctr ?? 0).toFixed(1)}%`
  ]);

  // New: Top Recommended Items (product, impressions, clicks, CTR, revenue)
  const topRecommendedRows = (analytics.topRecommended || []).map((r: any) => [
    r.productTitle || r.productId,
    (r.impressions ?? 0).toString(),
    (r.clicks ?? 0).toString(),
    `${(r.ctr ?? 0).toFixed(1)}%`,
    formatCurrency((Number(r.revenueCents || 0) / 100))
  ]);

  // Behavioral insights based on REAL store data - Enhanced with 6 key insights
  const getBehavioralInsights = () => {
    const insights = [];
    const maxInsights = 6; // Limit to 6 most important insights
    
    // 1. Cart conversion rate insight
    if (analytics.cartToCheckoutRate < 25) {
      insights.push({
        type: "critical",
        title: "Low Checkout Completion Rate",
        description: `${analytics.cartToCheckoutRate.toFixed(1)}% of cart viewers complete checkout. The average is 35-45%. Improving this could significantly increase your revenue.`,
        action: "Review your checkout process for friction points"
      });
    } else if (analytics.cartToCheckoutRate < 35) {
      insights.push({
        type: "warning", 
        title: "Checkout Rate Below Average",
        description: `${analytics.cartToCheckoutRate.toFixed(1)}% conversion rate is close to average but has room for improvement.`,
        action: "Test simplifying your cart and checkout"
      });
    } else if (analytics.cartToCheckoutRate >= 45) {
      insights.push({
        type: "success",
        title: "Strong Checkout Performance",
        description: `${analytics.cartToCheckoutRate.toFixed(1)}% conversion rate is above average. Your customers complete checkout smoothly.`,
        action: "Focus on increasing average order value"
      });
    }
    
    // 2. Revenue from recommendations (REAL attribution data)
    const attributionPercentage = analytics.totalRevenue > 0 ? (analytics.attributedRevenue / analytics.totalRevenue) * 100 : 0;
    if (analytics.attributedRevenue > 0 && attributionPercentage < 8) {
      insights.push({
        type: "warning",
        title: "More Revenue Available from Recommendations", 
        description: `Recommendations generate ${attributionPercentage.toFixed(1)}% of revenue. Top stores reach 15-25% by showing relevant products at the right time.`,
        action: "Review your recommendation settings"
      });
    } else if (analytics.attributedRevenue === 0 && analytics.totalOrders > 5) {
      insights.push({
        type: "info",
        title: "Start Tracking Recommendation Performance",
        description: `With ${analytics.totalOrders} orders, enable recommendation tracking to measure impact.`,
        action: "Ensure recommendations are enabled in settings"
      });
    } else if (attributionPercentage >= 15) {
      insights.push({
        type: "success",
        title: "Recommendations Performing Well",
        description: `${attributionPercentage.toFixed(1)}% of revenue comes from recommendations. This is excellent performance.`,
        action: "Try recommending higher-value products"
      });
    }
    
    // 3. Average order value optimization
    if (analytics.averageOrderValue > 0) {
      if (analytics.averageOrderValue < 50) {
        insights.push({
          type: "info",
          title: "Opportunity to Increase Order Size",
          description: `Average order of ${formatCurrency(analytics.averageOrderValue)} suggests customers buy one item at a time. Consider using bundles or free shipping incentives.`,
          action: analytics.freeShippingThreshold > 0 ? "Adjust free shipping threshold" : "Try free shipping above a threshold"
        });
      } else if (analytics.averageOrderValue > 150) {
        insights.push({
          type: "success",
          title: "High Average Order Value",
          description: `Average of ${formatCurrency(analytics.averageOrderValue)} indicates premium customers who spend well.`,
          action: "Consider premium product recommendations"
        });
      }
    }
    
    // 4. Free shipping effectiveness
    if (analytics.freeShippingThreshold > 0) {
      if (analytics.freeShippingConversionRate < 15) {
        insights.push({
          type: "warning",
          title: "Few Customers Reach Free Shipping",
          description: `Only ${analytics.freeShippingConversionRate.toFixed(1)}% reach your ${formatCurrency(analytics.freeShippingThreshold)} threshold. Lowering it slightly could increase conversions.`,
          action: "Test a lower free shipping threshold"
        });
      } else if (analytics.freeShippingConversionRate > 70) {
        insights.push({
          type: "attention",
          title: "Most Orders Get Free Shipping", 
          description: `${analytics.freeShippingConversionRate.toFixed(1)}% reach your threshold easily. Raising it could encourage larger orders.`,
          action: "Test a higher free shipping threshold"
        });
      } else if (analytics.freeShippingAOVLift > 25) {
        insights.push({
          type: "success",
          title: "Free Shipping Increasing Order Size",
          description: `Free shipping boosts orders by ${analytics.freeShippingAOVLift.toFixed(1)}%. This is working well for you.`,
          action: "Highlight free shipping more prominently"
        });
      }
    }
    
    // 5. Gift threshold effectiveness (NEW)
    if (analytics.giftThresholds.length > 0) {
      if (analytics.giftConversionRate < 10) {
        insights.push({
          type: "warning",
          title: "Few Customers Earning Gifts",
          description: `Only ${analytics.giftConversionRate.toFixed(1)}% reach your gift threshold. Lowering it could increase engagement and order values.`,
          action: "Review gift threshold in settings"
        });
      } else if (analytics.giftConversionRate > 60) {
        insights.push({
          type: "attention",
          title: "Most Orders Earn Gifts",
          description: `${analytics.giftConversionRate.toFixed(1)}% reach gift threshold. Consider raising it or adding higher tiers for more impact.`,
          action: "Test higher gift thresholds"
        });
      } else if (analytics.giftAOVLift > 20) {
        insights.push({
          type: "success",
          title: "Gifts Driving Larger Orders",
          description: `Gift incentives boost orders by ${analytics.giftAOVLift.toFixed(1)}%. This is encouraging customers to spend more.`,
          action: "Promote gift tiers more prominently"
        });
      }
      
      // Check per-threshold performance
      if (analytics.giftThresholdBreakdown.length > 1) {
        const sortedThresholds = [...analytics.giftThresholdBreakdown]
          .filter((tier): tier is NonNullable<typeof tier> => tier != null)
          .sort((a, b) => a.threshold - b.threshold);
        const gapBetweenTiers = sortedThresholds.some((tier, i) => {
          if (i === 0) return false;
          const prevTier = sortedThresholds[i - 1];
          if (!tier || !prevTier) return false;
          return tier.percentReached < prevTier.percentReached * 0.3; // Big drop-off
        });
        
        if (gapBetweenTiers) {
          insights.push({
            type: "info",
            title: "Gift Tier Gap Detected",
            description: "There's a big drop between gift tiers. Consider adjusting thresholds to create smoother progression.",
            action: "Review gift tier spacing"
          });
        }
      }
    }
    
    // 6. Mobile and timing insights
    const currentHour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());
    const currentMonth = new Date().getMonth();
    const isHolidaySeason = [10, 11].includes(currentMonth); // Nov, Dec
    
    if (analytics.cartToCheckoutRate < 30 && (currentHour >= 18 || isWeekend)) {
      insights.push({
        type: "info",
        title: "Check Mobile Experience",
        description: `Conversion is lower during ${isWeekend ? 'weekend' : 'evening'} hours when mobile shopping peaks. Make sure your cart works well on phones.`,
        action: "Test your cart on mobile devices"
      });
    }
    
    if (isHolidaySeason && analytics.averageOrderValue < 75) {
      insights.push({
        type: "attention",
        title: "Holiday Shopping Season",
        description: `Shoppers typically spend 40% more during holidays. Consider featuring gift bundles and seasonal products.`,
        action: "Create holiday product bundles"
      });
    }
    
    // 6. Product diversity in orders - check if recommendations are increasing basket size
    if (analytics.attributedOrders > 0 && analytics.totalOrders > 10) {
      const ordersWithRecommendations = analytics.attributedOrders;
      const percentageWithRecommendations = (ordersWithRecommendations / analytics.totalOrders) * 100;
      
      if (percentageWithRecommendations < 20) {
        insights.push({
          type: "info",
          title: "Recommendations Could Increase Basket Size",
          description: `Only ${percentageWithRecommendations.toFixed(1)}% of orders include recommended products. More visibility could increase multi-product orders.`,
          action: "Review recommendation placement and visibility"
        });
      }
    }
    
    // 7. Early stage guidance
    if (analytics.totalOrders < 10 && analytics.timeframe === "30d") {
      insights.push({
        type: "info",
        title: "Getting Started",
        description: `With ${analytics.totalOrders} orders in 30 days, insights will improve as your store grows. Focus on getting more traffic and conversions.`,
        action: "Keep monitoring as sales increase"
      });
    }
    
    // 8. ROI Performance insight (attribution-specific)
    if (analytics.attributedRevenue > 0 && analytics.roi > 0) {
      if (analytics.roi > 20) {
        insights.push({
          type: "success",
          title: "Outstanding ROI",
          description: `Your AI recommendations generate ${analytics.roi.toFixed(1)}x return on investment. Every £1 spent on this app generates £${analytics.roi.toFixed(1)} in revenue.`,
          action: "Keep your AI learning enabled"
        });
      } else if (analytics.roi < 5 && analytics.attributedOrders > 10) {
        insights.push({
          type: "warning",
          title: "ROI Below Target",
          description: `Current ROI is ${analytics.roi.toFixed(1)}x with ${analytics.attributedOrders} attributed orders. Performance should improve as the AI continues learning.`,
          action: "Review recommendation settings"
        });
      } else if (analytics.roi >= 5 && analytics.roi <= 20) {
        insights.push({
          type: "success",
          title: "Solid ROI Performance",
          description: `${analytics.roi.toFixed(1)}x return means recommendations are profitable. The AI will continue optimizing for better results.`,
          action: "Monitor performance trends"
        });
      }
    }
    
    // 9. ML Learning Progress insight
    if (analytics.mlStatus.performanceChange > 10) {
      insights.push({
        type: "success",
        title: "AI Performance Improving",
        description: `Recommendation performance up ${analytics.mlStatus.performanceChange.toFixed(0)}% vs. last week. Your AI is learning which products convert best.`,
        action: "Keep the AI enabled for continued improvement"
      });
    } else if (analytics.mlStatus.performanceChange < -10 && analytics.mlStatus.productsAnalyzed > 20) {
      insights.push({
        type: "info",
        title: "Performance Fluctuation Detected",
        description: `Performance is ${Math.abs(analytics.mlStatus.performanceChange).toFixed(0)}% lower this week. This can be normal as the AI tests different recommendations.`,
        action: "Give it time to optimize"
      });
    }

    // Default insight
    if (insights.length === 0) {
      insights.push({
        type: "success",
        title: "Overall Performance Looks Good",
        description: "Your cart metrics are healthy. Keep testing new features to continue improving.",
        action: "Experiment with advanced settings"
      });
    }
    
    // Return only the most important insights (limit to 6)
    return insights.slice(0, maxInsights);
  };

  const behavioralInsights = getBehavioralInsights();

  // 🚀 SETUP PROGRESS CHECK - Show onboarding for new installs
  if (analytics.setupProgress < 100 && !forceShowDashboard) {
    return (
      <Page>
        <TitleBar title="🚀 Getting Started" />
        <BlockStack gap="500">
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <Text variant="headingLg" as="h2">
                  Your AI is Getting Ready
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Setting up recommendations for your store
                </Text>
              </BlockStack>
              
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="400">
                  <ProgressBar 
                    progress={analytics.setupProgress} 
                    size="small"
                    tone="success"
                  />
                  
                  <BlockStack gap="300">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span">{analytics.recImpressions > 0 ? '✅' : '⏳'}</Text>
                      <Text variant="bodyMd" as="p">
                        Recommendations showing on your store
                      </Text>
                    </InlineStack>
                    
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span">{analytics.recClicks > 0 ? '✅' : '⏳'}</Text>
                      <Text variant="bodyMd" as="p">
                        Customers clicking recommendations (usually within 24 hours)
                      </Text>
                    </InlineStack>
                    
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span">{analytics.attributedOrders > 0 ? '✅' : '⏳'}</Text>
                      <Text variant="bodyMd" as="p">
                        Revenue tracking starts with next order from recommendations
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Box>
              
              <Banner tone="info">
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    Your dashboard will activate as soon as customers interact with recommendations.
                  </Text>
                  <Text variant="bodyMd" as="p">
                    The AI learns from {analytics.totalOrders > 0 ? `${analytics.totalOrders} historic orders and ` : ''}each new sale to improve recommendations over time.
                  </Text>
                </BlockStack>
              </Banner>
              
              {analytics.totalOrders > 0 && (
                <Box padding="400" background="bg-surface-success" borderRadius="200">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Great start! Your store has {analytics.totalOrders} orders
                    </Text>
                    <Text variant="bodySm" as="p">
                      The more orders you have, the better the AI recommendations become.
                    </Text>
                  </BlockStack>
                </Box>
              )}
            </BlockStack>
          </Card>
          
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">While you wait...</Text>
              <Text variant="bodyMd" as="p">
                Customize your recommendation settings to match your brand
              </Text>
              <InlineStack gap="300">
                <a href={settingsHref} className="no-underline">
                  <Button variant="primary">Configure Settings</Button>
                </a>
                <Button onClick={() => setForceShowDashboard(true)}>
                  View Dashboard Anyway
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    );
  }

  // 📊 FULL DASHBOARD - Only shows when setup is complete (setupProgress = 100)
  return (
    <Page>
      <TitleBar title="📊 Analytics & Performance Dashboard" />
      
      {/* ML TRAINING STATUS */}
      {analytics.totalOrders > 0 && analytics.attributedOrders === 0 && (
        <Banner tone="info">
          <BlockStack gap="200">
            <Text variant="bodyMd" as="p" fontWeight="semibold">
              🤖 ML Model Training on {analytics.totalOrders} Historic Orders
            </Text>
            <Text variant="bodyMd" as="p">
              Your store has {analytics.totalOrders} orders from the last 60 days. The AI is using this data to learn product relationships and build personalized recommendations.
            </Text>
            <Text variant="bodySm" as="p" tone="subdued">
              Revenue tracking will start as soon as customers purchase recommended products.
            </Text>
            <InlineStack gap="300">
              <Button 
                variant="primary" 
                onClick={setupWebhooks}
                loading={webhookSetupState === 'loading'}
              >
                Setup Revenue Tracking
              </Button>
              {webhookSetupState === 'success' && (
                <Text as="span" tone="success">✓ {webhookMessage}</Text>
              )}
              {webhookSetupState === 'error' && (
                <Text as="span" tone="critical">✗ {webhookMessage}</Text>
              )}
            </InlineStack>
          </BlockStack>
        </Banner>
      )}
      
      {/* Local utility styles to replace inline styles in this route */}
      <style>
        {`
          .cu-flex { display: flex; }
          .cu-items-center { align-items: center; }
          .cu-gap-16 { gap: 16px; }
          .cu-gap-8 { gap: 8px; }
          .cu-p-12 { padding: 12px; }
          .cu-p-20 { padding: 20px; }
          .cu-text-center { text-align: center; }
          .cu-bg-card { background: #f8f9fa; }
          .cu-rounded-8 { border-radius: 8px; }
          .cu-rounded-4 { border-radius: 4px; }
          .cu-border { border: 1px solid #e1e3e5; }
          .cu-min-w-120 { min-width: 120px; }
          .cu-w-30 { width: 30px; }
          .cu-h-30 { height: 30px; }
          .cu-grad-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .cu-center { display: flex; align-items: center; justify-content: center; }
          .cu-text-white { color: white; }
          .cu-text-gray-666 { color: #666; }
          .cu-fw-600 { font-weight: 600; }
          .cu-text-12 { font-size: 12px; }
          .cu-flex-1 { flex: 1; }
          .cu-divider-vertical { border-left: 1px solid var(--p-color-border); height: 24px; }
          .clickable-card { cursor: pointer; transition: opacity 0.2s; }
          .clickable-card:hover { opacity: 0.8; }
          .no-underline { text-decoration: none; }
          .collapsible-header { cursor: pointer; }
          
          /* Consistent metric card heights */
          .metric-card-wrapper {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          .metric-card-content {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
        `}
      </style>
      <BlockStack gap="500">
        
        {/* Header with Time Filter */}
        <Card>
          <InlineStack gap="300" align="space-between" wrap={false}>
            <BlockStack gap="200">
              <Text as="h1" variant="headingLg">
                {analytics.shopName}
              </Text>
              <InlineStack gap="200">
                <Badge>{getTimeframeLabel(analytics.timeframe)}</Badge>
                {analytics.totalOrders > 0 && (
                  <>
                    <Badge tone="info">{`${analytics.totalOrders.toLocaleString()} orders`}</Badge>
                    <Badge tone="success">{formatCurrency(analytics.totalRevenue)}</Badge>
                  </>
                )}
              </InlineStack>
            </BlockStack>
            <InlineStack gap="300" blockAlign="center">
              <Button variant="plain" onClick={exportFullDashboard}>
                Export All Data
              </Button>
              <Select
                label=""
                options={[
                  { label: 'Today', value: 'today' },
                  { label: 'Last 7 days', value: '7d' },
                  { label: 'Last 30 days', value: '30d' },
                  { label: 'Last 90 days', value: '90d' },
                  { label: 'Year to date', value: 'ytd' },
                  { label: 'All time', value: 'all' },
                ]}
                value={analytics.timeframe}
                onChange={(value) => {
                  const params = new URLSearchParams(window.location.search);
                  params.set('timeframe', value);
                  // Preserve embedded app routing params like host/shop while switching filters
                  window.location.href = `${window.location.pathname}?${params.toString()}`;
                }}
              />
            </InlineStack>
          </InlineStack>
        </Card>
        
        {/* 🌟 HERO ROI CARD - Primary revenue impact showcase */}
        <Card>
          <BlockStack gap="500">
            <InlineStack align="space-between" blockAlign="start">
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Revenue from AI Recommendations
                  </Text>
                  <Button variant="plain" size="micro" onClick={exportAttributionData}>
                    Export
                  </Button>
                </InlineStack>
                <Text as="h1" variant="heading3xl" fontWeight="bold">
                  {formatCurrency(analytics.attributedRevenue || 0)}
                </Text>
              </BlockStack>
              
              <InlineStack gap="300" blockAlign="center">
                {analytics.roi > 0 && (
                  <Badge tone="success" size="large">
                    {`${analytics.roi.toFixed(1)}x ROI`}
                  </Badge>
                )}
                <Badge tone="info" size="large">
                  {`${formatCurrency(analytics.appCost)} app cost`}
                </Badge>
              </InlineStack>
            </InlineStack>
            
            <InlineStack gap="500" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={OrderIcon} tone="success" />
                <Text as="p" variant="bodyLg" fontWeight="semibold">
                  {analytics.attributedOrders || 0} orders
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  with AI recommendations
                </Text>
              </InlineStack>
              
              {analytics.attributedOrders > 0 && (
                <>
                  <Box paddingInlineStart="300" paddingInlineEnd="300">
                    <div className="cu-divider-vertical" />
                  </Box>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Average order value: {formatCurrency((analytics.attributedRevenue / analytics.attributedOrders) || 0)}
                  </Text>
                </>
              )}
            </InlineStack>
            
            {analytics.attributedRevenue === 0 && (
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  💡 Revenue tracking starts once customers purchase recommended products. Keep your AI learning enabled to see results.
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
        
        {/* �💡 QUICK WIN BANNER - Show best opportunity right now */}
        {analytics.freeShippingThreshold > 0 && analytics.freeShippingConversionRate < 15 && analytics.freeShippingConversionRate > 0 && (
          <Card>
            <Box padding="400" background="bg-surface-caution" borderRadius="200">
              <InlineStack gap="400" align="space-between" blockAlign="center" wrap={false}>
                <BlockStack gap="200">
                  <Text as="p" variant="headingMd" fontWeight="semibold">
                    💡 Free Shipping Threshold Opportunity
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Only {analytics.freeShippingConversionRate.toFixed(0)}% of customers reach your {formatCurrency(analytics.freeShippingThreshold)} free shipping threshold. 
                    {analytics.ordersWithoutFreeShipping} orders averaged {formatCurrency(analytics.avgAOVWithoutFreeShipping)} - consider testing a lower threshold.
                  </Text>
                </BlockStack>
                <a href={settingsHref} className="no-underline">
                  <Button variant="primary">Adjust Threshold</Button>
                </a>
              </InlineStack>
            </Box>
          </Card>
        )}
        
        {/* 🎯 CORE METRICS - 3 Key Performance Indicators */}
        <Grid>
          {/* 1. Orders with Recommendations */}
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
            <Card>
              <BlockStack gap="400">
                <Text as="p" variant="bodySm" tone="subdued">
                  Orders with Recommendations
                </Text>
                <Text as="h2" variant="headingXl" fontWeight="bold">
                  {analytics.attributedOrders || 0}
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {analytics.totalOrders > 0 
                    ? `${((analytics.attributedOrders / analytics.totalOrders) * 100).toFixed(1)}% of all orders`
                    : 'Start getting recommendations shown'}
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          
          {/* 2. Recommendation Success Rate */}
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
            <Card>
              <BlockStack gap="400">
                <Text as="p" variant="bodySm" tone="subdued">
                  Recommendation Success Rate
                </Text>
                <Text as="h2" variant="headingXl" fontWeight="bold">
                  {analytics.recClicks > 0 && analytics.attributedOrders > 0
                    ? `${((analytics.attributedOrders / analytics.recClicks) * 100).toFixed(1)}%`
                    : '0%'}
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {analytics.recClicks > 0
                    ? `${analytics.attributedOrders} purchases from ${analytics.recClicks} clicks`
                    : 'Customers haven\'t clicked recommendations yet'}
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          
          {/* 3. Click-Through Rate */}
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
            <Card>
              <BlockStack gap="400">
                <Text as="p" variant="bodySm" tone="subdued">
                  Click Rate
                </Text>
                <Text as="h2" variant="headingXl" fontWeight="bold">
                  {analytics.recCTR > 0 ? `${analytics.recCTR.toFixed(1)}%` : '0%'}
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {analytics.recImpressions > 0
                    ? `${analytics.recClicks} clicks from ${analytics.recImpressions} views`
                    : 'No recommendations shown yet'}
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>
        
        {/* 🤖 ML LEARNING STATUS - Show AI is actively improving */}
        <Card>
          <BlockStack gap="500">
            <InlineStack align="space-between" blockAlign="start">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  🤖 Recommendation Intelligence
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Your AI learns from customer behavior to show better product suggestions
                </Text>
              </BlockStack>
              <Button variant="plain" size="micro" onClick={exportMLStatus}>
                Export
              </Button>
            </InlineStack>
            
            <Grid>
              <Grid.Cell columnSpan={{xs: 6, sm: 3, md: 3, lg: 3, xl: 3}}>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Products Being Recommended
                  </Text>
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {analytics.mlStatus.productsAnalyzed || 0}
                  </Text>
                  <Text as="p" variant="bodyXs" tone="subdued">
                    items in rotation
                  </Text>
                </BlockStack>
              </Grid.Cell>
              
              <Grid.Cell columnSpan={{xs: 6, sm: 3, md: 3, lg: 3, xl: 3}}>
                <div 
                  onClick={() => setShowTopPerformersModal(true)}
                  className="clickable-card"
                >
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Top Performers
                    </Text>
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="p" variant="headingLg" fontWeight="bold">
                        {analytics.mlStatus.highPerformers || 0}
                      </Text>
                      <Text as="p" variant="bodySm" tone="magic">
                        👁️ View
                      </Text>
                    </InlineStack>
                    <Text as="p" variant="bodyXs" tone="success">
                      getting lots of clicks
                    </Text>
                  </BlockStack>
                </div>
              </Grid.Cell>
              
              <Grid.Cell columnSpan={{xs: 6, sm: 3, md: 3, lg: 3, xl: 3}}>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    AI Status
                  </Text>
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {analytics.mlStatus.performanceChange > 5 ? '📈 Learning' : 
                     analytics.mlStatus.performanceChange < -5 ? '📉 Adjusting' : 
                     '✅ Active'}
                  </Text>
                  <Text as="p" variant="bodyXs" tone="subdued">
                    {analytics.mlStatus.performanceChange > 5 ? 'improving with data' : 
                     analytics.mlStatus.performanceChange < -5 ? 'testing new combos' : 
                     'running smoothly'}
                  </Text>
                </BlockStack>
              </Grid.Cell>
              
              <Grid.Cell columnSpan={{xs: 6, sm: 3, md: 3, lg: 3, xl: 3}}>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Last Updated
                  </Text>
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {analytics.mlStatus.lastUpdated 
                      ? new Date(analytics.mlStatus.lastUpdated).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })
                      : 'Never'}
                  </Text>
                  <Text as="p" variant="bodyXs" tone="subdued">
                    {analytics.mlStatus.lastUpdated
                      ? new Date(analytics.mlStatus.lastUpdated).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })
                      : 'Waiting for data'}
                  </Text>
                </BlockStack>
              </Grid.Cell>
            </Grid>
            
            <Box padding="400" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  💡 How This Works
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  The AI tracks which products customers click on and buy. <strong>Products Being Recommended</strong> shows how many different items are in your recommendation pool. <strong>Top Performers</strong> are products with high click rates (above 5%). The AI automatically shows high performers more often and tests new combinations to maximize sales.
                </Text>
              </BlockStack>
            </Box>
            
            {analytics.mlStatus.blacklistedProducts > 0 && (
              <Box padding="400" background="bg-surface-caution" borderRadius="200">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="bodySm" fontWeight="semibold">
                    ⚠️ {analytics.mlStatus.blacklistedProducts} products paused
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    — These had low engagement, so the AI stopped recommending them
                  </Text>
                </InlineStack>
              </Box>
            )}
            
            {analytics.mlStatus.productsAnalyzed === 0 && (
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  💡 Your AI will start learning once customers interact with recommendations. The more clicks and purchases, the smarter it gets!
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
        
        {/* 💰 TOP ATTRIBUTED PRODUCTS - Show what's making money */}
        {analytics.topAttributedProducts && analytics.topAttributedProducts.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <div 
                onClick={() => toggleSection('top-sales-generators')}
                className="collapsible-header"
              >
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Top Sales Generators
                    </Text>
                    <Button 
                      icon={collapsedSections.has('top-sales-generators') ? ChevronDownIcon : ChevronUpIcon}
                      variant="plain"
                      size="micro"
                      onClick={() => toggleSection('top-sales-generators')}
                    />
                  </InlineStack>
                  {!collapsedSections.has('top-sales-generators') && (
                    <Button variant="plain" size="micro" onClick={() => exportTopProducts()}>
                      Export
                    </Button>
                  )}
                </InlineStack>
              </div>
              
              {!collapsedSections.has('top-sales-generators') && (
                <>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Products that made the most money from AI recommendations
                  </Text>
                  
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                    headings={['Product', 'Orders', 'Sales', 'Avg per Order']}
                    rows={analytics.topAttributedProducts.map((product: any) => [
                      product.productTitle || `Product ${product.productId}`,
                      product.orders.toString(),
                      formatCurrency(product.revenue),
                      formatCurrency(product.revenue / product.orders)
                    ])}
                  />
              
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" variant="bodyXs" tone="subdued">
                      💡 These products converted well when recommended by AI. Consider featuring them more prominently.
                    </Text>
                  </Box>
                </>
              )}
            </BlockStack>
          </Card>
        )}
        
        {/* 📊 ORDER UPLIFT BREAKDOWN - Show impact per order */}
        {(analytics as any).orderUpliftBreakdown && (analytics as any).orderUpliftBreakdown.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <div 
                onClick={() => toggleSection('biggest-wins')}
                className="collapsible-header"
              >
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      💰 Biggest Wins from Recommendations
                    </Text>
                    <Button 
                      icon={collapsedSections.has('biggest-wins') ? ChevronDownIcon : ChevronUpIcon}
                      variant="plain"
                      size="micro"
                      onClick={() => toggleSection('biggest-wins')}
                    />
                  </InlineStack>
                </InlineStack>
              </div>
              
              {!collapsedSections.has('biggest-wins') && (
                <>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Orders where recommendations had the biggest impact
                  </Text>
              
              {/* Cleaner table with modal for product details */}
              <BlockStack gap="0">
                {/* Table Header */}
                <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                  <InlineStack gap="200" align="start" blockAlign="center" wrap={false}>
                    <Box width="14%">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">Order</Text>
                    </Box>
                    <Box width="10%">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">Items</Text>
                    </Box>
                    <Box width="26%">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">Customer Spent</Text>
                    </Box>
                    <Box width="26%">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">Added from AI</Text>
                    </Box>
                    <Box width="24%">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">AI Impact</Text>
                    </Box>
                  </InlineStack>
                </Box>
                
                {/* Table Rows */}
                {(analytics as any).orderUpliftBreakdown.map((order: any, index: number) => (
                  <Box key={order.orderNumber}>
                    {index > 0 && <Divider />}
                    
                    {/* Main Row */}
                    <Box padding="300">
                      <InlineStack gap="200" align="start" blockAlign="center" wrap={false}>
                        <Box width="14%">
                          <Text as="span" variant="bodyMd" fontWeight="medium">
                            #{order.orderNumber}
                          </Text>
                        </Box>
                        <Box width="10%">
                          <Button
                            variant="plain"
                            size="slim"
                            onClick={() => showOrderProducts(order.orderNumber, order.products, order.totalValue, order.attributedValue, order.upliftPercentage)}
                          >
                            {order.productCount}
                          </Button>
                        </Box>
                        <Box width="26%">
                          <Text as="span" variant="bodyMd">
                            {formatCurrency(order.totalValue)}
                          </Text>
                        </Box>
                        <Box width="26%">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {formatCurrency(order.attributedValue)}
                          </Text>
                        </Box>
                        <Box width="24%">
                          <Badge tone={order.upliftPercentage >= 50 ? "success" : order.upliftPercentage >= 30 ? "attention" : "info"}>
                            {`${order.upliftPercentage.toFixed(0)}%`}
                          </Badge>
                        </Box>
                      </InlineStack>
                    </Box>
                  </Box>
                ))}
              </BlockStack>
                </>
              )}
            </BlockStack>
          </Card>
        )}
        
        {/* Product Details Modal - Simple List Only */}
        {selectedOrderProducts && (
          <Modal
            open={true}
            onClose={closeProductModal}
            title={`Order #${selectedOrderProducts.orderNumber} - Products from AI`}
            primaryAction={{
              content: 'Close',
              onAction: closeProductModal,
            }}
          >
            <Modal.Section>
              <BlockStack gap="300">
                {/* Product List Only */}
                <BlockStack gap="200">
                  {selectedOrderProducts.products.map((product: string, idx: number) => (
                    <InlineStack key={idx} gap="200" blockAlign="center">
                      <Box 
                        padding="200" 
                        background="bg-surface-success-hover" 
                        borderRadius="100"
                        minWidth="24px"
                      >
                        <Text as="span" variant="bodySm" fontWeight="semibold" alignment="center">
                          {idx + 1}
                        </Text>
                      </Box>
                      <Text as="span" variant="bodyMd">{product}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
        
        {/* Key Metrics Grid with Comparison */}
        <Card>
          <BlockStack gap="300">
            <div 
              onClick={() => toggleSection('dashboard-metrics')}
              className="collapsible-header"
            >
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingMd">Dashboard Metrics</Text>
                  <Button 
                    icon={collapsedSections.has('dashboard-metrics') ? ChevronDownIcon : ChevronUpIcon}
                    variant="plain"
                    size="micro"
                    onClick={() => toggleSection('dashboard-metrics')}
                  />
                </InlineStack>
                {!collapsedSections.has('dashboard-metrics') && (
                  <Button variant="tertiary" size="slim" onClick={() => setShowCustomizeModal(true)}>
                    Customize Cards
                  </Button>
                )}
              </InlineStack>
            </div>
            {!collapsedSections.has('dashboard-metrics') && (
              <>
                <Text as="p" variant="bodySm" tone="subdued">
                  Showing {keyMetrics.length} of {allMetrics.length} available metrics
                </Text>
              </>
            )}
          </BlockStack>
        </Card>
        
        {!collapsedSections.has('dashboard-metrics') && (
          <Grid>
          {keyMetrics.map((metric, index) => (
            <Grid.Cell key={index} columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
              <div className="metric-card-wrapper">
                <Card padding="400">
                  <div className="metric-card-content">
                    <BlockStack gap="300">
                      <InlineStack gap="300" align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingSm" tone="subdued">
                          {metric.title}
                        </Text>
                        <Box
                          padding="300"
                          background="bg-surface"
                          borderRadius="200"
                        >
                          <Icon source={metric.icon} tone="subdued" />
                        </Box>
                      </InlineStack>
                      
                      <BlockStack gap="200">
                        <Text as="p" variant="heading2xl" fontWeight="bold">
                          {metric.value}
                        </Text>
                        
                        {metric.changePercent !== undefined && metric.comparison && (
                          <InlineStack gap="200" align="start" blockAlign="center">
                            <Badge
                              tone={metric.changeDirection === "up" ? "success" : metric.changeDirection === "down" ? "critical" : "info"}
                              size="medium"
                            >
                              {`${metric.changeDirection === "up" ? "↗" : metric.changeDirection === "down" ? "↘" : "→"} ${metric.changePercent.toFixed(1)}%`}
                            </Badge>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {metric.comparison}
                            </Text>
                          </InlineStack>
                        )}
                        
                        {(metric as any).description && !metric.comparison && (
                          <Text as="p" variant="bodySm" tone="subdued">
                            {(metric as any).description}
                          </Text>
                        )}
                      </BlockStack>
                    </BlockStack>
                  </div>
                </Card>
              </div>
            </Grid.Cell>
          ))}
        </Grid>
        )}

        {/* Smart Insights Section */}
        <Card>
          <BlockStack gap="400">
            <div 
              onClick={() => toggleSection('smart-insights')}
              className="collapsible-header"
            >
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  💡 Smart Insights
                </Text>
                <Button 
                  icon={collapsedSections.has('smart-insights') ? ChevronDownIcon : ChevronUpIcon}
                  variant="plain"
                  size="micro"
                  onClick={() => toggleSection('smart-insights')}
                />
              </InlineStack>
            </div>
            {!collapsedSections.has('smart-insights') && (
              <Grid>
              {behavioralInsights.map((insight, index) => (
                <Grid.Cell key={index} columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                  <Card padding="400">
                    <BlockStack gap="200">
                      <InlineStack gap="200" align="space-between">
                        <Text as="p" variant="bodyLg" fontWeight="semibold">
                          {insight.title}
                        </Text>
                        <Badge tone={insight.type === "critical" ? "critical" : 
                                    insight.type === "warning" ? "warning" :
                                    insight.type === "info" ? "info" :
                                    insight.type === "attention" ? "attention" : "success"}>
                          {insight.type === "critical" ? "Action Needed" : 
                           insight.type === "warning" ? "Opportunity" :
                           insight.type === "info" ? "Suggestion" :
                           insight.type === "attention" ? "Monitor" : "Great!"}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd">
                        {insight.description}
                      </Text>
                      <InlineStack gap="200" align="space-between">
                        <Text as="span" variant="bodySm" fontWeight="semibold" tone="subdued">
                          Recommended action:
                        </Text>
                        {insight.action.includes("Enable") || insight.action.includes("settings") || insight.action.includes("threshold") ? (
                          <a href={settingsHref} className="no-underline">
                            <Button variant="plain" size="micro">
                              {insight.action} →
                            </Button>
                          </a>
                        ) : (
                          <Text as="span" variant="bodySm" tone="subdued">
                            {insight.action}
                          </Text>
                        )}
                      </InlineStack>
                    </BlockStack>
                  </Card>
                </Grid.Cell>
              ))}
            </Grid>
            )}
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              
              {/* Product Performance Tables */}
              <Card>
                <BlockStack gap="400">
                  <div 
                    onClick={() => toggleSection('top-performing-products')}
                    className="collapsible-header"
                  >
                    <InlineStack gap="200" blockAlign="center" align="space-between">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          🏆 Top Performing Products
                        </Text>
                        <Button 
                          icon={collapsedSections.has('top-performing-products') ? ChevronDownIcon : ChevronUpIcon}
                          variant="plain"
                          size="micro"
                          onClick={() => toggleSection('top-performing-products')}
                        />
                      </InlineStack>
                      {!collapsedSections.has('top-performing-products') && (
                        <Badge tone="success">Sales Data</Badge>
                      )}
                    </InlineStack>
                  </div>
                  
                  {!collapsedSections.has('top-performing-products') && (
                    <DataTable
                      columnContentTypes={[
                        'text',
                        'numeric',
                        'numeric', 
                        'numeric',
                        'numeric',
                      ]}
                      headings={[
                        'Product',
                        'Orders',
                        'Quantity Sold',
                        'Revenue',
                        'Avg Order Value'
                      ]}
                      rows={topProductRows}
                    />
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <div 
                    onClick={() => toggleSection('upsell-performance')}
                    className="collapsible-header"
                  >
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        🎯 Upsell Performance Analytics
                      </Text>
                      <Button 
                        icon={collapsedSections.has('upsell-performance') ? ChevronDownIcon : ChevronUpIcon}
                        variant="plain"
                        size="micro"
                        onClick={() => toggleSection('upsell-performance')}
                      />
                    </InlineStack>
                  </div>
                  
                  {!collapsedSections.has('upsell-performance') && (
                    <DataTable
                      columnContentTypes={[
                        'text',
                        'numeric',
                        'numeric', 
                        'numeric',
                        'numeric',
                        'numeric',
                      ]}
                      headings={[
                        'Product',
                        'Impressions',
                        'Clicks',
                        'Click Rate',
                        'Purchased',
                        'Revenue'
                      ]}
                      rows={upsellTableRows}
                    />
                  )}
                </BlockStack>
              </Card>

              {/* Recommendation CTR trend */}
              <Card>
                <BlockStack gap="400">
                  <div 
                    onClick={() => toggleSection('performance-over-time')}
                    className="collapsible-header"
                  >
                    <InlineStack gap="200" blockAlign="center" align="space-between">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">📈 Recommendation Performance Over Time</Text>
                        <Button 
                          icon={collapsedSections.has('performance-over-time') ? ChevronDownIcon : ChevronUpIcon}
                          variant="plain"
                          size="micro"
                          onClick={() => toggleSection('performance-over-time')}
                        />
                      </InlineStack>
                      {!collapsedSections.has('performance-over-time') && (
                        <Badge tone="attention">Daily trend</Badge>
                      )}
                    </InlineStack>
                  </div>
                  {!collapsedSections.has('performance-over-time') && (
                    <DataTable
                      columnContentTypes={[ 'text', 'numeric', 'numeric', 'numeric' ]}
                      headings={[ 'Date', 'Shown', 'Clicked', 'Click Rate' ]}
                      rows={recCTRRows}
                    />
                  )}
                </BlockStack>
              </Card>

              {/* Top recommended items */}
              <Card>
                <BlockStack gap="400">
                  <div 
                    onClick={() => toggleSection('popular-recommendations')}
                    className="collapsible-header"
                  >
                    <InlineStack gap="200" blockAlign="center" align="space-between">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">🔝 Most Popular Recommendations</Text>
                        <Button 
                          icon={collapsedSections.has('popular-recommendations') ? ChevronDownIcon : ChevronUpIcon}
                          variant="plain"
                          size="micro"
                          onClick={() => toggleSection('popular-recommendations')}
                        />
                      </InlineStack>
                      {!collapsedSections.has('popular-recommendations') && (
                        <>
                          <Button variant="plain" size="micro" onClick={() => exportRecommendations()}>
                            Export
                          </Button>
                          <Badge tone="success">By customer interest</Badge>
                        </>
                      )}
                    </InlineStack>
                  </div>
                  {!collapsedSections.has('popular-recommendations') && (
                    <DataTable
                      columnContentTypes={[ 'text', 'numeric', 'numeric', 'numeric', 'numeric' ]}
                      headings={[ 'Product', 'Shown', 'Clicked', 'Click Rate', 'Revenue' ]}
                      rows={topRecommendedRows}
                    />
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* Smart Bundle Opportunities - Full Width Row */}
        <Card>
          <BlockStack gap="400">
            <div 
              onClick={() => toggleSection('bundle-opportunities')}
              className="collapsible-header"
            >
              <InlineStack gap="200" blockAlign="center" align="space-between">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={MagicIcon} tone="warning" />
                  <Text variant="headingMd" as="h3">Smart Bundle Opportunities</Text>
                  <Button 
                    icon={collapsedSections.has('bundle-opportunities') ? ChevronDownIcon : ChevronUpIcon}
                    variant="plain"
                    size="micro"
                    onClick={() => toggleSection('bundle-opportunities')}
                  />
                </InlineStack>
                {!collapsedSections.has('bundle-opportunities') && (
                  <Button size="micro" variant="primary">AI Powered</Button>
                )}
              </InlineStack>
            </div>
            
            {!collapsedSections.has('bundle-opportunities') && (
              <>
                <BlockStack gap="300">
              {analytics.bundleOpportunities && analytics.bundleOpportunities.length > 0 ? (
                analytics.bundleOpportunities.map((bundle: any, index: number) => (
                  <div key={index} className="cu-flex cu-items-center cu-gap-16 cu-p-12 cu-bg-card cu-rounded-8 cu-border">
                    <div className="cu-flex cu-items-center cu-gap-8 cu-min-w-120">
                      <div className="cu-w-30 cu-h-30 cu-rounded-4 cu-grad-primary cu-center cu-text-white cu-fw-600 cu-text-12">
                        {bundle.product1.title.charAt(0)}
                      </div>
                      <span className="cu-fw-600 cu-text-gray-666">+</span>
                      <div className="cu-w-30 cu-h-30 cu-rounded-4 cu-grad-primary cu-center cu-text-white cu-fw-600 cu-text-12">
                        {bundle.product2.title.charAt(0)}
                      </div>
                    </div>
                    <div className="cu-flex-1">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        {bundle.product1.title} + {bundle.product2.title}
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        Bought together {bundle.coOccurrenceRate}% of the time
                      </Text>
                    </div>
                    <Button size="slim" variant="secondary">Create Bundle</Button>
                  </div>
                ))
              ) : (
                <div className="cu-p-20 cu-text-center cu-bg-card cu-rounded-8 cu-border">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Not enough order data yet. Need at least 10 orders with multiple products to identify bundle opportunities.
                  </Text>
                </div>
              )}
            </BlockStack>
            
            <Text variant="bodySm" as="p" tone="subdued">
              📊 AI analyzes your sales data to identify high-frequency product combinations.
            </Text>
              </>
            )}
          </BlockStack>
        </Card>
      </BlockStack>

      {/* Customize Cards Modal */}
      <Modal
        open={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        title="Customize Dashboard Cards"
        primaryAction={{
          content: 'Save Changes',
          onAction: () => setShowCustomizeModal(false),
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowCustomizeModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              Choose which metrics to display on your dashboard. You can show or hide any of the available cards.
            </Text>
            <BlockStack gap="300">
              {allMetrics.map((metric) => (
                <Checkbox
                  key={metric.id}
                  label={metric.title}
                  checked={metric.id ? selectedCards.has(metric.id) : false}
                  onChange={() => metric.id && toggleCardVisibility(metric.id)}
                />
              ))}
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Top Performers Modal */}
      <Modal
        open={showTopPerformersModal}
        onClose={() => setShowTopPerformersModal(false)}
        title="🌟 Top Performing Products"
        primaryAction={{
          content: 'Close',
          onAction: () => setShowTopPerformersModal(false),
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              These products are getting the most clicks from customers. A product with 5%+ click rate is considered a high performer.
            </Text>
            
            {analytics.topRecommended && analytics.topRecommended.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                headings={['Product', 'Views', 'Clicks', 'Click Rate']}
                rows={analytics.topRecommended
                  .filter((p: any) => p.ctr > 5) // Only high performers (5%+ CTR)
                  .map((product: any) => [
                    product.productTitle || product.productId,
                    product.impressions.toLocaleString(),
                    product.clicks.toLocaleString(),
                    `${product.ctr.toFixed(1)}%`
                  ])}
              />
            ) : (
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text as="p" variant="bodyMd" tone="subdued">
                  No high performers yet. Products need at least 5% click rate to appear here.
                </Text>
              </Box>
            )}
            
            <Box padding="400" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  💡 What makes a top performer?
                </Text>
                <Text as="p" variant="bodyMd">
                  Products with 5%+ click rate are getting noticed by customers. Consider featuring these products more prominently or creating bundles around them.
                </Text>
              </BlockStack>
            </Box>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}