#!/bin/bash

echo "🔍 Checking which version is deployed..."
echo ""

echo "1️⃣  Check Vercel Production Status:"
echo "Visit: https://vercel.com/adedayo14/cartuplift"
echo "Look for most recent deployment (should be from commit 89b35f1 or ecab49a)"
echo ""

echo "2️⃣  Check if you're viewing Dev Preview:"
echo "In your browser URL bar, look for:"
echo "  - Production: https://admin.shopify.com/store/sectionappblocks/apps/cartuplift-2"
echo "  - Dev Preview: URL might have different params or be using tunnel"
echo ""

echo "3️⃣  Force Production Version:"
echo "Run this command to stop dev mode and use production:"
shopify app dev clean
echo ""

echo "4️⃣  After running clean, visit:"
echo "https://admin.shopify.com/store/sectionappblocks/apps/cartuplift-2"
echo ""

echo "5️⃣  Or, to test the latest code immediately in dev mode:"
echo "npm run dev"
echo "Then visit the URL it provides"
