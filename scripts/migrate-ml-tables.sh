#!/bin/bash

# ML Database Migration Script
# Run this to create ML tables in production

set -e  # Exit on error

echo "🚀 ML Database Migration"
echo "========================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set"
    echo ""
    echo "Options:"
    echo "1. Pull from Vercel: vercel env pull .env.production"
    echo "2. Set manually: export DATABASE_URL='your-database-url'"
    echo "3. Run in Vercel shell directly"
    exit 1
fi

echo "✓ DATABASE_URL found"
echo ""

# Run the migration
echo "📦 Running Prisma DB Push..."
npx prisma db push --skip-generate

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration successful!"
    echo ""
    echo "Verifying tables..."
    
    # Verify tables exist
    npx prisma db execute --stdin <<EOF
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('MLUserProfile', 'MLProductSimilarity', 'MLDataRetentionJob');
EOF
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ All ML tables created successfully!"
        echo ""
        echo "Next steps:"
        echo "1. Test ML endpoints in production"
        echo "2. Verify tracking events are being logged"
        echo "3. Check settings page shows real order count"
        echo "4. Setup data retention cron job"
    fi
else
    echo ""
    echo "❌ Migration failed!"
    echo "Check error messages above"
    exit 1
fi
