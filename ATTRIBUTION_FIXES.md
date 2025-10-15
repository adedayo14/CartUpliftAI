# Attribution Revenue Tracking - Issues Fixed

**Date:** October 15, 2025  
**Commits:** `4cab1c1`, `b0cb13b`

## 🐛 Issues Identified

### Issue 1: Duplicate Attribution Records
**Problem:** Same order being attributed multiple times within milliseconds
- Order 1039 created 4 records (2 duplicates)
- Snow Boots: £900 × 2 = £1,800 ❌
- The Letterman: £749.95 × 2 = £1,499.90 ❌
- **Total shown: £3,299.90** (should be £1,649.95)

**Root Cause:** No duplicate prevention check in webhook handler

**Fix (commit 4cab1c1):**
```typescript
// Added at start of processOrderForAttribution()
const existingAttribution = await db.recommendationAttribution.findFirst({
  where: { shop, orderId: order.id.toString() }
});

if (existingAttribution) {
  console.log('⚠️ Already processed, skipping');
  return;
}
```

### Issue 2: Product ID + Variant ID Both Attributed
**Problem:** Both the product ID AND its variant ID were being added to `attributedProducts[]`
- Product `7785831235770` (Snow Boots) ✓
- Variant `43678657970362` (Snow Boots variant) ✓
- Result: Same item counted twice

**Root Cause:** Attribution loop checked product IDs first, then ALSO checked variant IDs and added both

**Fix (commit b0cb13b):**
```typescript
// Changed from array to Set to prevent duplicates
const attributedProductIds = new Set<string>();

// Only attribute by PRODUCT ID (skip variant check entirely)
for (const productId of uniqueProductIds) {
  if (attributedProductIds.has(productId)) continue; // Skip if already added
  
  const wasRecommended = recommendedIds.includes(productId);
  
  // Check if product OR any of its variants were clicked
  let wasClicked = clickedProductIds.has(productId);
  if (!wasClicked && productToVariantsMap.has(productId)) {
    const variants = productToVariantsMap.get(productId)!;
    wasClicked = variants.some(vid => clickedVariantIds.has(vid));
  }
  
  if (wasRecommended && wasClicked) {
    attributedProductIds.add(productId); // Only add once
  }
}
```

**Key Change:** Removed the entire "check variant IDs" loop that was adding variants separately

### Issue 3: Variant IDs Not Calculating Revenue
**Problem:** When variant ID was attributed, `calculateProductRevenue()` returned £0.00
- Variant `43678657970362` showed £0.00 instead of £699.95

**Root Cause:** Revenue lookup only checked `item.product_id`, not `item.variant_id`

**Fix (commit 4cab1c1):**
```typescript
function calculateProductRevenue(order: any, productId: string): number {
  // Try product_id first
  let lineItem = order.line_items?.find(item => 
    item.product_id?.toString() === productId
  );
  
  // Fallback to variant_id
  if (!lineItem) {
    lineItem = order.line_items?.find(item => 
      item.variant_id?.toString() === productId
    );
  }
  
  if (!lineItem) {
    console.warn(`⚠️ Could not find line item for ${productId}`);
    return 0;
  }
  
  return parseFloat(lineItem.price || 0) * (lineItem.quantity || 1);
}
```

### Issue 4: Product Names Showing as "Product 43678657970362"
**Problem:** Dashboard showing variant IDs instead of product names in "Top Revenue Generators"

**Root Cause 1:** GraphQL query didn't fetch variant information  
**Root Cause 2:** Product title map didn't include variant IDs

**Fix (commit b0cb13b):**

1. Updated GraphQL query to include variant data:
```graphql
lineItems(first: 50) {
  edges {
    node {
      product {
        title
        id
      }
      variant {
        id
        title  # ← Added
      }
    }
  }
}
```

2. Enhanced product title mapping:
```typescript
const variantTitle = lineItem.node.variant?.title;
const fullTitle = variantTitle && variantTitle !== 'Default Title' 
  ? `${productTitle} - ${variantTitle}` 
  : productTitle;

// Map BOTH product ID and variant ID to same title
if (productGid) {
  productTitlesMap.set(productId, fullTitle);
}
if (variantGid) {
  productTitlesMap.set(variantId, fullTitle); // ← Now variants work
}
```

## ✅ Expected Results After Fix

### Before:
- Revenue from AI Recommendations: **£3,299.90** ❌
- Orders with AI recommendations: **4** (duplicates) ❌
- Top Revenue Generators:
  - Snow Boots: £1,800.00 ❌
  - Product 43678657970362: £900.00 ❌
  - The Letterman: £749.95
  - Product 43643632386234: £749.95 ❌

### After:
- Revenue from AI Recommendations: **£1,649.95** ✓ (Snow Boots £900 + Letterman £749.95)
- Orders with AI recommendations: **1** ✓
- Top Revenue Generators:
  - Snow Boots: £900.00 ✓
  - The Letterman: £749.95 ✓
  
**Note:** Free Metcon 5 (£885.95) should NOT be attributed - it wasn't a clicked recommendation

## 🧪 Testing Instructions

1. **Clear existing data:** `node clear-data.js`
2. **Wait for Vercel deployment** (~2 minutes after git push)
3. **Place test order:**
   - Add any product to cart
   - Open cart drawer (should see recommendations)
   - **Click** one of the recommended products
   - Add the clicked product to cart
   - Complete checkout
4. **Verify on dashboard:**
   - "Revenue from AI Recommendations" = price of clicked product only
   - "Orders with AI recommendations" = 1
   - "Top Revenue Generators" shows product NAME, not ID
   - No duplicate entries

## 📝 Key Learnings

1. **Always use Set for deduplication** instead of array + filtering
2. **Single source of truth**: Attribute by product ID only, use variants for click matching
3. **GraphQL must include all data**: If displaying variant info, must fetch variant fields
4. **Duplicate prevention is critical**: Check if order already processed before any attribution logic
5. **Log everything**: Detailed logs helped identify the duplicate timing issue

## 🔧 Files Modified

- `app/routes/webhooks.orders.create.tsx` - Attribution logic
- `app/routes/admin.dashboard.tsx` - Product title lookup
- `check-attribution.js` - Debugging tool (new)
- `clear-data.js` - Data reset tool (updated)
