# Quick ML Migration - Vercel Production

## Your Setup ✅
- Project: **cartuplift** on Vercel
- GitHub: https://github.com/adedayo14/CartUpliftAI.git
- Database: Neon PostgreSQL (connected via Vercel env vars)
- Status: Code deployed, **migration will run on next deployment**

## ✅ READY TO DEPLOY

I've updated your `package.json` vercel-build script to use `prisma db push` which will:
1. Generate Prisma client
2. Push schema changes to your Neon database (creates the 3 ML tables)
3. Build your Remix app

## Run Migration - Single Command

Just push the updated package.json and Vercel will auto-deploy with migration:

```bash
git add package.json QUICK_MIGRATION.md
git commit -m "feat: auto-migrate ML tables on vercel deploy"
git push origin main
```

**That's it!** Vercel will:
1. Detect the push
2. Start building
3. Run `prisma db push` (creates ML tables)
4. Deploy your app

## Monitor the Deployment

1. **Watch Vercel Dashboard**
   - Go to: https://vercel.com/dashboard
   - Select: cartuplift
   - Click: Deployments tab
   - Watch the build logs in real-time

2. **Look for These Log Messages**
   ```
   Running "prisma generate"...
   Running "prisma db push"...
   
   🚀  Your database is now in sync with your Prisma schema.
   ✔ Generated Prisma Client
   ```

3. **Verify Success**
   After deployment completes (~2-3 minutes), the ML tables will be created automatically.

## What Gets Created

Three new tables in your Neon database:
- ✅ `MLUserProfile` - User behavior tracking
- ✅ `MLProductSimilarity` - Product recommendation cache
- ✅ `MLDataRetentionJob` - GDPR compliance

## After Deployment

Test your ML endpoints:

```bash
# Your Vercel app URL (replace with actual)
APP_URL="https://cartuplift.vercel.app"

# Test content recommendations
curl -X POST $APP_URL/api/ml/content-recommendations \
  -H "Content-Type: application/json" \
  -d '{"shop":"your-shop.myshopify.com","product_ids":["123"],"privacy_level":"basic"}'

# Test popular recommendations  
curl -X POST $APP_URL/api/ml/popular-recommendations \
  -H "Content-Type: application/json" \
  -d '{"shop":"your-shop.myshopify.com","privacy_level":"basic"}'
```

## Troubleshooting

**If build fails:**
1. Check Vercel build logs for Prisma errors
2. Verify DATABASE_URL is set in Vercel env vars
3. Check Neon database is active and accessible

**If tables aren't created:**
- Vercel might need DATABASE_URL reconnection
- Check Settings → Environment Variables → DATABASE_URL
- Ensure it starts with `postgresql://`

## Next Steps After Successful Deploy

1. ✅ ML tables created
2. ✅ ML endpoints live
3. ✅ Settings page shows real order count
4. 🔜 Test with your Shopify store
5. 🔜 Monitor tracking events
6. 🔜 Setup data retention cron job

---

**Ready?** Run the commit command above and watch Vercel deploy! 🚀

