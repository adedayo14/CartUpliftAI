# CRITICAL: Vercel Database Connection Pool Fix

## Problem
```
Timed out fetching a new connection from the connection pool
Connection limit: 5 (Neon free tier maximum)
```

## Root Cause
Vercel serverless functions don't properly close database connections, exhausting the Neon connection pool.

## SOLUTION: Update DATABASE_URL with Connection Pooling

### Step 1: Get Pooled Connection String from Neon

1. Go to https://console.neon.tech
2. Navigate to your project: `neondb`
3. Click on **"Connection Details"**
4. **IMPORTANT**: Select **"Pooled connection"** (NOT Direct connection)
5. Copy the connection string - it should include `?sslmode=require&pgbouncer=true`

Example format:
```
postgresql://neondb_owner:npg_TZ1gks6xEWID@ep-wild-math-adsbbcxj-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true
```

Notice the difference:
- ❌ Direct: `ep-wild-math-adsbbcxj.us-east-1.aws.neon.tech` (causes timeouts)
- ✅ Pooled: `ep-wild-math-adsbbcxj-pooler.us-east-1.aws.neon.tech` (works with serverless)

### Step 2: Update Vercel Environment Variable

1. Go to Vercel Dashboard: https://vercel.com
2. Select your project: `cart-uplift-app`
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL`
5. Click **Edit**
6. Replace with the **POOLED** connection string from Step 1
7. Make sure it includes:
   - `-pooler` in the hostname
   - `?sslmode=require` parameter
   - Optionally add `&pgbouncer=true&connection_limit=1`

### Step 3: Optimal Connection String Parameters

Use this format for best performance:
```
postgresql://neondb_owner:npg_TZ1gks6xEWID@ep-wild-math-adsbbcxj-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1&pool_timeout=10
```

Parameters explained:
- `sslmode=require` - Secure connection (required by Neon)
- `pgbouncer=true` - Use connection pooler
- `connection_limit=1` - Each Prisma Client uses max 1 connection (Vercel serverless best practice)
- `pool_timeout=10` - Wait 10 seconds for connection (prevents immediate failures)

### Step 4: Redeploy

After updating the environment variable:
1. Go to **Deployments** tab
2. Click "..." on latest deployment
3. Select **"Redeploy"**
4. Check **"Clear Build Cache"**
5. Click **"Redeploy"**

### Step 5: Verify Fix

Test the health endpoint:
```bash
curl https://cartuplift.vercel.app/health
```

Should return:
```json
{
  "status": "ok",
  "database": {
    "connected": true
  }
}
```

## Alternative: Upgrade Neon Plan

If you continue to have connection issues:
- Free tier: 5 connections max
- Pro tier: 100+ connections
- Consider upgrading at https://console.neon.tech/app/projects

## Code Changes Applied

This commit includes:
- ✅ Optimized `db.server.ts` with proper connection management
- ✅ Graceful disconnection on serverless function termination
- ✅ Single connection per Prisma Client instance
- ✅ Proper cleanup on process exit

## Prevention

The code now:
1. Creates only 1 Prisma Client per serverless function
2. Properly disconnects when function terminates
3. Reuses connections in development
4. Logs connection errors for debugging

## Testing Checklist

After deploying:
- [ ] `/health` endpoint returns 200 OK
- [ ] No connection pool timeout errors in Vercel logs
- [ ] Shopify admin loads without 500 errors
- [ ] Cart extension works on storefront
- [ ] Dashboard displays data correctly
