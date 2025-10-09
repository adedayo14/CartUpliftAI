(function(window, document) {
  'use strict';

  try { console.info('[SmartBundles] Asset loaded'); } catch (e) {}

  if (window.CartUpliftSmartBundles) {
    return;
  }

  class BundleManager {
    constructor(config) {
      this.config = Object.assign({
        version: '6.0',
        containerId: null,
        productId: null,
        locale: window.Shopify?.locale || 'en',
        shopCurrency: window.Shopify?.currency?.active || 'USD',
        currentProduct: {},
        themeSettings: {},
        bundleSettings: {},
        design: {}
      }, config || {});

      this.container = null;
      this.bundleSettings = this.config.bundleSettings || {};
      this.themeSettings = this.config.themeSettings || {};
      this.manualHandles = [];
      this.formatter = new Intl.NumberFormat(this.config.locale, {
        style: 'currency',
        currency: this.config.shopCurrency
      });

      try {
        console.info('[SmartBundles] BundleManager constructed', {
          containerId: this.config.containerId,
          productId: this.config.productId,
          locale: this.config.locale,
          currency: this.config.shopCurrency
        });
      } catch (e) {}
    }

    normalizeCents(val) {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return Math.round(val);
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.]/g, '');
        if (cleaned.indexOf('.') >= 0) {
          const dollars = parseFloat(cleaned);
          return isNaN(dollars) ? 0 : Math.round(dollars * 100);
        }
        const asInt = parseInt(cleaned, 10);
        return isNaN(asInt) ? 0 : asInt;
      }
      return 0;
    }

    init() {
      if (!this.config.containerId) {
        console.warn('[SmartBundles] Missing containerId in config');
        return;
      }

      this.container = document.getElementById(this.config.containerId);
      if (!this.container) {
        console.warn('[SmartBundles] Container not found:', this.config.containerId);
        return;
      }

      // Read manual handles from data attribute for client-side manual fallback
      const handlesAttr = this.container.dataset.manualHandles || '';
      this.manualHandles = handlesAttr
        .split(',')
        .map((h) => h.trim())
        .filter((h) => !!h);

      try { console.info('[SmartBundles] init()', { containerFound: !!this.container, manualHandles: this.manualHandles }); } catch (e) {}

  this.applyThemeStyles();
      this.updateLoaderMessage();
      this.ensureProtectionFlags();
      this.loadBundles();

      window.CartUpliftV6Active = true;
      window.CartUpliftHasSmartBundleBlock = true;
    }

    applyThemeStyles() {
      const design = this.config.design || {};
      const colors = design.colors || {};
      const layout = design.layout || {};
      const target = this.container;
      if (!target || !target.style) return;

      const styleMap = {
        '--cu-card-background': colors.cardBackground,
        '--cu-text-color': colors.textColor,
        '--cu-text-muted': colors.textColor,
        '--cu-button-background': colors.buttonBackground,
        '--cu-button-text': colors.buttonTextColor,
        '--cu-border-radius': this.formatPx(layout.borderRadius),
        '--cu-card-padding': this.formatPx(layout.cardPadding),
        '--cu-card-padding-tablet': this.formatPx(layout.cardPaddingTablet),
        '--cu-card-padding-mobile': this.formatPx(layout.cardPaddingMobile)
      };

      Object.entries(styleMap).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        target.style.setProperty(key, value);
      });
    }

    formatPx(value) {
      if (value === undefined || value === null || value === '') return undefined;
      if (typeof value === 'number') {
        return value + 'px';
      }
      if (typeof value === 'string' && value.endsWith('px')) {
        return value;
      }
      return value;
    }

    updateLoaderMessage() {
      const loaderMessage = this.container.querySelector('.smart-bundles-loader p, .smart-bundles-loader span');
      if (loaderMessage && this.themeSettings.loadingMessage) {
        loaderMessage.textContent = this.themeSettings.loadingMessage;
      }
    }

    ensureProtectionFlags() {
      this.container.dataset.cuLock = this.container.dataset.cuLock || '';
    }

    async loadBundles() {
      try {
        console.info('[SmartBundles] loadBundles(): start', {
          manualHandlesCount: this.manualHandles.length,
          hasManualSetting: Array.isArray(this.bundleSettings.manual_bundle_products) && this.bundleSettings.manual_bundle_products.length > 0
        });
        // Priority 1: Manual products via handles from container data
        if (Array.isArray(this.manualHandles) && this.manualHandles.length > 0) {
          console.info('[SmartBundles] Trying manual handles first', this.manualHandles);
          const manualBundlesByHandles = await this.fetchManualProductsByHandles(this.manualHandles);
          if (manualBundlesByHandles.length > 0) {
            console.info('[SmartBundles] Rendering bundle from manual handles');
            this.renderBundle(manualBundlesByHandles[0]);
            return;
          }
          console.info('[SmartBundles] No bundles built from manual handles');
        }

        const manualBundles = this.getManualBundles();
        if (manualBundles.length > 0) {
          console.info('[SmartBundles] Rendering bundle from block manual settings');
          this.renderBundle(manualBundles[0]);
          return;
        }

        const mlBundles = await this.fetchMLBundles();
        if (mlBundles.length > 0) {
          console.info('[SmartBundles] Rendering bundle from ML API');
          this.renderBundle(mlBundles[0]);
          return;
        }

        const recommendations = await this.fetchRecommendations();
        if (recommendations.length > 0) {
          console.info('[SmartBundles] Rendering recommendations bundle');
          this.renderRecommendationsBundle(recommendations);
          return;
        }

        console.info('[SmartBundles] No bundles found, showing empty state');
        this.showEmptyState();
      } catch (error) {
        console.error('[SmartBundles] Error loading bundles:', error);
        this.showEmptyState();
      }
    }

    getManualBundles() {
      const manualProductsSetting = this.bundleSettings.manual_bundle_products;
      if (!manualProductsSetting || !Array.isArray(manualProductsSetting)) {
        return [];
      }

      const currentProductVariant = Array.isArray(this.config.currentProduct.variants)
        ? this.config.currentProduct.variants[0]
        : null;

      const currentProduct = {
        id: this.config.currentProduct.id,
        variant_id: currentProductVariant?.id || this.config.currentProduct.id,
        title: this.config.currentProduct.title,
        price: this.normalizeCents(this.config.currentProduct.price),
        comparePrice: this.normalizeCents(this.config.currentProduct.comparePrice),
        image: this.config.currentProduct.image,
        handle: this.config.currentProduct.handle,
        isCurrentProduct: true,
        variants: this.config.currentProduct.variants
      };

      const additionalProducts = manualProductsSetting
        .filter((p) => p && p.id !== this.config.currentProduct.id)
        .map((p) => ({
          id: p.id,
          variant_id: p.variants && p.variants[0] ? p.variants[0].id : p.id,
          title: p.title,
          price: this.normalizeCents(p.price),
          comparePrice: this.normalizeCents(p.compare_at_price),
          image: p.featured_image,
          handle: p.handle,
          variants: p.variants,
          isCurrentProduct: false
        }));

      const bundleProducts = [currentProduct, ...additionalProducts];
      const totalPrice = bundleProducts.reduce((sum, p) => sum + (this.normalizeCents(p.price) || 0), 0);
      const totalComparePrice = bundleProducts.reduce((sum, p) => sum + (this.normalizeCents(p.comparePrice) || this.normalizeCents(p.price) || 0), 0);
      const discountPercent = totalComparePrice > totalPrice
        ? Math.round(((totalComparePrice - totalPrice) / totalComparePrice) * 100)
        : 0;

      const baseBundle = {
        id: 'manual-bundle',
        name: this.bundleSettings.bundle_title || this.themeSettings.bundleTitle || 'Complete your setup',
        subtitle: this.bundleSettings.bundle_subtitle || this.themeSettings.bundleSubtitle,
        products: bundleProducts,
        bundle_price: totalPrice,
        regular_total: totalComparePrice,
        discount_percent: discountPercent
      };

      const filtered = this.applyMinMaxFilter(baseBundle);
      return filtered ? [filtered] : [];
    }

    async fetchManualProductsByHandles(handles) {
      try {
        console.info('[SmartBundles] fetchManualProductsByHandles()', handles);
        const products = await Promise.all((handles || []).map(async (handle) => {
          if (!handle) return null;
          try {
            const url = `/products/${encodeURIComponent(handle)}.js`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) {
              console.warn('[SmartBundles] Handle fetch failed', { handle, status: res.status });
              return null;
            }
            const p = await res.json();
            // Normalise data; Shopify returns price on variant in cents (often as integer or string)
            const firstVariant = Array.isArray(p.variants) && p.variants[0] ? p.variants[0] : null;
            const variantPrice = this.normalizeCents(firstVariant ? firstVariant.price : 0);
            const variantCompare = this.normalizeCents(firstVariant && firstVariant.compare_at_price ? firstVariant.compare_at_price : null);
            return {
              id: p.id,
              variant_id: firstVariant ? firstVariant.id : p.id,
              title: p.title,
              price: variantPrice || 0,
              comparePrice: variantCompare,
              image: p.featured_image,
              handle: p.handle,
              variants: p.variants,
              isCurrentProduct: false
            };
          } catch (err) {
            console.warn('[SmartBundles] Failed to fetch product by handle:', handle, err);
            return null;
          }
        }));

  const valid = products.filter(Boolean);
  console.info('[SmartBundles] Manual handles fetched products count:', valid.length);
        if (valid.length === 0) return [];

        const currentVariant = Array.isArray(this.config.currentProduct.variants)
          ? this.config.currentProduct.variants[0]
          : null;
        const current = {
          id: this.config.currentProduct.id,
          variant_id: currentVariant?.id || this.config.currentProduct.id,
          title: this.config.currentProduct.title,
          price: this.normalizeCents(this.config.currentProduct.price) || 0,
          comparePrice: this.normalizeCents(this.config.currentProduct.comparePrice) || null,
          image: this.config.currentProduct.image,
          handle: this.config.currentProduct.handle,
          variants: this.config.currentProduct.variants,
          isCurrentProduct: true
        };

        const bundleProducts = [current, ...valid];
        const totalPrice = bundleProducts.reduce((sum, p) => sum + (this.normalizeCents(p.price) || 0), 0);
        const totalComparePrice = bundleProducts.reduce((sum, p) => sum + (this.normalizeCents(p.comparePrice) || this.normalizeCents(p.price) || 0), 0);
        const discountPercent = totalComparePrice > totalPrice
          ? Math.round(((totalComparePrice - totalPrice) / totalComparePrice) * 100)
          : 0;

        const filtered = this.applyMinMaxFilter({
          id: 'manual-bundle',
          name: this.themeSettings.bundleTitle || 'Complete your setup',
          subtitle: this.themeSettings.bundleSubtitle,
          products: bundleProducts,
          bundle_price: totalPrice,
          regular_total: totalComparePrice,
          discount_percent: discountPercent
        });
        const bundles = filtered ? [filtered] : [];
        console.info('[SmartBundles] Built bundle from handles', { products: bundleProducts.length, discountPercent });
        return bundles;
      } catch (error) {
        console.warn('[SmartBundles] Error building manual bundle from handles:', error);
        return [];
      }
    }

    async fetchMLBundles() {
      try {
        const url = '/apps/cart-uplift/api/bundles?product_id=' + this.config.productId + '&context=product';
        console.info('[SmartBundles] fetchMLBundles()', url);
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          console.info('[SmartBundles] ML API returned non-OK', response.status);
          return [];
        }
        const data = await response.json();
        if (!data || !Array.isArray(data.bundles)) {
          console.info('[SmartBundles] ML API returned empty bundles');
          return [];
        }

  const processed = data.bundles.map((bundle) => this.applyMinMaxFilter(this.normaliseBundle(bundle))).filter(Boolean);
  return processed;
      } catch (error) {
        console.warn('[SmartBundles] Failed to fetch ML bundles:', error);
        return [];
      }
    }

    normaliseBundle(bundle) {
      const cloned = Object.assign({}, bundle);
      cloned.products = Array.isArray(bundle.products) ? bundle.products.slice() : [];
      cloned.products = cloned.products.map((p) => ({
        ...p,
        price: this.normalizeCents(p.price),
        comparePrice: this.normalizeCents(p.comparePrice)
      }));

      const hasCurrent = cloned.products.some((p) => p.id === this.config.currentProduct.id);
      if (!hasCurrent) {
        cloned.products.unshift({
          id: this.config.currentProduct.id,
          variant_id: this.config.currentProduct.variants?.[0]?.id || this.config.currentProduct.id,
          title: this.config.currentProduct.title,
          price: this.normalizeCents(this.config.currentProduct.price),
          comparePrice: this.normalizeCents(this.config.currentProduct.comparePrice),
          image: this.config.currentProduct.image,
          isCurrentProduct: true
        });
        cloned.regular_total = (this.normalizeCents(cloned.regular_total) || 0) + (this.normalizeCents(this.config.currentProduct.comparePrice) || this.normalizeCents(this.config.currentProduct.price) || 0);
        cloned.bundle_price = (this.normalizeCents(cloned.bundle_price) || 0) + (this.normalizeCents(this.config.currentProduct.price) || 0);
      } else {
        cloned.products = cloned.products.map((p) => Object.assign({}, p, {
          isCurrentProduct: p.id === this.config.currentProduct.id
        })).sort((a, b) => {
          if (a.isCurrentProduct) return -1;
          if (b.isCurrentProduct) return 1;
          return 0;
        });
      }

      return cloned;
    }

    async fetchRecommendations() {
      try {
        const url = '/recommendations/products.json?product_id=' + this.config.productId + '&limit=2';
        console.info('[SmartBundles] fetchRecommendations()', url);
        const response = await fetch(url);
        if (!response.ok) {
          console.info('[SmartBundles] Recommendations returned non-OK', response.status);
          return [];
        }

        const data = await response.json();
        const products = Array.isArray(data) ? data : (data.products || []);
        console.info('[SmartBundles] Recommendations count', products.length);

        const current = {
          id: this.config.currentProduct.id,
          title: this.config.currentProduct.title,
          price: this.normalizeCents(this.config.currentProduct.price),
          compare_at_price: this.normalizeCents(this.config.currentProduct.comparePrice),
          featured_image: this.config.currentProduct.image,
          handle: this.config.currentProduct.handle,
          variants: this.config.currentProduct.variants,
          isCurrentProduct: true
        };

        const rest = products.slice(0, 2).map((p) => Object.assign({}, p, {
          isCurrentProduct: false,
          price: this.normalizeCents(p.price),
          compare_at_price: this.normalizeCents(p.compare_at_price)
        }));
        return [current, ...rest];
      } catch (error) {
        console.warn('[SmartBundles] Failed to fetch recommendations:', error);
        return [];
      }
    }

    renderBundle(bundle) {
      if (!this.container) return;

      this.currentBundle = bundle; // store for recalculations
      this.container.classList.remove('loading');
      this.container.classList.add('loaded');
      this.container.dataset.cuLock = 'manual';
      this.container.dataset.cuManualRendered = 'true';
      window.CartUpliftManualGuard = true;

      this.container.classList.remove('cu-layout-horizontal', 'cu-layout-vertical', 'cu-no-wrap');
      const layout = this.bundleSettings.bundle_layout || this.themeSettings.bundleLayout || 'horizontal';
      this.container.classList.add('cu-layout-' + layout);

      if (this.themeSettings.singleRow === true) {
        this.container.classList.add('cu-no-wrap');
      }

      const showPlus = (this.bundleSettings.show_plus_separator !== undefined)
        ? this.bundleSettings.show_plus_separator
        : (this.themeSettings.showPlusSeparator !== undefined ? this.themeSettings.showPlusSeparator : true);
  const itemsHtml = bundle.products.map((product, index) => this.renderBundleItem(product, layout, showPlus && index < bundle.products.length - 1)).join('');

      const bundlePriceInDollars = (bundle.bundle_price || 0) / 100;
      const regularPriceInDollars = (bundle.regular_total || 0) / 100;
      const hasDiscount = bundle.discount_percent > 0;

      const savingsAmount = Math.max(regularPriceInDollars - bundlePriceInDollars, 0);
      const savingsTextTemplate = this.themeSettings.savingsLabel || 'You save {amount}';
      const savingsText = savingsTextTemplate.replace('{amount}', this.formatter.format(savingsAmount));
      const savingsBadge = hasDiscount
        ? `<div class="cu-savings-badge"><span class="cu-savings-badge__text">${savingsText}</span></div>`
        : '';

      const totalSection = regularPriceInDollars > bundlePriceInDollars
        ? `<div class="cu-total">
            <span class="cu-total__label">Total Price:</span>
            <span class="cu-total__price">${this.formatter.format(bundlePriceInDollars)}</span>
            <span class="cu-total__price--original">${this.formatter.format(regularPriceInDollars)}</span>
          </div>`
        : `<div class="cu-total">
            <span class="cu-total__label">Total Price:</span>
            <span class="cu-total__price">${this.formatter.format(bundlePriceInDollars)}</span>
          </div>`;

      const subtitle = (bundle.subtitle || this.themeSettings.bundleSubtitle)
        ? `<p class="cart-uplift-bundle__subtitle">${bundle.subtitle || this.themeSettings.bundleSubtitle}</p>`
        : '';

      const buttonText = this.getButtonText(bundle.discount_percent);

      const discountField = (this.themeSettings.discountCode && this.themeSettings.discountCode.length > 0)
        ? `<div class="cu-discount-note">Discount code <strong>${this.themeSettings.discountCode}</strong> will be applied at checkout.</div>`
        : '';

      const bundleHtml = `
        <div class="cart-uplift-bundle">
          <div class="cart-uplift-bundle__content">
            <div class="cart-uplift-bundle__header">
              <h3 class="cart-uplift-bundle__title">${bundle.name || this.bundleSettings.bundle_title || 'Get the Collection!'}</h3>
              ${subtitle}
            </div>
            <div class="cu-grid">${itemsHtml}</div>
            <div class="cu-bundle-footer">
              ${savingsBadge}
              ${totalSection}
              ${discountField}
              <button class="cart-uplift-bundle__cta" data-bundle-id="${bundle.id}">
                ${buttonText}
              </button>
            </div>
          </div>
        </div>`;

      console.info('[SmartBundles] Rendering bundle HTML into container');
      this.container.innerHTML = bundleHtml;
      this.attachVariantChangeListeners(bundle);
      this.attachToggleListeners(bundle);
      this.attachEventListeners(bundle);
      this.protectContent(bundle);
    }

  renderBundleItem(product, layout, includePlus) {
      // Ensure product prices are normalized before rendering
      product.price = this.normalizeCents(product.price);
      if (product.comparePrice !== undefined && product.comparePrice !== null) {
        product.comparePrice = this.normalizeCents(product.comparePrice);
      }
      const priceInDollars = (product.price || 0) / 100;
      const comparePriceInDollars = product.comparePrice ? product.comparePrice / 100 : null;
      let priceHtml = '';
      if (this.themeSettings.showIndividualPrices !== false) {
        priceHtml = comparePriceInDollars && comparePriceInDollars > priceInDollars
          ? `<div class="cu-item__price-group">
              <span class="cu-item__price">${this.formatter.format(priceInDollars)}</span>
              <span class="cu-item__price--original">${this.formatter.format(comparePriceInDollars)}</span>
            </div>`
          : `<div class="cu-item__price-group">
              <span class="cu-item__price">${this.formatter.format(priceInDollars)}</span>
            </div>`;
      }

      const variantSelector = (product.variants && product.variants.length > 1 && !product.isCurrentProduct)
        ? this.renderVariantSelector(product)
        : '';

      const imageMarkup = `<div class="cu-item__image-wrap">
          <img class="cu-item__image" src="${product.image || this.getPlaceholderImage(product.title)}" alt="${product.title || ''}" loading="lazy">
        </div>`;

      let itemContent;
      if (layout === 'vertical') {
        itemContent = `${imageMarkup}
          <div class="cu-item__content">
            <div class="cu-item__title">${product.title || ''}</div>
            ${priceHtml}
            ${variantSelector}
          </div>`;
      } else {
        itemContent = `${imageMarkup}
          <div class="cu-item__title">${product.title || ''}</div>
          ${priceHtml}
          ${variantSelector}`;
      }

      const toggle = this.themeSettings.allowRemoveItems && !product.isCurrentProduct
        ? `<label class="cu-item__toggle"><input type="checkbox" class="cu-item__include" data-product-id="${product.id}" checked> Include</label>`
        : '';

      const contentWithToggle = `${itemContent}${toggle}`;

      let wrapper;
      if (product.isCurrentProduct) {
        wrapper = `<div class="cu-item cu-item--current" data-product-id="${product.id}">${contentWithToggle}</div>`;
      } else if (this.themeSettings.allowRemoveItems) {
        wrapper = `<div class="cu-item" data-product-id="${product.id}">${contentWithToggle}</div>`;
      } else {
        wrapper = `<a class="cu-item" href="/products/${product.handle || ''}" data-product-id="${product.id}">${contentWithToggle}</a>`;
      }

      return includePlus ? `${wrapper}<div class="cu-plus">+</div>` : wrapper;
    }

    getButtonText(discountPercent) {
      const template = this.themeSettings.ctaButtonText || 'Add Bundle & Save';
      if (template.indexOf('{discount}') > -1) {
        const replacement = discountPercent > 0 ? discountPercent + '%' : '';
        return template.replace('{discount}', replacement).replace('  ', ' ').trim();
      }
      return template;
    }

    protectContent(bundle) {
      this.container.style.setProperty('display', 'block', 'important');
      this.container.style.setProperty('visibility', 'visible', 'important');
      this.container.style.setProperty('opacity', '1', 'important');
      this.container.dataset.bundleCache = JSON.stringify(bundle);

      if (!this.container.__cuProtectionObserver) {
        const observer = new MutationObserver(() => {
          try {
            const hasContent = !!this.container.querySelector('.cart-uplift-bundle');
            const computed = window.getComputedStyle(this.container);
            const isHidden = this.container.hidden || computed.display === 'none';

            if (isHidden) {
              this.container.hidden = false;
              this.container.style.setProperty('display', 'block', 'important');
              this.container.style.setProperty('visibility', 'visible', 'important');
              this.container.style.setProperty('opacity', '1', 'important');
            }

            if (!hasContent && this.container.dataset.cuLock === 'manual') {
              const cached = JSON.parse(this.container.dataset.bundleCache || '{}');
              if (cached && cached.id) {
                this.renderBundle(cached);
              }
            }
          } catch (error) {
            console.warn('[SmartBundles] Protection observer error:', error);
          }
        });

        observer.observe(this.container, {
          childList: true,
          attributes: true,
          attributeFilter: ['style', 'hidden', 'class']
        });

        this.container.__cuProtectionObserver = observer;
      }
    }

    renderVariantSelector(product) {
      const options = product.variants.map((variant) => `<option value="${variant.id}">${variant.title}</option>`).join('');
      return `<select class="cu-item__variant-select" data-product-id="${product.id}">${options}</select>`;
    }

    renderRecommendationsBundle(products) {
      const totalPrice = products.reduce((sum, p) => sum + (this.normalizeCents(p.price) || 0), 0);
      const totalComparePrice = products.reduce((sum, p) => sum + (this.normalizeCents(p.compare_at_price) || this.normalizeCents(p.price) || 0), 0);
      const discountPercent = totalComparePrice > totalPrice
        ? Math.round(((totalComparePrice - totalPrice) / totalComparePrice) * 100)
        : 10;

      const bundle = {
        id: 'recommendations-bundle',
        name: this.bundleSettings.bundle_title || 'Save 10%, Make it a Bundle',
        subtitle: 'Frequently bought together',
        products: products.map((p) => Object.assign({}, p, {
          price: this.normalizeCents(p.price),
          comparePrice: this.normalizeCents(p.compare_at_price),
          image: p.featured_image
        })),
        bundle_price: Math.round(totalPrice * 0.9),
        regular_total: totalComparePrice,
        discount_percent: discountPercent
      };

      const filtered = this.applyMinMaxFilter(bundle);
      if (filtered && filtered.products && filtered.products.length > 0) {
        this.renderBundle(filtered);
      } else {
        this.showEmptyState();
      }
    }

    attachEventListeners(bundle) {
      const button = this.container.querySelector('[data-bundle-id]');
      if (!button) return;

      button.addEventListener('click', async (event) => {
        event.preventDefault();
        button.disabled = true;
        button.classList.add('cart-uplift-bundle__cta--loading');

        try {
          const items = bundle.products.map((product) => {
            // If allowRemoveItems is on and checkbox is unchecked, skip this product
            if (this.themeSettings.allowRemoveItems && !product.isCurrentProduct) {
              const includeToggle = this.container.querySelector(`.cu-item__include[data-product-id="${product.id}"]`);
              if (includeToggle && !includeToggle.checked) {
                return null;
              }
            }

            const select = this.container.querySelector(`[data-product-id="${product.id}"] select`);
            const variantId = select ? parseInt(select.value, 10) : parseInt(product.variant_id || product.id, 10);
            return {
              id: variantId,
              quantity: 1
            };
          }).filter((item) => item && item.id && !isNaN(item.id));

          if (items.length === 0) {
            throw new Error('No valid products in bundle');
          }

          const body = { items };
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(body)
          });

          if (!response.ok) {
            throw new Error('Failed to add bundle to cart');
          }

          button.textContent = '✓ Added to Cart';
          document.dispatchEvent(new CustomEvent('cart:updated'));

          if (window.Shopify && window.Shopify.onItemAdded) {
            window.Shopify.onItemAdded(await response.json());
          }

          // If a discount code is configured, redirect to apply it on the cart
          if (this.themeSettings.autoApplyDiscounts !== false && this.themeSettings.discountCode && this.themeSettings.discountCode.length > 0) {
            const code = encodeURIComponent(this.themeSettings.discountCode);
            window.location.href = `/discount/${code}?redirect=/cart`;
            return;
          }

          setTimeout(() => {
            button.textContent = this.getButtonText(bundle.discount_percent);
            button.disabled = false;
          }, 2000);
        } catch (error) {
          console.error('[SmartBundles] Error adding bundle to cart:', error);
          button.textContent = 'Failed - Try Again';
          setTimeout(() => {
            button.textContent = this.getButtonText(bundle.discount_percent);
            button.disabled = false;
          }, 2000);
        } finally {
          button.classList.remove('cart-uplift-bundle__cta--loading');
        }
      });
    }

    attachToggleListeners(bundle) {
      const toggles = Array.from(this.container.querySelectorAll('.cu-item__include'));
      if (toggles.length === 0) return;

      const recalc = () => this.recalculateTotals();
      toggles.forEach((chk) => chk.addEventListener('change', recalc));
      // Initial compute in case defaults change
      this.recalculateTotals();
    }

    attachVariantChangeListeners(bundle) {
      const selects = Array.from(this.container.querySelectorAll('.cu-item__variant-select'));
      if (selects.length === 0) return;

      selects.forEach((sel) => {
        sel.addEventListener('change', (e) => {
          const productId = parseInt(sel.dataset.productId, 10);
          const variantId = parseInt(sel.value, 10);
          const prod = (this.currentBundle?.products || []).find((p) => p.id === productId);
          if (!prod) return;
          prod.variant_id = variantId;

          // Try to find variant details to update price/compare
          const variant = Array.isArray(prod.variants) ? prod.variants.find((v) => parseInt(v.id, 10) === variantId) : null;
          if (variant) {
            const priceCents = this.normalizeCents(variant.price);
            const compareCents = variant.compare_at_price ? this.normalizeCents(variant.compare_at_price) : null;
            if (!isNaN(priceCents)) prod.price = priceCents;
            if (!isNaN(compareCents)) prod.comparePrice = compareCents; else prod.comparePrice = null;

            // Update UI price for this item
            const itemEl = this.container.querySelector(`.cu-item[data-product-id="${productId}"]`) || this.container.querySelector(`.cu-item--current[data-product-id="${productId}"]`);
            if (itemEl) {
              const priceGroup = itemEl.querySelector('.cu-item__price-group');
              if (priceGroup) {
                const priceInDollars = (prod.price || 0) / 100;
                const compareInDollars = prod.comparePrice ? prod.comparePrice / 100 : null;
                priceGroup.innerHTML = compareInDollars && compareInDollars > priceInDollars
                  ? `<span class="cu-item__price">${this.formatter.format(priceInDollars)}</span><span class="cu-item__price--original">${this.formatter.format(compareInDollars)}</span>`
                  : `<span class="cu-item__price">${this.formatter.format(priceInDollars)}</span>`;
              }
            }
          }

          this.recalculateTotals();
        });
      });
    }

    recalculateTotals() {
      const bundle = this.currentBundle;
      if (!bundle) return;

      // Build set of excluded product IDs from unchecked toggles
      const excluded = new Set();
      if (this.themeSettings.allowRemoveItems) {
        const toggles = Array.from(this.container.querySelectorAll('.cu-item__include'));
        toggles.forEach((chk) => {
          const pid = parseInt(chk.dataset.productId, 10);
          if (!chk.checked) excluded.add(pid);
        });
      }

  const selected = (bundle.products || []).filter((p) => p.isCurrentProduct || !excluded.has(p.id));
  const totalCents = selected.reduce((sum, p) => sum + (this.normalizeCents(p.price) || 0), 0);
  const compareCents = selected.reduce((sum, p) => sum + (this.normalizeCents(p.comparePrice) || this.normalizeCents(p.price) || 0), 0);
      const total = totalCents / 100;
      const compare = compareCents / 100;
      const hasDiscount = compare > total;
      const discountPercent = hasDiscount ? Math.round(((compare - total) / compare) * 100) : 0;

      // Update footer totals
      const priceEl = this.container.querySelector('.cu-total__price');
      const originalEl = this.container.querySelector('.cu-total__price--original');
      if (priceEl) priceEl.textContent = this.formatter.format(total);
      if (originalEl) originalEl.textContent = this.formatter.format(compare);

      // Update savings badge
      const badge = this.container.querySelector('.cu-savings-badge');
      if (badge) {
        if (hasDiscount) {
          const amountVal = Math.max(compare - total, 0);
          const amount = this.formatter.format(amountVal);
          const pct = discountPercent + '%';
          const format = this.themeSettings.savingsFormat || 'both';
          let computed = '';
          if (format === 'amount') computed = amount;
          else if (format === 'percentage') computed = pct;
          else computed = amount + ' / ' + pct;
          const textTemplate = this.themeSettings.savingsLabel || 'You save {amount}';
          const text = textTemplate.replace('{amount}', computed);
          const textEl = badge.querySelector('.cu-savings-badge__text');
          if (textEl) textEl.textContent = text;
          badge.style.display = '';
        } else {
          badge.style.display = 'none';
        }
      }

      // Update CTA label to reflect new discount percent
      const cta = this.container.querySelector('.cart-uplift-bundle__cta');
      if (cta) {
        cta.textContent = this.getButtonText(discountPercent);
        // Disable CTA if nothing besides possibly current product is selected
        const selectableCount = (bundle.products || []).filter((p) => !p.isCurrentProduct).length;
        const selectedCount = selected.filter((p) => !p.isCurrentProduct).length;
        const disable = selectableCount > 0 && selectedCount === 0;
        cta.disabled = disable;
        cta.classList.toggle('cart-uplift-bundle__cta--disabled', disable);
      }
    }

    applyMinMaxFilter(bundle) {
      if (!bundle || !Array.isArray(bundle.products)) return bundle;
      const min = parseInt(this.themeSettings.minBundleProducts || 0, 10) || 0;
      const max = parseInt(this.themeSettings.maxBundleProducts || 0, 10) || 0;
      let prods = bundle.products.slice();
      if (max > 0 && prods.length > max) {
        const current = prods.find((p) => p.isCurrentProduct);
        const rest = prods.filter((p) => !p.isCurrentProduct).slice(0, Math.max(max - (current ? 1 : 0), 0));
        prods = current ? [current, ...rest] : rest;
      }
      if (min > 0 && prods.length < min) {
        if ((this.themeSettings.fallbackBehavior || 'manual') === 'hide') {
          return null;
        }
      }
      const total = prods.reduce((s, p) => s + (this.normalizeCents(p.price) || 0), 0);
      const compare = prods.reduce((s, p) => s + (this.normalizeCents(p.comparePrice) || this.normalizeCents(p.price) || 0), 0);
      return { ...bundle, products: prods, bundle_price: total, regular_total: compare, discount_percent: compare > total ? Math.round(((compare - total)/compare) * 100) : 0 };
    }

    showEmptyState() {
      console.info('[SmartBundles] showEmptyState()');
      this.container.classList.remove('loading');
      this.container.classList.add('loaded', 'empty');
      this.container.innerHTML = `
        <div class="smart-bundles-empty">
          <p>${this.themeSettings.emptyMessage || 'No recommendations available at this time'}</p>
        </div>`;
    }

    getPlaceholderImage(title) {
      const shortTitle = (title || 'Product').slice(0, 10);
      return 'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>
          <rect width='100%' height='100%' fill='#f8f8f8'/>
          <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            fill='#999' font-family='Arial' font-size='14'>${shortTitle}</text>
        </svg>`
      );
    }
  }

  const instances = {};
  const initialQueue = Array.isArray(window.CartUpliftSmartBundleQueue)
    ? window.CartUpliftSmartBundleQueue.slice()
    : [];
  try { console.info('[SmartBundles] Initial queue size:', initialQueue.length); } catch (e) {}

  function scheduleInit(config) {
    if (!config || !config.containerId) return;
    if (instances[config.containerId]) {
      return;
    }

    const launch = () => {
      const manager = new BundleManager(config);
      manager.init();
      instances[config.containerId] = manager;
    };

    if (document.readyState === 'loading') {
      console.info('[SmartBundles] scheduleInit(): DOM not ready, deferring for', config.containerId);
      document.addEventListener('DOMContentLoaded', launch, { once: true });
    } else {
      console.info('[SmartBundles] scheduleInit(): launching now for', config.containerId);
      requestAnimationFrame(launch);
    }
  }

  initialQueue.forEach(scheduleInit);

  window.CartUpliftSmartBundles = {
    init: scheduleInit,
    instances
  };

  window.CartUpliftSmartBundleQueue = {
    push(config) {
      try { console.info('[SmartBundles] Queue push received', config && config.containerId); } catch (e) {}
      scheduleInit(config);
    }
  };

})(window, document);
