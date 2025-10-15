# Gift Product Auto-Add Debug Guide

## Issue
Gift product "Air Max Lilac" not auto-adding to cart when £150 threshold reached, despite free shipping working correctly at £100 threshold.

## Debug Logging Added
Added comprehensive console logging to track gift configuration flow:

1. **Gift Product Configuration** (app-embed.liquid):
   - `🎁 GIFT PRODUCT CONFIGURED` - Shows product details from theme editor
   - `⚠️ NO GIFT PRODUCT SELECTED` - Appears if gift_product field empty

2. **Threshold Creation** (app-embed.liquid):
   - `✅ GIFT THRESHOLD CONFIGURED` - Shows threshold object created
   - `❌ GIFT THRESHOLD NOT CONFIGURED` - Shows why threshold wasn't created

3. **Auto-Add Process** (cart-uplift.js):
   - `🎁 Gift threshold check starting` - Shows enableGiftGating status
   - `🎁 Parsed gift thresholds` - Shows threshold array
   - `🎁 Checking threshold` - Compares cart total vs threshold
   - `🎁 Adding new gift to cart` - Confirms auto-add triggered

## Testing Steps

### Step 1: Verify Theme Editor Configuration
1. Go to Shopify Admin → Online Store → Themes → Customize
2. Open theme editor and find "App embeds" section
3. Click on "Cart Uplift" app embed
4. Check these settings:
   - **Incentive type**: Should be "Free shipping + Gifts" or "Just gifts"
   - **Gift product**: Should have "Air Max Lilac" selected
   - **Gift unlock amount**: Should be 150

### Step 2: Check Browser Console
1. Open your store in a new browser tab
2. Open browser developer console (F12 or right-click → Inspect)
3. Go to "Console" tab
4. Add "Snow Boots" (or any product) to cart to open drawer
5. Look for these logs:

**Expected if configured correctly:**
```
🎁 GIFT PRODUCT CONFIGURED: {
  productId: "12345678",
  handle: "air-max-lilac",
  title: "Air Max Lilac",
  variantId: "45678901",
  threshold: 150,
  incentiveType: "combined"
}

✅ GIFT THRESHOLD CONFIGURED: {
  enableGiftGating: true,
  threshold: { amount: 150, productId: "12345678", ... }
}

🎁 Gift threshold check starting: {
  enableGiftGating: true,
  hasThresholds: true,
  hasCart: true
}

🎁 Checking threshold: Air Max Lilac ($150) - Current: $900 - Reached: true

🎁 Adding new gift to cart
```

**If gift product NOT selected in theme editor:**
```
⚠️ NO GIFT PRODUCT SELECTED in theme editor
```

**If incentive type wrong:**
```
❌ GIFT THRESHOLD NOT CONFIGURED: {
  incentiveType: "free-shipping",
  reason: "Wrong incentive type"
}
```

### Step 3: Fix Based on Console Output

#### If you see "NO GIFT PRODUCT SELECTED":
1. Go back to theme editor
2. In Cart Uplift app embed settings
3. Find "Gift product" field
4. Click to select "Air Max Lilac" product
5. Save theme
6. Refresh your store and test again

#### If you see "Wrong incentive type":
1. Go to theme editor → Cart Uplift settings
2. Change "Incentive type" to either:
   - "Free shipping + Gifts" (if you want both)
   - "Just gifts" (if you only want gift)
3. Save theme
4. Refresh and test

#### If enableGiftGating is false:
- This means the threshold configuration conditional didn't run
- Check that gift_threshold has a value (should be 150)
- Check that incentive_type is "gifts" or "combined"

## Architecture Note
The gift auto-add system works independently from the Settings database:

- **Theme Extension**: Reads `block.settings.gift_product` from Liquid
- **JavaScript**: Creates threshold object from product data
- **Cart Logic**: Auto-adds when threshold reached

The dashboard showing 0% is a separate issue (Settings database empty) and doesn't affect the cart functionality.

## Current Status
- ✅ Schema has correct `gift_product` field (type: "product")
- ✅ Liquid template checks for product and extracts details
- ✅ JavaScript has auto-add logic with comprehensive logging
- ❓ Need to verify product actually selected in theme editor
- ❓ Need to verify incentive_type is "gifts" or "combined"

## Next Action
Run through testing steps above and share console output to identify where the configuration breaks.
