# 🗄️ NEON DATABASE - BUNDLE SCHEMA REFERENCE

## 📊 What You'll See After Migration

### **Bundle Table** (Smart Bundles Main Table)

When you open the `Bundle` table in Neon, you'll see these columns:

| Column Name | Type | Default | Description |
|------------|------|---------|-------------|
| **EXISTING COLUMNS** ||||
| `id` | text | (cuid) | Unique bundle ID |
| `shop` | text | - | Store domain |
| `name` | text | - | Bundle name (e.g., "Complete Your Setup") |
| `description` | text | NULL | Optional description |
| `type` | text | - | "manual", "category", "ai_suggested" |
| `status` | text | "draft" | "draft", "active", "paused" |
| `discountType` | text | "percentage" | "percentage" or "fixed" |
| `discountValue` | double | 0 | Discount amount (15 = 15%) |
| `categoryIds` | text | NULL | JSON array of categories |
| `productIds` | text | - | JSON array of product IDs in bundle |
| `minProducts` | int | 2 | Minimum products required |
| `maxProducts` | int | NULL | Maximum products allowed |
| `aiAutoApprove` | bool | false | Auto-approve AI bundles |
| `aiDiscountMax` | double | NULL | Max discount for AI |
| `totalViews` | int | 0 | Analytics counter |
| `totalAddToCart` | int | 0 | Analytics counter |
| `totalPurchases` | int | 0 | Analytics counter |
| `totalRevenue` | double | 0 | Analytics counter |
| `displayTitle` | text | NULL | Custom storefront title |
| `displayRules` | text | NULL | JSON display conditions |
| `createdAt` | timestamp | now() | Creation date |
| `updatedAt` | timestamp | now() | Last update |
| **NEW COLUMNS** ⭐ ||||
| `assignedProducts` | text | NULL | **JSON array of product IDs where bundle shows** |
| `bundleStyle` | text | "grid" | **"grid" \| "fbt" \| "tier"** - Display layout |
| `selectMinQty` | int | NULL | **Category: Min items to select** |
| `selectMaxQty` | int | NULL | **Category: Max items to select** |
| `tierConfig` | text | NULL | **JSON array of quantity tiers** |
| `allowDeselect` | bool | true | **FBT: Can users uncheck items?** |
| `mainProductId` | text | NULL | **FBT: Anchor product ID** |
| `hideIfNoML` | bool | false | **Hide if no ML recommendations** |

---

### **BundleProduct Table** (Bundle Items/Products)

| Column Name | Type | Default | Description |
|------------|------|---------|-------------|
| **EXISTING COLUMNS** ||||
| `id` | text | (cuid) | Unique ID |
| `bundleId` | text | - | Foreign key to Bundle |
| `productId` | text | - | Shopify product ID |
| `variantId` | text | NULL | Specific variant ID |
| `position` | int | 0 | Order in bundle |
| `required` | bool | false | Required vs optional |
| `productTitle` | text | NULL | Cached product name |
| `productHandle` | text | NULL | Cached product handle |
| `productPrice` | double | NULL | Cached product price |
| `createdAt` | timestamp | now() | Creation date |
| **NEW COLUMNS** ⭐ ||||
| `isRemovable` | bool | true | **Can user uncheck in FBT/grid?** |
| `isAnchor` | bool | false | **Is this the main/current product?** |
| `tierPricing` | text | NULL | **Product-specific tier overrides** |

---

## 🔍 EXAMPLE DATA AFTER MIGRATION

### Example 1: FBT Bundle
```json
{
  "id": "cm123abc456",
  "shop": "your-store.myshopify.com",
  "name": "Complete Your Setup",
  "type": "manual",
  "status": "active",
  "bundleStyle": "fbt",  // ⭐ NEW
  "discountValue": 15,
  "productIds": "[\"123\", \"456\", \"789\"]",
  "assignedProducts": "[\"123\"]",  // ⭐ NEW - Show on product 123
  "mainProductId": "123",  // ⭐ NEW - Product 123 is anchor
  "allowDeselect": true  // ⭐ NEW - Users can uncheck items
}
```

### Example 2: Tier Pricing Bundle
```json
{
  "id": "cm456def789",
  "name": "Buy More, Save More",
  "bundleStyle": "tier",  // ⭐ NEW
  "productIds": "[\"555\"]",
  "assignedProducts": "[\"555\"]",  // ⭐ NEW
  "tierConfig": "[{\"qty\":1,\"discount\":0},{\"qty\":2,\"discount\":10},{\"qty\":5,\"discount\":20}]"  // ⭐ NEW
}
```

### Example 3: Grid Bundle
```json
{
  "id": "cm789ghi012",
  "name": "Bundle & Save",
  "bundleStyle": "grid",  // ⭐ NEW (default)
  "productIds": "[\"100\", \"200\", \"300\", \"400\"]",
  "assignedProducts": "[\"100\", \"200\"]",  // ⭐ NEW - Show on products 100 & 200
  "discountValue": 10
}
```

---

## ✅ HOW TO VERIFY MIGRATION WORKED

### In Neon Console:

1. **Open Neon Console** → Your Project → `neondb`
2. **Click "Tables"** in sidebar
3. **Click "Bundle"** table
4. **Check columns list** - You should see:
   ```
   ✓ assignedProducts
   ✓ bundleStyle
   ✓ selectMinQty
   ✓ selectMaxQty
   ✓ tierConfig
   ✓ allowDeselect
   ✓ mainProductId
   ✓ hideIfNoML
   ```

5. **Click "BundleProduct"** table
6. **Check columns list** - You should see:
   ```
   ✓ isRemovable
   ✓ isAnchor
   ✓ tierPricing
   ```

7. **Check Indexes** - Should see:
   ```
   ✓ Bundle_shop_status_idx (on shop, status)
   ```

---

## 🚀 RUNNING MIGRATION VIA VERCEL

Since your Neon database is connected to Vercel, here's how to migrate:

### Option 1: Vercel CLI (Recommended)
```bash
cd "/Users/dayo/AOV V1/AOV"

# Pull environment variables from Vercel
vercel env pull .env.vercel

# Use Vercel's DATABASE_URL
export $(cat .env.vercel | xargs)

# Run migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Option 2: Direct SQL in Neon Console
```bash
# 1. Copy SQL from: prisma/migrations/manual_add_bundle_enhancements.sql
# 2. Go to: Neon Console → SQL Editor
# 3. Paste and execute
# 4. Run locally: npx prisma generate
```

---

## 📝 MIGRATION SQL (For Reference)

The migration adds these exact SQL commands:

```sql
-- Add 8 new columns to Bundle table
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "assignedProducts" TEXT;
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "bundleStyle" TEXT NOT NULL DEFAULT 'grid';
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "selectMinQty" INTEGER;
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "selectMaxQty" INTEGER;
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "tierConfig" TEXT;
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "allowDeselect" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "mainProductId" TEXT;
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "hideIfNoML" BOOLEAN NOT NULL DEFAULT false;

-- Add 3 new columns to BundleProduct table
ALTER TABLE "BundleProduct" ADD COLUMN IF NOT EXISTS "isRemovable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BundleProduct" ADD COLUMN IF NOT EXISTS "isAnchor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BundleProduct" ADD COLUMN IF NOT EXISTS "tierPricing" TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS "Bundle_shop_status_idx" ON "Bundle"("shop", "status");
```

---

## 🎯 WHAT THIS ENABLES

After migration, you can create bundles with:

✅ **Product Assignment** - Show specific bundles on specific product pages
✅ **Display Styles** - Choose Grid/FBT/Tier layout per bundle
✅ **Quantity Tiers** - "Buy 2 save 10%, Buy 5 save 20%"
✅ **FBT Control** - Amazon-style with removable items
✅ **Category Selection** - "Choose 5 items from 20" (foundation ready)
✅ **AI Fallback** - Show AI bundles when no manual bundle assigned

---

## 🐛 TROUBLESHOOTING

### "Column already exists" errors?
✅ **This is OK!** The SQL uses `IF NOT EXISTS` so it's safe to run multiple times.

### "Cannot connect to database"?
1. Check Vercel dashboard for correct DATABASE_URL
2. Ensure DATABASE_URL has `?pgbouncer=true&connection_limit=1` parameters
3. Try running from Vercel CLI instead of local

### Prisma Client errors after migration?
```bash
# Regenerate Prisma client
npx prisma generate
```

---

**Ready to migrate? Use Option 1 (Vercel CLI) or Option 2 (Neon SQL Editor) above!** 🚀
