# Prisma Deploy Notes (Vercel)

- The Vercel build uses `npm run vercel-build` which runs `prisma migrate deploy` to apply migrations.
- If you encounter Prisma error P3005 (database schema is not empty), we added a baseline migration:
  - `prisma/migrations/20251004180000_baseline/migration.sql`
- On existing production databases, `migrate deploy` will treat the baseline as applied when your schema matches.
- Docs: https://pris.ly/d/migrate-baseline
