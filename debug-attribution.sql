-- SQL Query to Debug Attribution Records
-- Run this to see what's in your RecommendationAttribution table

-- 1. Check total attributed revenue
SELECT 
  COUNT(*) as total_records,
  SUM(attributedRevenue) as total_revenue,
  COUNT(DISTINCT orderId) as unique_orders,
  COUNT(DISTINCT productId) as unique_products
FROM "RecommendationAttribution"
WHERE shop = 'YOUR_SHOP_DOMAIN';

-- 2. Check for duplicate records (same order + product)
SELECT 
  orderId,
  orderNumber,
  productId,
  COUNT(*) as duplicate_count,
  SUM(attributedRevenue) as total_attributed
FROM "RecommendationAttribution"
WHERE shop = 'YOUR_SHOP_DOMAIN'
GROUP BY orderId, orderNumber, productId
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. Show recent attributions (last 10)
SELECT 
  orderNumber,
  productId,
  attributedRevenue,
  orderValue,
  createdAt
FROM "RecommendationAttribution"
WHERE shop = 'YOUR_SHOP_DOMAIN'
ORDER BY createdAt DESC
LIMIT 10;

-- 4. Show all attributions grouped by order
SELECT 
  orderNumber,
  COUNT(*) as products_attributed,
  SUM(attributedRevenue) as order_attributed_revenue,
  MAX(orderValue) as order_total,
  MAX(createdAt) as created_at
FROM "RecommendationAttribution"
WHERE shop = 'YOUR_SHOP_DOMAIN'
GROUP BY orderNumber
ORDER BY created_at DESC;
