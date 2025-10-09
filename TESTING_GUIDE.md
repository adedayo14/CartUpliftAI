# 🧪 BUNDLES SYSTEM - TESTING GUIDE

## ✅ WHAT'S BEEN BUILT

### Phase 1: Database Schema ✅
- Added 11 new fields to Bundle and BundleProduct models
- **Action Required:** Run migration (see below)

### Phase 2: Backend APIs ✅
- Created `/app/routes/api.bundles.tsx` - Product-specific bundle fetching
- Updated `/app/routes/api.bundle-management.tsx` - Enhanced CRUD operations

### Phase 3: Admin UI ✅
- Enhanced `/app/routes/admin.bundle-management-simple.tsx`
- Added bundle style selector (Grid/FBT/Tier)
- Added quantity tier builder
- Added category selection controls
- Added product assignment picker

### Phase 4: Frontend Renderer ✅
- Updated `/extensions/cart-uplift/assets/bundle-renderer.js`
- Added `renderGridBundle()` - Checkable product cards
- Added `renderFBTBundle()` - Amazon-style FBT
- Added `renderTierBundle()` - Quantity pricing
- Added event handlers for all bundle types
- Updated `/extensions/cart-uplift/assets/cart-uplift.css` - Complete styling

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Run Database Migration
```bash
cd "/Users/dayo/AOV V1/AOV"

# Option A: Automatic migration (if database accessible)
npx prisma migrate dev --name add_bundle_enhancements
npx prisma generate

# Option B: Manual SQL (if Option A fails)
# Copy SQL from: prisma/migrations/manual_add_bundle_enhancements.sql
# Run in your PostgreSQL database console
```

### Step 2: Commit Changes
```bash
git add -A
git commit -m "FEATURE: Enhanced Bundle System - Grid/FBT/Tier Layouts

Phase 1: Database Schema
- Added 8 new fields to Bundle model (assignedProducts, bundleStyle, tierConfig, etc.)
- Added 3 new fields to BundleProduct model (isRemovable, isAnchor, tierPricing)

Phase 2: Backend APIs
- Created api.bundles.tsx for product-specific bundle fetching
- Enhanced api.bundle-management.tsx with new field support
- Integrated with existing ML bundle discovery engine

Phase 3: Admin UI
- Added bundle style selector (Grid/FBT/Tier)
- Added quantity tier builder component
- Added category selection controls
- Added product assignment picker

Phase 4: Frontend Rendering
- Implemented renderGridBundle() - Checkable cards with live totals
- Implemented renderFBTBundle() - Amazon-style frequently bought together
- Implemented renderTierBundle() - Quantity pricing with radio buttons
- Added complete CSS styling for all bundle types
- Integrated with existing cart system

Features:
- ✅ Manual bundles (Amazon FBT-style)
- ✅ Quantity tier pricing (Buy 2, save 10%)
- ✅ Product-specific assignment
- ✅ Grid layout with checkboxes
- ✅ FBT layout with remove buttons
- ✅ AI-powered recommendations fallback
- ✅ Category selection support (foundation)
- ✅ Mobile responsive design

Technical:
- Backward compatible with existing Smart Bundles
- No breaking changes to current functionality
- ML engine already integrated
- Cart integration via Shopify Cart API
"

git push origin main
```

### Step 3: Deploy to Vercel
```bash
# Vercel will auto-deploy on push to main
# Or manually trigger:
vercel --prod
```

---

## 🧪 TESTING CHECKLIST

### Test 1: Create Manual FBT Bundle
1. Go to Admin → Bundle Management
2. Click "Create New Bundle"
3. Fill in:
   - Name: "Complete Your Setup"
   - Bundle Type: "Manual"
   - Bundle Style: "FBT (Frequently Bought Together)"
   - Select 3-4 products
   - Set discount: 15%
4. Click "Select Products" and choose which product pages to show it on
5. Save bundle
6. **Expected:** Bundle created successfully

### Test 2: Create Tier Pricing Bundle
1. Create New Bundle
2. Fill in:
   - Name: "Buy More, Save More"
   - Bundle Type: "Manual"
   - Bundle Style: "Quantity Tiers"
   - Select 1 product
3. Configure tiers:
   - Buy 1: 0% discount
   - Buy 2: 10% discount
   - Buy 5: 20% discount
4. Assign to product page
5. **Expected:** Tier bundle created

### Test 3: Create Grid Bundle
1. Create New Bundle
2. Fill in:
   - Name: "Bundle & Save"
   - Bundle Type: "Manual"
   - Bundle Style: "Grid Layout"
   - Select 4-6 products
   - Set discount: 10%
3. Assign to product
4. **Expected:** Grid bundle created

### Test 4: Frontend - View FBT Bundle
1. Navigate to product page where FBT bundle is assigned
2. Find Smart Bundles block on page
3. **Expected:**
   - Bundle displays in vertical list
   - Current product has checkbox (disabled/checked)
   - Other products have checkboxes (enabled)
   - "Remove" buttons appear on optional items
   - Total price shown
   - "Add Selected to Cart" button appears

### Test 5: Frontend - Test FBT Interaction
1. On FBT bundle:
   - Uncheck an optional item
   - **Expected:** Total price updates
   - Click "Remove" button
   - **Expected:** Item unchecks, price updates
2. Click "Add Selected to Cart"
3. **Expected:**
   - Button shows "Adding..."
   - Success message appears
   - Cart updates with selected items
   - Button shows "✓ Added to Cart"

### Test 6: Frontend - View Tier Bundle
1. Navigate to product with tier bundle
2. **Expected:**
   - Product image centered
   - Radio buttons for each tier
   - First tier selected by default
   - Discount badges visible
   - "Most Popular" tag on 2nd tier
   - Total updates based on selection

### Test 7: Frontend - Test Tier Interaction
1. Select different quantity tiers
2. **Expected:**
   - Total price updates correctly
   - Discount percentage reflected
   - Quantity shown in total
3. Click "Add to Cart"
4. **Expected:**
   - Correct quantity added to cart
   - Price matches selected tier

### Test 8: Frontend - View Grid Bundle
1. Navigate to product with grid bundle
2. **Expected:**
   - Products in grid layout (2-3 columns)
   - Checkboxes on each card
   - Current product marked "Current Item"
   - All items checked by default
   - Total shows full bundle price

### Test 9: Frontend - Test Grid Interaction
1. Uncheck products
2. **Expected:**
   - Total price updates live
   - Discount recalculates
   - Unchecked items don't highlight
3. Recheck items
4. **Expected:** Total updates
5. Click "Add Bundle & Save X%"
6. **Expected:**
   - Only selected items added to cart
   - Success message shown

### Test 10: AI Bundles Fallback
1. Navigate to product with NO manual bundle assigned
2. **Expected:**
   - If AI bundles exist: Shows AI-generated bundle in grid layout
   - If no AI bundles: Block hidden (or shows "No recommendations")

### Test 11: Mobile Responsiveness
1. View bundles on mobile device/emulator
2. **Expected:**
   - FBT: Items stack vertically, images smaller
   - Grid: 2 columns max
   - Tier: Product image scales down
   - All buttons full-width
   - Touch targets adequate

### Test 12: Cart Integration
1. Add bundle to cart
2. Open cart drawer (if you have one)
3. **Expected:**
   - All bundle items appear
   - Prices correct
   - Can modify quantities
   - Checkout works

---

## 🐛 TROUBLESHOOTING

### Issue: "Property does not exist" TypeScript Errors
**Solution:** Run `npx prisma generate` after migration

### Issue: Bundle Not Showing on Product Page
**Checklist:**
1. Is Smart Bundles enabled in Settings?
2. Is bundle status "Active"?
3. Is product assigned to bundle?
4. Is Smart Bundles block added to theme?
5. Check browser console for errors

### Issue: "Can't reach database server"
**Solution:**
1. Check if Neon database is online
2. Verify `DATABASE_URL` in `.env`
3. Try manual SQL migration
4. Check network/firewall

### Issue: Styles Not Applying
**Solution:**
1. Hard refresh browser (Cmd+Shift+R)
2. Check if `cart-uplift.css` loaded in Network tab
3. Verify bundle HTML has correct classes

### Issue: Add to Cart Fails
**Checklist:**
1. Check browser console for errors
2. Verify variant IDs are valid
3. Check Shopify Cart API response
4. Ensure products are published/available

---

## 📊 API ENDPOINTS

### GET /api/bundles
**Query Params:**
- `product_id` - Shopify product ID
- `context` - "product" | "collection" | "cart"

**Response:**
```json
{
  "success": true,
  "bundles": [
    {
      "id": "bundle-123",
      "name": "Complete Your Setup",
      "bundleStyle": "fbt",
      "products": [...],
      "discount_percent": 15,
      ...
    }
  ],
  "source": "manual" | "ai" | "none"
}
```

### POST /api/bundle-management
**Actions:**
- `create-bundle` - Create new bundle
- `update-bundle` - Update existing
- `delete-bundle` - Delete bundle
- `toggle-status` - Activate/pause

**Payload (create-bundle):**
```json
{
  "action": "create-bundle",
  "name": "Bundle Name",
  "bundleType": "manual",
  "bundleStyle": "grid",
  "discountValue": 15,
  "productIds": "[\"123\", \"456\"]",
  "assignedProducts": "[\"789\"]",
  "tierConfig": "[{\"qty\": 1, \"discount\": 0}]"
}
```

---

## 🎯 SUCCESS CRITERIA

✅ **Phase 1-4 Complete When:**
- [ ] Database migration runs successfully
- [ ] Prisma client regenerates without errors
- [ ] Admin can create all 3 bundle types
- [ ] Admin can assign bundles to products
- [ ] Admin can configure tier pricing
- [ ] FBT bundles render correctly on storefront
- [ ] Grid bundles render correctly on storefront
- [ ] Tier bundles render correctly on storefront
- [ ] Checkboxes/radio buttons work
- [ ] Live price calculation works
- [ ] Add to cart succeeds for all types
- [ ] AI bundles fall back when no manual bundles
- [ ] Mobile layout responsive
- [ ] No console errors
- [ ] Cart integrates properly

---

## 📝 KNOWN LIMITATIONS

1. **Product Assignment UI** - Currently uses button placeholder. Full Shopify ResourcePicker would require app bridge integration.

2. **Category Selection** - Backend supports it, but full UI for selecting products from collection needs additional work.

3. **Discount Codes** - Bundles currently use inline pricing. Auto-applying Shopify discount codes would require checkout script integration (Shopify Plus feature).

4. **Bundle Integrity** - Items can be removed from cart individually. To enforce "all or nothing," would need custom cart logic.

5. **Variant Selection** - Currently uses first variant. For products with multiple variants, would need variant selector in bundle.

---

## 🚀 NEXT STEPS (Post-Testing)

1. **Test thoroughly** with above checklist
2. **Fix any bugs** discovered
3. **Gather feedback** from users
4. **Iterate** on UI/UX
5. **Add analytics** tracking
6. **Performance optimization**
7. **A/B testing** different bundle types

---

## 📞 NEED HELP?

If you encounter issues:
1. Check browser console for errors
2. Check server logs (Vercel dashboard)
3. Verify database migration completed
4. Test API endpoints directly (Postman/curl)
5. Review this testing guide

**All code is ready to deploy and test!** 🎉
