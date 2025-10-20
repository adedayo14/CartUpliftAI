# Developer Snippets & Utilities

Quick reference for common development tasks in Cart Uplift.

---

## 🔄 Cache Busting (Liquid Theme Extensions)

### Force Browser to Reload CSS/JS Assets

Use this in your Liquid template when changes aren't showing:

```liquid
{%- comment -%} Cache Busting - Forces browser to reload assets {%- endcomment -%}
<link rel="stylesheet" href="{{ 'cart-bundles.css' | asset_url }}?v={{ 'now' | date: '%s' }}">
<script src="{{ 'cart-bundles.js' | asset_url }}?v={{ 'now' | date: '%s' }}" defer></script>
```

**When to use:**
- During development when CSS/JS changes aren't visible
- After deploying major updates
- When users report seeing old styles
- Testing on different devices/browsers

**How it works:**
- `{{ 'now' | date: '%s' }}` generates a Unix timestamp
- Creates unique URL on every page load
- Bypasses browser cache AND Shopify CDN cache

**Production version (with normal caching):**
```liquid
{{ 'cart-bundles.css' | asset_url | stylesheet_tag }}
<script src="{{ 'cart-bundles.js' | asset_url }}" defer></script>
```

**Static version (for specific version):**
```liquid
<link rel="stylesheet" href="{{ 'cart-bundles.css' | asset_url }}?v=3.1.0">
<script src="{{ 'cart-bundles.js' | asset_url }}?v=3.1.0" defer></script>
```

---

## 📦 Shopify Deployment Commands

### Deploy Extension Only
```bash
shopify app deploy --force
```

### Deploy with Clean Cache
```bash
shopify app dev clean && shopify app deploy --force
```

### Full Workflow (Commit + Deploy)
```bash
git add -A && \
git commit -m "feat: your change description" && \
git push origin main && \
shopify app deploy --force
```

---

## 🧪 Testing & Debugging

### Clear All Caches (Browser)
**Chrome/Edge:**
```
Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
→ Select "Cached images and files"
→ Clear data
```

**Hard Reload:**
```
Cmd+Shift+R (Mac) or Ctrl+F5 (Windows)
```

### Check Bundle Rendering
Open DevTools Console (F12) and look for:
```
🎨 Rendering style: clean
📦 Creating products wrapper...
  Product 1: [name] - [variant_id]
✅ Amazon FBT layout complete!
```

### Debug Bundle API
Check Network tab for:
```
/apps/cart-uplift/api/bundles?product_id=XXXXX&_t=timestamp
```

---

## 🎨 Bundle Style Classes

Reference for the 5 bundle display styles:

### 1. Clean/FBT (Amazon Style)
```css
.cartuplift-bundle-clean
  .bundle-products-wrapper
    .cartuplift-clean-item.selected
  .bundle-summary
    .add-bundle-btn
```

### 2. Grid (Checkboxes)
```css
.cartuplift-bundle-grid
  .cartuplift-grid-card.selected
  .cartuplift-quantity-selector
```

### 3. List (Vertical)
```css
.cartuplift-bundle-list
  .cartuplift-list-card
  .cartuplift-list-remove
```

### 4. Detailed/Carousel
```css
.cartuplift-bundle-detailed
  .cartuplift-detailed-images
  .cartuplift-detailed-products
```

### 5. Tier (Quantity Pricing)
```css
.cartuplift-bundle-tiers
  .cartuplift-tier-option.selected
  .cartuplift-tier-badge
```

---

## 💾 Database Quick Commands

### Reset Local DB
```bash
npm run db:reset
```

### Generate Prisma Client
```bash
npm run setup
```

### Push Schema Changes (Production)
```bash
prisma db push
```

### Generate ML Training Data
```bash
npm run ml:seed
```

---

## 🔧 Common Fixes

### Bundle Not Showing
1. Check theme customizer: Add "Smart Bundles" block to product page
2. Clear browser cache (Cmd+Shift+R)
3. Check bundle is assigned to product in admin
4. Verify API call in Network tab
5. Use cache buster in Liquid template

### Changes Not Visible After Deploy
1. Use cache buster snippet (see top of file)
2. Deploy with `--force` flag
3. Clear browser cache
4. Check DevTools for 404s on assets

### Page Goes Blank After Action
- **Fixed in latest version**: Auto-refresh implemented after:
  - Bundle creation (300ms delay)
  - Bundle deletion (300ms delay)
  - Bundle status toggle (300ms delay)
- **Why it happened**: Remix revalidator caused temporary blank state
- **Solution**: Window reload ensures clean UI state
- If still occurs: Check console for errors, manually refresh (Cmd+R)

### "Oops! Something went wrong" Errors
- **Fixed in latest version**: Auto-retry with exponential backoff (3 attempts)
- **Auto-recovery**: Error boundary auto-refreshes page after 3 seconds
- **Manual recovery**: Click "Refresh Now" button
- **Root causes**:
  - Session timeout (most common)
  - Network interruption
  - API rate limiting
- **Prevention**: Auto-retry logic attempts 3 times before showing error
- If persistent: Clear cache, re-login to Shopify, or try different browser

### Dev Server Issues
```bash
# Stop all processes
killall node

# Restart dev server
npm run dev
```

---

## 📝 Git Commit Standards

Follow these patterns for clean git history:

```bash
# Features
git commit -m "feat: add Amazon-style FBT layout"

# Fixes
git commit -m "fix: auto-refresh after bundle deletion"

# Refactoring
git commit -m "refactor: separate CSS from JavaScript"

# Documentation
git commit -m "docs: add cache busting guide"

# Styling
git commit -m "style: improve mobile responsive design"
```

**Keep commits concise** - max 50 characters in subject line.

---

## 🚀 Performance Tips

### Image Optimization
```liquid
{{ product.image | image_url: width: 300 }}
```

### Lazy Loading
```html
<img loading="lazy" src="..." alt="...">
```

### Defer Non-Critical JS
```html
<script src="..." defer></script>
```

### Preload Critical CSS
```liquid
<link rel="preload" href="{{ 'critical.css' | asset_url }}" as="style">
```

---

## 📱 Responsive Testing Breakpoints

```css
/* Desktop */
@media (min-width: 1025px) { }

/* Tablet */
@media (max-width: 1024px) { }

/* Mobile */
@media (max-width: 768px) { }

/* Small Mobile */
@media (max-width: 480px) { }
```

---

## 🔐 Environment Variables

Located in `.env` file:

```bash
SHOPIFY_API_KEY=your_key
SHOPIFY_API_SECRET=your_secret
SCOPES=read_products,write_products,read_orders
DATABASE_URL=postgresql://...
```

**Never commit `.env` to git!**

---

## 📊 Analytics Events

Track bundle interactions:
```javascript
// Add to cart
{ event: 'bundle_add_to_cart', bundle_id, products, total }

// Product selection
{ event: 'bundle_product_toggle', product_id, selected }

// View bundle
{ event: 'bundle_view', bundle_id, style }
```

---

**Last Updated:** October 20, 2025  
**Version:** 3.1.0 - Amazon-style FBT with auto-refresh
