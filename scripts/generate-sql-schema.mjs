#!/usr/bin/env node

/**
 * Generate SQL schema from Prisma schema for manual execution in Neon SQL Editor
 * Run: node scripts/generate-sql-schema.mjs > schema.sql
 */

console.log(`-- Cart Uplift Database Schema
-- Generated: ${new Date().toISOString()}
-- Run this in Neon SQL Editor if prisma db push fails

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Session table (required for Shopify app authentication)
CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT,
  "expires" TIMESTAMP(3),
  "accessToken" TEXT NOT NULL,
  "userId" BIGINT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "accountOwner" BOOLEAN NOT NULL DEFAULT false,
  "locale" TEXT,
  "collaborator" BOOLEAN DEFAULT false,
  "emailVerified" BOOLEAN DEFAULT false
);

-- Settings table
CREATE TABLE IF NOT EXISTS "Settings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shop" TEXT UNIQUE NOT NULL,
  "enableApp" BOOLEAN NOT NULL DEFAULT true,
  "showOnlyOnCartPage" BOOLEAN NOT NULL DEFAULT false,
  "autoOpenCart" BOOLEAN NOT NULL DEFAULT true,
  "enableFreeShipping" BOOLEAN NOT NULL DEFAULT false,
  "freeShippingThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "enableRecommendations" BOOLEAN NOT NULL DEFAULT true,
  "enableAddons" BOOLEAN NOT NULL DEFAULT false,
  "enableDiscountCode" BOOLEAN NOT NULL DEFAULT true,
  "enableNotes" BOOLEAN NOT NULL DEFAULT false,
  "enableExpressCheckout" BOOLEAN NOT NULL DEFAULT true,
  "enableAnalytics" BOOLEAN NOT NULL DEFAULT true,
  "enableRecommendationTitleCaps" BOOLEAN NOT NULL DEFAULT false,
  "cartIcon" TEXT NOT NULL DEFAULT 'cart',
  "freeShippingText" TEXT NOT NULL DEFAULT 'You''re {amount} away from free shipping!',
  "freeShippingAchievedText" TEXT NOT NULL DEFAULT '🎉 Congratulations! You''ve unlocked free shipping!',
  "recommendationsTitle" TEXT NOT NULL DEFAULT 'You might also like',
  "actionText" TEXT NOT NULL DEFAULT 'Add discount code',
  "addButtonText" TEXT NOT NULL DEFAULT 'Add',
  "checkoutButtonText" TEXT NOT NULL DEFAULT 'CHECKOUT',
  "applyButtonText" TEXT NOT NULL DEFAULT 'Apply',
  "discountLinkText" TEXT NOT NULL DEFAULT '+ Got a promotion code?',
  "notesLinkText" TEXT NOT NULL DEFAULT '+ Add order notes',
  "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
  "textColor" TEXT NOT NULL DEFAULT '#1A1A1A',
  "buttonColor" TEXT NOT NULL DEFAULT '#000000',
  "buttonTextColor" TEXT NOT NULL DEFAULT '#ffffff',
  "recommendationsBackgroundColor" TEXT NOT NULL DEFAULT '#ecebe3',
  "shippingBarBackgroundColor" TEXT NOT NULL DEFAULT '#f0f0f0',
  "shippingBarColor" TEXT NOT NULL DEFAULT '#121212',
  "recommendationLayout" TEXT NOT NULL DEFAULT 'horizontal',
  "maxRecommendations" INTEGER NOT NULL DEFAULT 6,
  "maxRecommendationProducts" INTEGER NOT NULL DEFAULT 4,
  "complementDetectionMode" TEXT NOT NULL DEFAULT 'automatic',
  "manualRecommendationProducts" TEXT NOT NULL DEFAULT '',
  "progressBarMode" TEXT NOT NULL DEFAULT 'free-shipping',
  "enableGiftGating" BOOLEAN NOT NULL DEFAULT false,
  "giftProgressStyle" TEXT NOT NULL DEFAULT 'single-next',
  "giftThresholds" TEXT NOT NULL DEFAULT '[]',
  "giftNoticeText" TEXT NOT NULL DEFAULT 'Free gift added: {{product}} (worth {{amount}})',
  "giftPriceText" TEXT NOT NULL DEFAULT 'FREE',
  "mlPersonalizationMode" TEXT NOT NULL DEFAULT 'balanced',
  "enableMLRecommendations" BOOLEAN NOT NULL DEFAULT true,
  "mlPrivacyLevel" TEXT NOT NULL DEFAULT 'basic',
  "enableAdvancedPersonalization" BOOLEAN NOT NULL DEFAULT false,
  "enableBehaviorTracking" BOOLEAN NOT NULL DEFAULT false,
  "mlDataRetentionDays" TEXT NOT NULL DEFAULT '30',
  "hideRecommendationsAfterThreshold" BOOLEAN NOT NULL DEFAULT false,
  "enableThresholdBasedSuggestions" BOOLEAN NOT NULL DEFAULT false,
  "thresholdSuggestionMode" TEXT NOT NULL DEFAULT 'smart',
  "enableManualRecommendations" BOOLEAN NOT NULL DEFAULT false,
  "enableSmartBundles" BOOLEAN NOT NULL DEFAULT false,
  "bundlesOnProductPages" BOOLEAN NOT NULL DEFAULT true,
  "bundlesInCartDrawer" BOOLEAN NOT NULL DEFAULT false,
  "bundlesOnCollectionPages" BOOLEAN NOT NULL DEFAULT false,
  "bundlesOnCartPage" BOOLEAN NOT NULL DEFAULT false,
  "bundlesOnCheckoutPage" BOOLEAN NOT NULL DEFAULT false,
  "defaultBundleDiscount" TEXT NOT NULL DEFAULT '15',
  "bundleTitleTemplate" TEXT NOT NULL DEFAULT 'Complete your setup',
  "bundleDiscountPrefix" TEXT NOT NULL DEFAULT 'BUNDLE',
  "bundleConfidenceThreshold" TEXT NOT NULL DEFAULT 'medium',
  "bundleSavingsFormat" TEXT NOT NULL DEFAULT 'both',
  "showIndividualPricesInBundle" BOOLEAN NOT NULL DEFAULT true,
  "autoApplyBundleDiscounts" BOOLEAN NOT NULL DEFAULT true,
  "themeEmbedEnabled" BOOLEAN NOT NULL DEFAULT false,
  "themeEmbedLastSeen" TIMESTAMP(3),
  "currencyCode" TEXT,
  "moneyFormat" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TrackingEvent table (critical for analytics & attribution)
CREATE TABLE IF NOT EXISTS "tracking_events" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shop" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productTitle" TEXT,
  "sessionId" TEXT,
  "customerId" TEXT,
  "revenueCents" INTEGER,
  "currency" TEXT DEFAULT 'USD',
  "orderId" TEXT,
  "source" TEXT,
  "position" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "tracking_events_shop_createdAt_idx" ON "tracking_events"("shop", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "tracking_events_shop_event_createdAt_idx" ON "tracking_events"("shop", "event", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "tracking_events_productId_createdAt_idx" ON "tracking_events"("productId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "tracking_events_sessionId_createdAt_idx" ON "tracking_events"("sessionId", "createdAt" DESC);

-- RecommendationAttribution table (links recommendations to purchases)
CREATE TABLE IF NOT EXISTS "recommendation_attributions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shop" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderNumber" INTEGER,
  "orderValue" DOUBLE PRECISION NOT NULL,
  "customerId" TEXT,
  "recommendationEventIds" JSONB NOT NULL,
  "attributedRevenue" DOUBLE PRECISION NOT NULL,
  "conversionTimeMinutes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "recommendation_attributions_shop_productId_idx" ON "recommendation_attributions"("shop", "productId");
CREATE INDEX IF NOT EXISTS "recommendation_attributions_shop_orderId_idx" ON "recommendation_attributions"("shop", "orderId");
CREATE INDEX IF NOT EXISTS "recommendation_attributions_shop_createdAt_idx" ON "recommendation_attributions"("shop", "createdAt" DESC);

-- Additional tables (Bundle, A/B testing, etc.) - add if needed

SELECT 'Schema creation complete! Verify with: SELECT table_name FROM information_schema.tables WHERE table_schema=''public'';' as status;
`);

process.exit(0);
