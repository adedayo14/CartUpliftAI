# Production Readiness Checklist - ML Implementation

## Overview
Comprehensive audit to ensure ML system is production-ready with real data, proper multi-tenant support, and no hardcoded values.

---

## PHASE 1: ML Settings Integration ✓ CHECK

### 1.1 Settings UI Connected to Database
- [ ] Privacy & Data Usage Level selector saves to DB
- [ ] Recommendation Strategy selector saves to DB
- [ ] Data Retention Period saves to DB
- [ ] Enable ML Recommendations toggle saves to DB (default: ON)
- [ ] Smart Threshold Suggestions are dynamic based on real store data
- [ ] All settings load from database on page load
- [ ] No mock/hardcoded values in settings display

### 1.2 Settings Enforcement in Code
- [ ] When "Enable ML Recommendations" is OFF, ML endpoints return empty/null
- [ ] Privacy level controls what data is tracked
- [ ] Recommendation strategy determines which ML mode is used
- [ ] Data retention period is respected in cleanup jobs

---

## PHASE 2: Mock Data Elimination ✓ CHECK

### 2.1 ML Endpoints - No Mock Data
- [ ] `api.ml.content-recommendations.tsx` - uses real Shopify products
- [ ] `api.ml.popular-recommendations.tsx` - uses real TrackingEvent data
- [ ] `api.ml.collaborative-data.tsx` - uses real MLUserProfile data
- [ ] No `getAllProducts()` mock functions
- [ ] No fake similarity scores
- [ ] No hardcoded product arrays

### 2.2 ML Services - Real Data Only
- [ ] `ml-analytics.server.ts` - queries real Shopify orders
- [ ] `ml-data-retention.server.ts` - operates on real database records
- [ ] No test/sample data generators in production code

### 2.3 Settings Integration - Real Store Data
- [ ] Order count from Shopify GraphQL (not hardcoded "0 Orders")
- [ ] Quality metrics calculated from real data
- [ ] Thresholds based on actual store performance

---

## PHASE 3: Multi-Tenant Support ✓ CHECK

### 3.1 No Hardcoded Shop Values
- [ ] All DB queries filter by `shop` parameter
- [ ] No hardcoded `your-shop.myshopify.com`
- [ ] Shop value comes from session/authentication
- [ ] MLUserProfile uses `shop + sessionId` composite key
- [ ] MLProductSimilarity uses `shop + productId1 + productId2` unique key
- [ ] All models include `shop` field with proper indexes

### 3.2 Database Schema Multi-Tenant Ready
- [ ] Settings table: one row per shop
- [ ] TrackingEvent table: filtered by shop
- [ ] MLUserProfile table: scoped to shop
- [ ] MLProductSimilarity table: scoped to shop
- [ ] MLDataRetentionJob table: scoped to shop
- [ ] No shared data between shops

---

## PHASE 4: Currency Handling ✓ CHECK

### 4.1 Dynamic Currency from Store
- [ ] Currency fetched from Shopify shop object
- [ ] No hardcoded USD or $ symbols
- [ ] Cart drawer uses store's currency
- [ ] Recommendations show prices in store currency
- [ ] Settings page respects store currency
- [ ] Currency symbol stored in Settings or fetched dynamically

### 4.2 Price Formatting
- [ ] Shopify Money format used
- [ ] No hardcoded currency formats
- [ ] Internationalization support for currency display

---

## PHASE 5: Database Cleanup ✓ CHECK

### 5.1 Single Production Database
- [ ] Using Neon PostgreSQL (from Vercel env)
- [ ] No test databases in production
- [ ] No duplicate/unused databases
- [ ] DATABASE_URL points to production only
- [ ] No local SQLite files

### 5.2 Schema Audit
- [ ] Only required tables exist
- [ ] No orphaned/unused tables
- [ ] All tables have proper indexes
- [ ] Foreign key constraints where needed
- [ ] Soft delete patterns implemented (deletedAt fields)

### 5.3 Prisma Configuration
- [ ] Single schema file (`schema.prisma`)
- [ ] No schema.production.prisma in use
- [ ] Client generated correctly
- [ ] Connection pooling configured
- [ ] No test data seeders in production

---

## PHASE 6: ML Models Validation ✓ CHECK

### 6.1 MLUserProfile Model
- [ ] Tracks viewedProducts, cartedProducts, purchasedProducts
- [ ] Privacy level enforcement
- [ ] Shop-scoped queries
- [ ] Used by collaborative filtering endpoint
- [ ] Used by personalized recommendations
- [ ] Soft delete support (deletedAt)

### 6.2 MLProductSimilarity Model
- [ ] Stores product-to-product similarities
- [ ] Cached recommendations
- [ ] Shop-scoped queries
- [ ] Used by content-based filtering
- [ ] overallScore indexed for performance
- [ ] Pre-computation ready

### 6.3 MLDataRetentionJob Model
- [ ] Schedules cleanup jobs
- [ ] Tracks execution status
- [ ] Shop-scoped
- [ ] Used by data retention service
- [ ] GDPR compliance ready

---

## PHASE 7: Settings to Code Flow ✓ CHECK

### 7.1 Enable ML Recommendations Switch
- [ ] When ON: ML endpoints called, recommendations shown
- [ ] When OFF: ML endpoints bypassed, fallback to traditional
- [ ] Setting persisted in database
- [ ] Default value: true (ON)
- [ ] Proxy route checks this setting before calling ML

### 7.2 Privacy Level Integration
- [ ] basic: No user tracking, product-only recommendations
- [ ] standard: Session tracking, no customer ID
- [ ] advanced: Full tracking with customer ID
- [ ] Enforced in all ML endpoints
- [ ] TrackingEvent respects privacy level
- [ ] MLUserProfile creation respects privacy level

### 7.3 Recommendation Strategy Integration
- [ ] ai_first: 70% ML + 30% traditional
- [ ] popular: 100% trending products
- [ ] balanced: 40% ML + 60% traditional
- [ ] Proxy route implements correct mixing
- [ ] Setting drives actual behavior
- [ ] Graceful degradation if ML fails

### 7.4 Data Retention Period
- [ ] Setting stored in days (30/60/90)
- [ ] Data retention service uses this value
- [ ] Cleanup jobs respect retention period
- [ ] GDPR compliance automated

---

## PHASE 8: File Audit - ML Files ✓ CHECK

### 8.1 Routes
- [ ] `app/routes/api.ml.content-recommendations.tsx` - in use, real data
- [ ] `app/routes/api.ml.popular-recommendations.tsx` - in use, real data
- [ ] `app/routes/api.ml.collaborative-data.tsx` - in use, real data
- [ ] `app/routes/api.ml.bundle-recommendations.tsx` - status?
- [ ] `app/routes/apps.proxy.$.tsx` - calls ML endpoints correctly

### 8.2 Services
- [ ] `app/services/ml-analytics.server.ts` - in use
- [ ] `app/services/ml-data-retention.server.ts` - in use
- [ ] `app/services/ml.server.ts` - status? check for mock data

### 8.3 Models
- [ ] `app/models/settings.server.ts` - ML settings included?
- [ ] Prisma models for ML tables defined

---

## PHASE 9: Monitoring & Testing Setup ✓ CHECK

### 9.1 Error Tracking
- [ ] Console logs for ML endpoint failures
- [ ] Graceful error handling in all ML code
- [ ] Fallback mechanisms when ML fails
- [ ] Error messages returned in JSON

### 9.2 Performance Monitoring
- [ ] Query performance for ML endpoints
- [ ] Database connection pooling
- [ ] Caching strategy for recommendations
- [ ] Rate limiting if needed

### 9.3 Testing Checklist
- [ ] Test ML ON vs OFF behavior
- [ ] Test all 3 privacy levels
- [ ] Test all 3 recommendation strategies
- [ ] Test with multiple shops (multi-tenant)
- [ ] Test data retention cleanup
- [ ] Test currency display for different stores

---

## PHASE 10: Deployment Verification ✓ CHECK

### 10.1 Vercel Deployment
- [ ] Latest code deployed
- [ ] Prisma db push completed
- [ ] ML tables created in Neon
- [ ] Environment variables set correctly
- [ ] Build logs show no errors

### 10.2 Database Verification
- [ ] MLUserProfile table exists
- [ ] MLProductSimilarity table exists
- [ ] MLDataRetentionJob table exists
- [ ] Indexes created
- [ ] No duplicate tables

### 10.3 Live Testing
- [ ] Settings page loads ML configuration
- [ ] Changing settings persists to database
- [ ] ML endpoints return real recommendations
- [ ] Currency shows store's actual currency
- [ ] Multi-shop support works (test with 2+ shops)

---

## Execution Order

1. **Phase 1-2**: Settings & Mock Data Check (Code Audit)
2. **Phase 3**: Multi-Tenant Support (Database Schema)
3. **Phase 4**: Currency Handling (Store Integration)
4. **Phase 5**: Database Cleanup (Infrastructure)
5. **Phase 6**: ML Models Validation (Database Models)
6. **Phase 7**: Settings Integration (Business Logic)
7. **Phase 8**: File Audit (Codebase Scan)
8. **Phase 9**: Monitoring Setup (Observability)
9. **Phase 10**: Live Verification (Production Test)

---

**Starting systematic audit now...**
