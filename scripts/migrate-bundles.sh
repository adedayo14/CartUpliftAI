#!/bin/bash

# 🚀 Bundle System - Database Migration Script
# Run this after code is deployed to Vercel

set -e  # Exit on error

echo "🗄️  Migrating Neon Database via Vercel..."
echo ""

# Step 1: Pull Vercel environment variables
echo "📥 Step 1: Pulling Vercel environment variables..."
vercel env pull .env.vercel --yes

if [ ! -f .env.vercel ]; then
    echo "❌ Error: Failed to pull .env.vercel"
    exit 1
fi

echo "✅ Environment variables pulled"
echo ""

# Step 2: Load environment variables
echo "🔧 Step 2: Loading DATABASE_URL..."
export $(grep DATABASE_URL .env.vercel | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in .env.vercel"
    exit 1
fi

echo "✅ DATABASE_URL loaded"
echo ""

# Step 3: Run Prisma migration
echo "🔄 Step 3: Running Prisma migration..."
npx prisma migrate deploy

echo "✅ Migration complete"
echo ""

# Step 4: Generate Prisma Client
echo "🔨 Step 4: Generating Prisma Client..."
npx prisma generate

echo "✅ Prisma Client generated"
echo ""

# Step 5: Verify migration
echo "🔍 Step 5: Verifying migration..."
echo "Opening Prisma Studio to verify new columns..."
echo ""
echo "Check that Bundle table has these new columns:"
echo "  ✓ assignedProducts"
echo "  ✓ bundleStyle"
echo "  ✓ selectMinQty"
echo "  ✓ selectMaxQty"
echo "  ✓ tierConfig"
echo "  ✓ allowDeselect"
echo "  ✓ mainProductId"
echo "  ✓ hideIfNoML"
echo ""
echo "Check that BundleProduct table has:"
echo "  ✓ isRemovable"
echo "  ✓ isAnchor"
echo "  ✓ tierPricing"
echo ""

read -p "Open Prisma Studio to verify? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma studio
fi

echo ""
echo "🎉 Migration complete!"
echo ""
echo "Next steps:"
echo "1. Go to your app: https://cartuplift.vercel.app/admin/bundle-management-simple"
echo "2. Create a test bundle with one of the new styles (Grid/FBT/Tier)"
echo "3. Assign it to a product page"
echo "4. Test on your storefront"
echo ""
