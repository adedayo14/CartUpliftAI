# 📋 SETTINGS REFERENCE GUIDE

## Where to Find Settings

Your CartUplift app has settings in **TWO places**:

1. **🎨 Shopify Theme Editor** (Online Store → Customize Theme)
2. **⚙️ App Settings Page** (Your app admin → Settings)

---

## 🎨 THEME EDITOR SETTINGS (Customize Theme)

**Location:** Shopify Admin → Online Sales Channels → Themes → Customize → Add "Cart Uplift" app block

### What You Should See (24 Settings):

#### **Section 1: Incentive Type**
1. **Incentive mode** (Dropdown)
   - Options: Free Shipping / Gifts / Combined
   - Default: `Free Shipping`

#### **Section 2: Free Shipping Progress**
2. **Show progress bar** (Checkbox)
   - Default: ✅ Checked
3. **Free shipping minimum ($)** (Number)
   - Default: `107`
4. **Progress message** (Text)
   - Default: `"You're {amount} away from free shipping!"`
5. **Success message** (Text)
   - Default: `"🎉 Congratulations! You've unlocked free shipping!"`
6. **Progress bar color** (Color Picker)
   - Default: `#121212` (Black)
7. **Progress bar background** (Color Picker)
   - Default: `#E5E5E5` (Light Gray)

#### **Section 3: Gift with Purchase**
8. **Gift unlock amount ($)** (Number)
   - Default: `150`
9. **Gift product** (Product Picker)
   - Select a product from your store
10. **Message templates (progress | success)** (Text)
    - Default: `"Spend {amount} more to unlock {product}! | 🎉 {product} unlocked!"`
11. **Value message** (Text)
    - Default: `"You're saving {value}!"`
12. **All rewards message** (Text)
    - Default: `"✓ You've saved {value}!"`

#### **Section 4: Product Recommendations**
13. **Heading** (Text)
    - Default: `"YOU MIGHT ALSO LIKE"`
14. **Layout style** (Dropdown)
    - Options: Carousel / List / Grid
    - Default: `Carousel`
15. **Products to load** (Range Slider)
    - Min: 1, Max: 6
    - Default: `3`
16. **Manual product recommendations** (Product List Picker)
    - Select up to 12 products
    - Info: "Selected products only (AI recs off). Ideal for excess stock"
17. **Background color** (Color Picker)
    - Default: `#F3F3F3` (Light Gray)
18. **Let recommendations scroll with cart** (Checkbox)
    - Info: "When off, recommendations stay pinned above cart items"
    - Default: ❌ Unchecked

#### **Section 5: Text Customization**
19. **Uppercase recommendation title** (Checkbox)
    - Makes title all caps
    - Default: ✅ Checked
20. **Promo code link label** (Text)
    - Default: `"+ Got a promotion code?"`
21. **Order note link label** (Text)
    - Default: `"+ Add order notes"`

---

## ⚙️ APP SETTINGS PAGE

**Location:** Your App → Settings (or visit `/app/settings`)

### What You Should See (4 Major Sections):

#### **Section 1: 🚀 Quick Setup**
Content card explaining analytics tracking (no settings here)

#### **Section 2: 🤖 AI-Powered Recommendations** (11 Settings)

**Main Toggle:**
1. **Enable ML Recommendations** (Checkbox)
   - Default: ❌ Unchecked
   - Enables machine learning recommendations

**When Enabled, you'll see:**

2. **ML Personalization Mode** (Dropdown)
   - Options: Basic / Advanced / Custom
   - Default: `Basic`

3. **Privacy Level** (Dropdown)
   - Options: 
     - Basic (Anonymous)
     - Standard (Session-based)
     - Advanced (User tracking)
   - Default: `Basic (Anonymous)`

4. **Advanced Personalization** (Checkbox)
   - Default: ❌ Unchecked
   - Enables cross-session learning

5. **Behavior Tracking** (Checkbox)
   - Default: ❌ Unchecked
   - Tracks user behavior (shows privacy warning)

6. **Data Retention (Days)** (Number Input)
   - Default: `90`
   - How long to keep ML training data

**Data Status Card** (Informational - not a setting)
- Shows order count badge
- Shows data quality badge
- Explains ML modes

**Advanced Recommendation Controls:**

7. **Hide Recommendations After All Thresholds Met** (Checkbox)
   - Default: ❌ Unchecked
   - Collapses recommendations when all goals reached

8. **Enable Threshold-Based Product Suggestions** (Checkbox)
   - Default: ❌ Unchecked
   - Suggests products to help reach thresholds

9. **Threshold Suggestion Strategy** (Dropdown - only if #8 is checked)
   - Options:
     - 🤖 Smart AI Selection
     - 💰 Price-Based Only
     - 🎯 Category Match + Price
     - 🔥 Popular + Price
   - Default: `Smart AI Selection`

#### **Section 3: ✏️ Text & Copy** (5 Settings)

**Gift Settings:**
10. **Gift Price Label** (Text)
    - Default: `"FREE"`
    - Text shown instead of price for free gifts

**Button Labels:**
11. **Checkout Button** (Text)
    - Default: `"CHECKOUT"`
12. **Add Button** (Text)
    - Default: `"Add"`
13. **Apply Button** (Text)
    - Default: `"Apply"`

**Note:** Basic cart text (recommendations title, discount/notes links) is configured in Theme Editor, not here.

---

## 🔍 WHAT YOU SHOULD SEE - CHECKLIST

### ✅ In Shopify Theme Editor (Customize Theme):

When you add the "Cart Uplift" app block, you should see:

```
Cart Uplift App Embed
├── Incentive mode [dropdown]
├── 📦 FREE SHIPPING PROGRESS
│   ├── Show progress bar [checkbox]
│   ├── Free shipping minimum ($) [number]
│   ├── Progress message [text]
│   ├── Success message [text]
│   ├── Progress bar color [color]
│   └── Progress bar background [color]
├── 🎁 GIFT WITH PURCHASE
│   ├── Gift unlock amount ($) [number]
│   ├── Gift product [product picker]
│   ├── Message templates [text]
│   ├── Value message [text]
│   └── All rewards message [text]
├── 🎨 PRODUCT RECOMMENDATIONS
│   ├── Heading [text]
│   ├── Layout style [dropdown]
│   ├── Products to load [slider 1-6]
│   ├── Manual product recommendations [product list]
│   ├── Background color [color]
│   └── Let recommendations scroll with cart [checkbox]
└── ✏️ TEXT CUSTOMIZATION
    ├── Uppercase recommendation title [checkbox]
    ├── Promo code link label [text]
    └── Order note link label [text]
```

**Total: 21 settings** in Theme Editor

---

### ✅ In App Settings Page:

When you go to your app admin and click Settings, you should see:

```
Settings Page (app.settings)
├── 🚀 QUICK SETUP
│   └── [Info card about analytics]
│
├── 🤖 AI-POWERED RECOMMENDATIONS
│   ├── Enable ML Recommendations [checkbox]
│   └── [When checked, shows:]
│       ├── ML Personalization Mode [dropdown]
│       ├── Privacy Level [dropdown]
│       ├── Advanced Personalization [checkbox]
│       ├── Behavior Tracking [checkbox]
│       ├── Data Retention (Days) [number]
│       ├── [Your ML Data Status card - info only]
│       ├── 📦 Advanced Recommendation Controls
│       │   ├── Hide Recommendations After All Thresholds Met [checkbox]
│       │   ├── Enable Threshold-Based Product Suggestions [checkbox]
│       │   └── Threshold Suggestion Strategy [dropdown - conditional]
│       │
├── ✏️ TEXT & COPY
│   ├── 🎁 Gift Settings
│   │   └── Gift Price Label [text]
│   └── 🔘 Button Labels
│       ├── Checkout Button [text]
│       ├── Add Button [text]
│       └── Apply Button [text]
│
└── [Save Settings button - blue, large]
```

**Total: 13 settings** in App Settings (9 main + 4 button/text)

---

## 🚫 SETTINGS YOU WON'T SEE (But Should Exist)

### Smart Bundles Settings (Not in Current UI)

These settings exist in the **database** but aren't exposed in the current Settings UI:

- `enableSmartBundles` (Boolean) - Enable/disable bundles
- `bundlesOnProductPages` (Boolean) - Show on product pages
- `bundlesInCartDrawer` (Boolean) - Show in cart drawer
- `bundlesOnCollectionPages` (Boolean) - Show on collections
- `bundlesOnCartPage` (Boolean) - Show on cart page
- `bundlesOnCheckoutPage` (Boolean) - Show on checkout
- `defaultBundleDiscount` (String) - Default discount %
- `bundleTitleTemplate` (String) - Bundle title template
- `bundleDiscountPrefix` (String) - Discount code prefix
- `bundleConfidenceThreshold` (String) - ML confidence level
- `bundleSavingsFormat` (String) - How to display savings
- `showIndividualPricesInBundle` (Boolean) - Show item prices
- `autoApplyBundleDiscounts` (Boolean) - Auto-apply discounts

**These can be accessed via:**
1. Database directly (Prisma Studio)
2. API endpoint: `/api/settings`
3. Bundle Management page: `/admin/bundle-management-simple`

---

## 💡 KEY DIFFERENCES

### Theme Editor = Visual/Cart Settings
- **Purpose:** Control how the cart drawer looks and behaves
- **Updated:** Instantly (no deploy needed)
- **Scope:** Visual elements, progress bars, gift thresholds
- **User:** Merchants customizing their theme

### App Settings = Advanced/AI Settings
- **Purpose:** Configure ML, personalization, data retention
- **Updated:** On "Save Settings" button click
- **Scope:** Behavior logic, AI features, button text overrides
- **User:** Merchants managing app functionality

---

## 🧪 HOW TO VERIFY

### Test Theme Editor Settings:
1. Go to: **Online Sales Channels → Themes → Customize**
2. Find "Apps" in left sidebar
3. Look for "Cart Uplift" toggle
4. Turn it ON
5. You should see **21 settings** appear below it

### Test App Settings:
1. Go to your app: **https://cartuplift.vercel.app**
2. Click **"Settings"** in left nav menu
3. You should see **4 main sections**:
   - 🚀 Quick Setup (info card)
   - 🤖 AI-Powered Recommendations (11 settings)
   - ✏️ Text & Copy (5 settings)

### Test Bundle Management:
1. Go to: **https://cartuplift.vercel.app/admin/bundle-management-simple**
2. Click **"Create New Bundle"**
3. You should see:
   - Name field
   - Bundle Type dropdown
   - **Bundle Style dropdown** (Grid/FBT/Tier) ⭐ **NEW**
   - Discount field
   - Product selection
   - Tier builder ⭐ **NEW**
   - Product assignment ⭐ **NEW**

---

## ❓ COMMON QUESTIONS

**Q: Where are bundle settings?**
A: They're managed through the Bundle Management page (`/admin/bundle-management-simple`), not the main Settings page.

**Q: I don't see "Smart Bundles" in Settings?**
A: Correct! Bundle features are managed separately. Use the "Manage Products & Bundles" link in the navigation.

**Q: Can I edit bundles in Theme Editor?**
A: No. Bundles are created in the app admin, then automatically display on product pages where assigned.

**Q: How many total settings are there?**
A: 
- Theme Editor: **21 settings**
- App Settings: **13 settings**
- Bundle Management: **11+ fields** per bundle
- Total: **45+ configurable options**

---

**This guide is accurate as of October 7, 2025** ✅
