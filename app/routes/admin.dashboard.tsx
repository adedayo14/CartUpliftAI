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
  Box,
  ProgressBar,
  Banner,
  Divider,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { 
  CashDollarIcon, 
  OrderIcon,
  MagicIcon,
  ChartVerticalIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getSettings } from "../models/settings.server";
import prisma from "../db.server";
import { getShopCurrency } from "../services/currency.server";
import db from "../db.server";

// [Previous loader function remains exactly the same - no changes]
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // ... keeping all existing loader code unchanged ...
  const { admin, session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const timeframe = url.searchParams.get("timeframe") || "30d";
  const search = url.search;
  const customStartDate = url.searchParams.get("startDate");
  const customEndDate = url.searchParams.get("endDate");
  
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  
  if (customStartDate && customEndDate) {
    startDate = new Date(customStartDate);
    endDate = new Date(customEndDate);
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
        startDate = new Date(2020, 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  const periodDuration = endDate.getTime() - startDate.getTime();
  const previousPeriodEnd = new Date(startDate.getTime() - 1);
  const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodDuration);

  try {
    if (!session || !session.shop) {
      throw new Error('No authenticated session');
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbError) {
      throw new Error(`Database connection error: ${dbError instanceof Error ? dbError.message : 'Unknown DB error'}`);
    }

    let ordersData: any = null;
    let shopData: any = null;
    let hasOrderAccess = true;
    
    try {
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
      
      if (ordersData.errors) {
        hasOrderAccess = false;
        ordersData = null;
      } else if (!ordersData?.data?.orders) {
        hasOrderAccess = false;
        ordersData = null;
      }
    } catch (orderError) {
      hasOrderAccess = false;
      ordersData = null;
    }

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
    const settings = await getSettings(session.shop);
    const allOrders = (hasOrderAccess && ordersData?.data?.orders?.edges) ? ordersData.data.orders.edges : [];
    
    const orders = allOrders.filter((order: any) => {
      const orderDate = new Date(order.node.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
    
    const previousOrders = allOrders.filter((order: any) => {
      const orderDate = new Date(order.node.createdAt);
      return orderDate >= previousPeriodStart && orderDate <= previousPeriodEnd;
    });
    
    const shop = shopData.data?.shop;
    const shopCurrency = await getShopCurrency(session.shop);
    const storeCurrency = orders.length > 0 ? 
      orders[0].node.totalPriceSet?.shopMoney?.currencyCode || shopCurrency.code : shopCurrency.code;
    
    const calculatePeriodMetrics = (periodOrders: any[]) => {
      const totalOrders = periodOrders.length;
      const totalRevenue = periodOrders.reduce((sum: number, order: any) => {
        return sum + parseFloat(order.node.totalPriceSet.shopMoney.amount);
      }, 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      const multiProductOrders = periodOrders.filter((order: any) => {
        const lineItemCount = order.node.lineItems?.edges?.length || 0;
        return lineItemCount > 1;
      });
      
      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        multiProductOrderCount: multiProductOrders.length
      };
    };
    
    const currentMetrics = calculatePeriodMetrics(orders);
    const totalOrders = currentMetrics.totalOrders;
    const totalRevenue = currentMetrics.totalRevenue;
    const averageOrderValue = currentMetrics.averageOrderValue;
    const previousMetrics = calculatePeriodMetrics(previousOrders);
    
    let cartImpressions = 0;
    let cartOpensToday = 0;
    
    try {
      const cartOpenEvents = await (db as any).analyticsEvent?.findMany?.({
        where: {
          shop: session.shop,
          eventType: 'cart_open',
          createdAt: { gte: startDate, lte: endDate }
        }
      }) ?? [];
      
      cartImpressions = cartOpenEvents.length;
      
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
    } catch (e) {
      cartImpressions = 0;
      cartOpensToday = 0;
    }
    
    const checkoutsCompleted = totalOrders;
    const cartToCheckoutRate = cartImpressions > 0 ? (totalOrders / cartImpressions) * 100 : 0;
    
    const freeShippingThreshold = settings?.freeShippingThreshold || 0;
    
    let ordersWithFreeShipping = 0;
    let ordersWithoutFreeShipping = 0;
    let avgAOVWithFreeShipping = 0;
    let avgAOVWithoutFreeShipping = 0;
    let freeShippingRevenue = 0;
    let nonFreeShippingRevenue = 0;
    
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
    
    const freeShippingConversionRate = totalOrders > 0 ? (ordersWithFreeShipping / totalOrders) * 100 : 0;
    const freeShippingAOVLift = avgAOVWithoutFreeShipping > 0 ? 
      ((avgAOVWithFreeShipping - avgAOVWithoutFreeShipping) / avgAOVWithoutFreeShipping) * 100 : 0;
    
    const avgAmountAddedForFreeShipping = avgAOVWithFreeShipping > freeShippingThreshold 
      ? avgAOVWithFreeShipping - freeShippingThreshold 
      : 0;
    
    let giftThresholds: Array<{ threshold: number; productId: string; productTitle: string }> = [];
    
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
    
    if (giftThresholds.length > 0) {
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
    
    const giftConversionRate = totalOrders > 0 ? (ordersReachingGifts / totalOrders) * 100 : 0;
    const giftAOVLift = avgAOVWithoutGift > 0 ? 
      ((avgAOVWithGift - avgAOVWithoutGift) / avgAOVWithoutGift) * 100 : 0;
    
    const lowestGiftThreshold = giftThresholds.length > 0 
      ? Math.min(...giftThresholds.map(g => g.threshold)) 
      : 0;
    const avgAmountAddedForGift = lowestGiftThreshold > 0 && avgAOVWithGift > lowestGiftThreshold
      ? avgAOVWithGift - lowestGiftThreshold
      : 0;
    
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
    
    const topUpsells: Array<any> = [];

    const bundleOpportunities = [];
    if (orders.length > 10) {
      const productPairs = new Map();
      const productNames = new Map();
      
      orders.forEach((order: any) => {
        const lineItems = order.node.lineItems?.edges || [];
        const products = lineItems.map((item: any) => ({
          id: item.node.product?.id,
          title: item.node.product?.title
        })).filter((p: { id?: string; title?: string }) => p.id && p.title);
        
        products.forEach((product: { id: string; title: string }) => {
          productNames.set(product.id, product.title);
        });
        
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
          .filter(pair => pair.coOccurrenceRate >= 60)
          .sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate)
          .slice(0, 3);
        
        bundleOpportunities.push(...highFrequencyPairs);
      }
    }

    let recSummary = { totalImpressions: 0, totalClicks: 0, ctr: 0 };
    let recCTRSeries: Array<{ date: string; impressions: number; clicks: number; ctr: number }> = [];
    let topRecommended: Array<{ productId: string; productTitle: string; impressions: number; clicks: number; ctr: number; revenueCents: number }> = [];
    try {
      const events = await (db as any).trackingEvent?.findMany?.({
        where: { shop: session.shop, createdAt: { gte: startDate, lte: endDate } }
      }) ?? [];
      
      const impressions = events.filter((e: any) => e.event === 'impression').length;
      const clicks = events.filter((e: any) => e.event === 'click').length;
      recSummary.totalImpressions = impressions;
      recSummary.totalClicks = clicks;
      recSummary.ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

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

      const byProduct: Record<string, { title: string; imp: number; clk: number; rev: number }>= {};
      for (const e of events) {
        const pid = e.productId as string | null;
        if (!pid) continue;
        
        if (pid.includes('_') || pid === 'undefined' || pid === 'null') continue;
        
        const rec = byProduct[pid] || (byProduct[pid] = { title: e.productTitle || '', imp: 0, clk: 0, rev: 0 });
        if (e.event === 'impression') rec.imp++;
        else if (e.event === 'click') rec.clk++;
        if (typeof e.revenueCents === 'number' && isFinite(e.revenueCents)) rec.rev += e.revenueCents;
        if (e.productTitle && !rec.title) rec.title = e.productTitle;
      }
      topRecommended = Object.entries(byProduct)
        .filter(([productId]) => productId && !productId.includes('_'))
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
      console.error('Error fetching tracking events:', trackingError);
    }

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
      
      attributedRevenue = attributions.reduce((sum: number, a: any) => 
        sum + (a.attributedRevenue || 0), 0
      );
      
      const uniqueOrderIds = new Set(attributions.map((a: any) => a.orderId));
      attributedOrders = uniqueOrderIds.size;
      
      const productTitlesMap = new Map<string, string>();
      orders.forEach((order: any) => {
        order.node.lineItems?.edges?.forEach((lineItem: any) => {
          const productGid = lineItem.node.product?.id;
          const variantGid = lineItem.node.variant?.id;
          const productTitle = lineItem.node.product?.title;
          const variantTitle = lineItem.node.variant?.title;
          
          const fullTitle = variantTitle && variantTitle !== 'Default Title' 
            ? `${productTitle} - ${variantTitle}` 
            : productTitle;
          
          if (fullTitle) {
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
            totalValue: attr.orderValue || 0,
            attributedValue: 0,
            products: new Set(),
            productCount: 0
          });
        }
        const orderData = orderUpliftMap.get(orderKey)!;
        
        orderData.attributedValue += attr.attributedRevenue || 0;
        orderData.productCount++;
        
        const pid = attr.productId;
        const numericId = pid.includes('/') ? pid.split('/').pop()! : pid;
        const title = productTitlesMap.get(numericId) || productTitlesMap.get(pid) || `Product ${numericId}`;
        orderData.products.add(title);
      }
      
      orderUpliftBreakdown = Array.from(orderUpliftMap.values())
        .map(order => {
          const cappedAttributedValue = Math.min(order.attributedValue, order.totalValue);
          const baseValue = order.totalValue - cappedAttributedValue;
          const upliftPercentage = order.totalValue > 0 ? ((cappedAttributedValue / order.totalValue) * 100) : 0;
          
          return {
            orderNumber: order.orderNumber,
            totalValue: order.totalValue,
            baseValue: Math.max(0, baseValue),
            attributedValue: cappedAttributedValue,
            upliftPercentage,
            products: Array.from(order.products),
            productCount: order.productCount
          };
        })
        .filter(order => order.attributedValue > 0 && order.totalValue > 0)
        .sort((a, b) => b.upliftPercentage - a.upliftPercentage)
        .slice(0, 10);
      
      if (topRecommended.length > 0) {
        topRecommended = topRecommended.map(rec => {
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
      
      const attributedProductMap = new Map<string, { revenue: number; orders: number }>();
      topAttributedProducts.forEach((product) => {
        attributedProductMap.set(product.productTitle, {
          revenue: product.revenue,
          orders: product.orders
        });
      });
      
      topUpsells.push(...topRecommended.slice(0, 10).map((tracked) => {
        const attributedData = attributedProductMap.get(tracked.productTitle);
        const orders = attributedData?.orders || 0;
        const revenue = attributedData?.revenue || 0;
        const conversionRate = tracked.clicks > 0 ? ((orders / tracked.clicks) * 100).toFixed(1) : '0.0';
        
        return {
          product: tracked.productTitle,
          impressions: tracked.impressions,
          clicks: tracked.clicks,
          conversions: orders,
          conversionRate: conversionRate,
          revenue: revenue.toFixed(2),
          ctr: tracked.ctr.toFixed(1)
        };
      }));
        
    } catch (error) {
      console.error('Error fetching attribution data:', error);
    }
    
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
    } catch (e) {
      console.warn("Failed to fetch previous period attributions:", e);
    }
    
    let mlStatus = {
      productsAnalyzed: 0,
      highPerformers: 0,
      blacklistedProducts: 0,
      performanceChange: 0,
      lastUpdated: null as Date | null
    };
    
    try {
      const mlPerformance = await (db as any).mLProductPerformance?.findMany?.({
        where: { shop: session.shop }
      }) ?? [];
      
      if (mlPerformance.length > 0) {
        mlStatus.productsAnalyzed = mlPerformance.length;
        mlStatus.highPerformers = mlPerformance.filter((p: any) => p.confidence > 0.7).length;
        mlStatus.blacklistedProducts = mlPerformance.filter((p: any) => p.isBlacklisted).length;
      } else {
        mlStatus.productsAnalyzed = topRecommended.length;
        mlStatus.highPerformers = topRecommended.filter(p => p.ctr > 5).length;
      }
      
      const latestJob = await (db as any).mLSystemHealth?.findFirst?.({
        where: { shop: session.shop },
        orderBy: { completedAt: 'desc' }
      });
      
      if (latestJob?.completedAt) {
        mlStatus.lastUpdated = latestJob.completedAt;
      } else if (topRecommended.length > 0 || recSummary.totalImpressions > 0) {
        const latestTracking = await (db as any).trackingEvent?.findFirst?.({
          where: { shop: session.shop },
          orderBy: { createdAt: 'desc' }
        });
        if (latestTracking?.createdAt) {
          mlStatus.lastUpdated = latestTracking.createdAt;
        }
      }
      
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

    const appCost = 49;
    const roi = appCost > 0 && attributedRevenue > 0 ? (attributedRevenue / appCost) : 0;
    
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
        totalOrders,
        totalRevenue,
        averageOrderValue,
        checkoutsCompleted: checkoutsCompleted,
        
        previousMetrics: {
          totalOrders: previousMetrics.totalOrders,
          totalRevenue: previousMetrics.totalRevenue,
          averageOrderValue: previousMetrics.averageOrderValue,
          attributedRevenue: previousAttributedRevenue,
          attributedOrders: previousAttributedOrders,
        },
        
        attributedRevenue,
        attributedOrders,
        appCost,
        roi,
        topAttributedProducts,
        orderUpliftBreakdown,
        mlStatus,
        setupProgress,
        setupComplete: setupProgress === 100,
        cartImpressions: cartImpressions,
        cartOpensToday: cartOpensToday,
        cartToCheckoutRate,
        topProducts,
        topUpsells,
        recImpressions: recSummary.totalImpressions,
        recClicks: recSummary.totalClicks,
        recCTR: recSummary.ctr,
        recCTRSeries,
        topRecommended,
        bundleOpportunities,
        cartAbandonmentRate: cartToCheckoutRate > 0 ? 100 - cartToCheckoutRate : 0,
        freeShippingThreshold,
        ordersWithFreeShipping,
        ordersWithoutFreeShipping,
        avgAOVWithFreeShipping,
        avgAOVWithoutFreeShipping,
        freeShippingConversionRate,
        freeShippingAOVLift,
        freeShippingRevenue,
        avgAmountAddedForFreeShipping,
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
    // ... keep existing error handling ...
    return json({
      debug: { hasOrderAccess: false, ordersDataExists: false, ordersLength: 0, timeframe: "30d", startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), endDate: new Date().toISOString(), shop: session?.shop || 'unknown' },
      analytics: { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0, checkoutsCompleted: 0, previousMetrics: { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0, attributedRevenue: 0, attributedOrders: 0 }, attributedRevenue: 0, attributedOrders: 0, appCost: 49, roi: 0, topAttributedProducts: [], mlStatus: { productsAnalyzed: 0, highPerformers: 0, blacklistedProducts: 0, performanceChange: 0, lastUpdated: null }, cartImpressions: 0, cartOpensToday: 0, cartToCheckoutRate: 0, topProducts: [], topUpsells: [], recImpressions: 0, recClicks: 0, recCTR: 0, recCTRSeries: [], topRecommended: [], bundleOpportunities: [], cartAbandonmentRate: 0, freeShippingEnabled: false, freeShippingThreshold: 100, ordersWithFreeShipping: 0, ordersWithoutFreeShipping: 0, avgAOVWithFreeShipping: 0, avgAOVWithoutFreeShipping: 0, freeShippingConversionRate: 0, freeShippingAOVLift: 0, freeShippingRevenue: 0, avgAmountAddedForFreeShipping: 0, giftGatingEnabled: false, giftThresholds: [], ordersReachingGifts: 0, ordersNotReachingGifts: 0, avgAOVWithGift: 0, avgAOVWithoutGift: 0, giftConversionRate: 0, giftAOVLift: 0, giftRevenue: 0, avgAmountAddedForGift: 0, giftThresholdBreakdown: [], setupProgress: 0, setupComplete: false, timeframe: "30d", shopName: "demo-shop", currency: 'USD' },
      shop: 'demo-shop',
      search
    });
  }
};

export default function Dashboard() {
  const { analytics, search } = useLoaderData<typeof loader>();
  const [selectedOrderProducts, setSelectedOrderProducts] = useState<{orderNumber: string; products: string[]; totalValue: number; attributedValue: number; upliftPercentage: number} | null>(null);
  
  const settingsHref = `/app/settings${search ?? ""}`;

  const getTimeframeLabel = (timeframe: string) => {
    switch (timeframe) {
      case "today": return "Today";
      case "7d": return "Last 7 days";
      case "30d": return "Last 30 days";
      case "90d": return "Last 90 days";
      case "ytd": return "Year to date";
      case "all": return "All time";
      default: return "Last 30 days";
    }
  };

  const formatCurrency = (amount: number) => {
    const currencySymbols: { [key: string]: string } = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'CAD': 'C$', 'AUD': 'A$', 'JPY': '¥', 'INR': '₹', 'BRL': 'R$', 'MXN': '$', 'SGD': 'S$', 'HKD': 'HK$',
    }; 
    
    const symbol = currencySymbols[analytics.currency] || analytics.currency + ' ';
    const formattedAmount = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${symbol}${formattedAmount}`;
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

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

  const exportFullDashboard = () => {
    const sections = [];
    sections.push('ATTRIBUTION SUMMARY');
    sections.push('Metric,Value');
    sections.push(`Attributed Revenue,${formatCurrency(analytics.attributedRevenue)}`);
    sections.push(`Attributed Orders,${analytics.attributedOrders}`);
    sections.push(`ROI,${analytics.roi.toFixed(1)}x`);
    sections.push(`App Cost,${formatCurrency(analytics.appCost)}`);
    sections.push('');
    sections.push('CORE METRICS');
    sections.push('Metric,Value');
    sections.push(`Total Orders,${analytics.totalOrders}`);
    sections.push(`Total Revenue,${formatCurrency(analytics.totalRevenue)}`);
    sections.push(`Average Order Value,${formatCurrency(analytics.averageOrderValue)}`);
    sections.push('');
    const csv = sections.join('\n');
    downloadCSV(`dashboard-export-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  // Setup progress check
  if (analytics.setupProgress < 100) {
    return (
      <Page title="Getting Started">
        <TitleBar title="Getting Started" />
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text variant="headingLg" as="h2">Your AI is Getting Ready</Text>
                <Text variant="bodyMd" tone="subdued">Setting up recommendations for your store</Text>
                
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="400">
                    <ProgressBar progress={analytics.setupProgress} tone="success" />
                    
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="span">{analytics.recImpressions > 0 ? '✅' : '⏳'}</Text>
                        <Text variant="bodyMd">Recommendations showing on your store</Text>
                      </InlineStack>
                      
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="span">{analytics.recClicks > 0 ? '✅' : '⏳'}</Text>
                        <Text variant="bodyMd">Customers clicking recommendations</Text>
                      </InlineStack>
                      
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="span">{analytics.attributedOrders > 0 ? '✅' : '⏳'}</Text>
                        <Text variant="bodyMd">Revenue tracking active</Text>
                      </InlineStack>
                    </BlockStack>
                  </BlockStack>
                </Box>
                
                <Banner tone="info">
                  Your dashboard will activate once customers interact with recommendations. The AI learns from each sale to improve over time.
                </Banner>
                
                <InlineStack gap="300">
                  <a href={settingsHref}>
                    <Button variant="primary">Configure Settings</Button>
                  </a>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Main dashboard
  return (
    <Page
      title="Analytics"
      primaryAction={{
        content: 'Export',
        onAction: exportFullDashboard
      }}
      secondaryActions={[
        {
          content: getTimeframeLabel(analytics.timeframe),
          onAction: () => {}
        }
      ]}
    >
      <TitleBar title="Analytics" />
      
      <BlockStack gap="500">
        {/* Date Filter */}
        <Card>
          <InlineStack align="space-between" wrap={false}>
            <BlockStack gap="100">
              <Text variant="headingSm" tone="subdued">Time period</Text>
              <Text variant="bodyLg" as="p">{getTimeframeLabel(analytics.timeframe)}</Text>
            </BlockStack>
            
            <Select
              label=""
              labelHidden
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
                window.location.href = `${window.location.pathname}?${params.toString()}`;
              }}
            />
          </InlineStack>
        </Card>

        {/* Key Metrics Overview */}
        <Layout>
          <Layout.Section>
            <Grid columns={{xs: 1, sm: 2, md: 2, lg: 4, xl: 4}} gap="400">
              {/* Total Revenue */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Total sales</Text>
                  <Text variant="heading2xl" as="h3">{formatCurrency(analytics.totalRevenue)}</Text>
                  {analytics.previousMetrics.totalRevenue > 0 && (
                    <Badge tone={analytics.totalRevenue >= analytics.previousMetrics.totalRevenue ? "success" : "info"}>
                      {analytics.totalRevenue >= analytics.previousMetrics.totalRevenue ? "↗" : "↘"} {Math.abs(calculateChange(analytics.totalRevenue, analytics.previousMetrics.totalRevenue)).toFixed(1)}%
                    </Badge>
                  )}
                </BlockStack>
              </Card>

              {/* AI Revenue */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">AI-generated sales</Text>
                  <Text variant="heading2xl" as="h3">{formatCurrency(analytics.attributedRevenue)}</Text>
                  <Badge tone="success">{analytics.roi > 0 ? `${analytics.roi.toFixed(1)}x ROI` : 'Getting started'}</Badge>
                </BlockStack>
              </Card>

              {/* Orders */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Orders</Text>
                  <Text variant="heading2xl" as="h3">{analytics.totalOrders}</Text>
                  {analytics.previousMetrics.totalOrders > 0 && (
                    <Badge tone={analytics.totalOrders >= analytics.previousMetrics.totalOrders ? "success" : "info"}>
                      {analytics.totalOrders >= analytics.previousMetrics.totalOrders ? "↗" : "↘"} {Math.abs(calculateChange(analytics.totalOrders, analytics.previousMetrics.totalOrders)).toFixed(1)}%
                    </Badge>
                  )}
                </BlockStack>
              </Card>

              {/* AOV */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Average order value</Text>
                  <Text variant="heading2xl" as="h3">{formatCurrency(analytics.averageOrderValue)}</Text>
                  {analytics.previousMetrics.averageOrderValue > 0 && (
                    <Badge tone={analytics.averageOrderValue >= analytics.previousMetrics.averageOrderValue ? "success" : "info"}>
                      {analytics.averageOrderValue >= analytics.previousMetrics.averageOrderValue ? "↗" : "↘"} {Math.abs(calculateChange(analytics.averageOrderValue, analytics.previousMetrics.averageOrderValue)).toFixed(1)}%
                    </Badge>
                  )}
                </BlockStack>
              </Card>
            </Grid>
          </Layout.Section>

          {/* Recommendation Performance */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Recommendation performance</Text>
                
                <Grid columns={{xs: 1, sm: 3, md: 3, lg: 3, xl: 3}} gap="400">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Click rate</Text>
                    <Text variant="headingLg" as="h3">{analytics.recCTR.toFixed(1)}%</Text>
                    <Text variant="bodyXs" tone="subdued">{analytics.recClicks} clicks from {analytics.recImpressions} views</Text>
                  </BlockStack>

                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Orders with AI</Text>
                    <Text variant="headingLg" as="h3">{analytics.attributedOrders}</Text>
                    <Text variant="bodyXs" tone="subdued">{analytics.totalOrders > 0 ? ((analytics.attributedOrders / analytics.totalOrders) * 100).toFixed(1) : 0}% of all orders</Text>
                  </BlockStack>

                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Conversion rate</Text>
                    <Text variant="headingLg" as="h3">
                      {analytics.recClicks > 0 && analytics.attributedOrders > 0 ? `${((analytics.attributedOrders / analytics.recClicks) * 100).toFixed(1)}%` : '0%'}
                    </Text>
                    <Text variant="bodyXs" tone="subdued">Clicks to purchase</Text>
                  </BlockStack>
                </Grid>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Top Sales Generators */}
          {analytics.topAttributedProducts && analytics.topAttributedProducts.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Top sales generators</Text>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric']}
                    headings={['Product', 'Orders', 'Sales']}
                    rows={analytics.topAttributedProducts.slice(0, 5).map((product: any) => [
                      product.productTitle,
                      product.orders.toString(),
                      formatCurrency(product.revenue)
                    ])}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          {/* Order Uplift Breakdown */}
          {(analytics as any).orderUpliftBreakdown && (analytics as any).orderUpliftBreakdown.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Recent wins</Text>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                    headings={['Order', 'Total', 'From AI', 'Impact']}
                    rows={(analytics as any).orderUpliftBreakdown.slice(0, 5).map((order: any) => [
                      `#${order.orderNumber}`,
                      formatCurrency(order.totalValue),
                      formatCurrency(order.attributedValue),
                      `${order.upliftPercentage.toFixed(0)}%`
                    ])}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          {/* ML Learning Status */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">AI learning status</Text>
                
                <Grid columns={{xs: 2, sm: 4, md: 4, lg: 4, xl: 4}} gap="400">
                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Products analyzed</Text>
                    <Text variant="headingLg" as="h3">{analytics.mlStatus.productsAnalyzed}</Text>
                  </BlockStack>

                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">High performers</Text>
                    <Text variant="headingLg" as="h3">{analytics.mlStatus.highPerformers}</Text>
                  </BlockStack>

                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Performance trend</Text>
                    <Text variant="headingLg" as="h3">
                      {analytics.mlStatus.performanceChange > 5 ? '📈' : analytics.mlStatus.performanceChange < -5 ? '📉' : '✅'}
                    </Text>
                  </BlockStack>

                  <BlockStack gap="200">
                    <Text variant="bodySm" tone="subdued">Last updated</Text>
                    <Text variant="headingLg" as="h3">
                      {analytics.mlStatus.lastUpdated 
                        ? new Date(analytics.mlStatus.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Never'}
                    </Text>
                  </BlockStack>
                </Grid>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Top Products */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Top products</Text>
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                  headings={['Product', 'Orders', 'Quantity', 'Revenue']}
                  rows={analytics.topProducts.slice(0, 5).map((item: any) => [
                    item.product,
                    item.orders.toString(),
                    item.quantity.toString(),
                    formatCurrency(item.revenue)
                  ])}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Recommendations Table */}
          {analytics.topRecommended && analytics.topRecommended.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Most recommended</Text>
                  <DataTable
                    columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                    headings={['Product', 'Shown', 'Clicked', 'Click rate']}
                    rows={analytics.topRecommended.slice(0, 5).map((r: any) => [
                      r.productTitle,
                      r.impressions.toString(),
                      r.clicks.toString(),
                      `${r.ctr.toFixed(1)}%`
                    ])}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>

      {/* Product Details Modal */}
      {selectedOrderProducts && (
        <Modal
          open={true}
          onClose={() => setSelectedOrderProducts(null)}
          title={`Order #${selectedOrderProducts.orderNumber}`}
          primaryAction={{
            content: 'Close',
            onAction: () => setSelectedOrderProducts(null),
          }}
        >
          <Modal.Section>
            <BlockStack gap="300">
              {selectedOrderProducts.products.map((product: string, idx: number) => (
                <InlineStack key={idx} gap="200" blockAlign="center">
                  <Text as="span" variant="bodyMd">{idx + 1}.</Text>
                  <Text as="span" variant="bodyMd">{product}</Text>
                </InlineStack>
              ))}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}