# Vercel 500 Error Fix

## Issue
The app is returning 500 errors when loaded from Shopify Admin because Vercel deployment is failing.

## Error Details
- Error ID: error-1759763163162
- React errors: #418, #425, #423 (component rendering failures)
- Failed resource: `cartuplift.vercel.app/app`

## Root Cause
Likely one of these issues:
1. Missing or incorrect environment variables
2. Prisma client not generated during build
3. Database connection failing
4. Build cache corruption

## Fix Steps

### Step 1: Check Vercel Environment Variables
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Required variables:
```
DATABASE_URL=postgresql://neondb_owner:npg_TZ1gks6xEWID@ep-wild-math-adsbbcxj.us-east-1.aws.neon.tech/neondb?sslmode=require
SHOPIFY_API_KEY=06d17c445a3713f419add1e31894bcc3
SHOPIFY_API_SECRET=[get from Shopify Partner Dashboard]
SCOPES=read_discounts,read_orders,read_products
HOST=[your-vercel-url].vercel.app
```

### Step 2: Clear Build Cache & Redeploy
1. Go to Vercel Dashboard → Deployments
2. Click on latest failed deployment
3. Click "..." menu → "Redeploy"
4. Check "Clear Build Cache"
5. Click "Redeploy"

### Step 3: Check Build Logs
After redeployment, check the build logs for:
- ✅ "Prisma generate" completed
- ✅ "Remix build" completed
- ❌ Any errors related to DATABASE_URL
- ❌ Any Prisma client errors

### Step 4: Force Fresh Build
If still failing, make a dummy change and push:

```bash
# Add a comment to trigger rebuild
echo "# Rebuild trigger $(date)" >> VERCEL_FIX.md
git add .
git commit -m "Force Vercel rebuild"
git push origin main
```

### Step 5: Check Database Connection
Test if Vercel can connect to your Neon database:
1. Go to https://console.neon.tech
2. Check if database is active
3. Verify connection string is correct
4. Check if there are any IP restrictions

## Quick Test After Fix
Once redeployed, test these URLs:
- `https://cartuplift.vercel.app/` - Should show app
- `https://cartuplift.vercel.app/health` - Should return 200 OK with database status
- Load app in Shopify Admin - Should work without 500 error

## Alternative: Emergency Rollback
If you need to quickly restore functionality:
1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment (before the error)
3. Click "..." → "Promote to Production"

## Prevention
To avoid this in future:
1. Always test builds locally: `npm run vercel-build`
2. Keep environment variables synced
3. Monitor Vercel deployment status after each push
4. Use Vercel CLI for deployment testing: `vercel --prod`
