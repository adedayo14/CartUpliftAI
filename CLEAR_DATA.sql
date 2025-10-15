-- Clear All Attribution and Tracking Data
-- Run this in your database console or using prisma studio

-- Replace 'sectionappblocks.myshopify.com' with your shop domain

-- 1. Check what will be deleted
SELECT 'RecommendationAttribution' as table_name, COUNT(*) as count 
FROM "RecommendationAttribution" 
WHERE shop = 'sectionappblocks.myshopify.com'
UNION ALL
SELECT 'TrackingEvent', COUNT(*) 
FROM "TrackingEvent" 
WHERE shop = 'sectionappblocks.myshopify.com'
UNION ALL
SELECT 'AnalyticsEvent', COUNT(*) 
FROM "AnalyticsEvent" 
WHERE shop = 'sectionappblocks.myshopify.com';

-- 2. DELETE all attribution records
DELETE FROM "RecommendationAttribution" 
WHERE shop = 'sectionappblocks.myshopify.com';

-- 3. DELETE all tracking events
DELETE FROM "TrackingEvent" 
WHERE shop = 'sectionappblocks.myshopify.com';

-- 4. DELETE all analytics events
DELETE FROM "AnalyticsEvent" 
WHERE shop = 'sectionappblocks.myshopify.com';

-- 5. Verify deletion
SELECT 'RecommendationAttribution' as table_name, COUNT(*) as remaining 
FROM "RecommendationAttribution" 
WHERE shop = 'sectionappblocks.myshopify.com'
UNION ALL
SELECT 'TrackingEvent', COUNT(*) 
FROM "TrackingEvent" 
WHERE shop = 'sectionappblocks.myshopify.com'
UNION ALL
SELECT 'AnalyticsEvent', COUNT(*) 
FROM "AnalyticsEvent" 
WHERE shop = 'sectionappblocks.myshopify.com';
