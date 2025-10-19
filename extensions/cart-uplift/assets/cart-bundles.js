(function() {
  'use strict';

  console.log('🎁 Cart Uplift Bundles - Module Loaded');

  // ============================================
  // BUNDLE MANAGER - Main Controller
  // ============================================
  class BundleManager {
    constructor() {
      this.bundles = [];
      this.currency = 'USD';
      this.currencySymbols = {
        'USD': '$', 'GBP': '£', 'EUR': '€', 'CAD': '$', 'AUD': '$', 'JPY': '¥', 'INR': '₹',
        'CHF': 'CHF', 'SEK': 'kr', 'NOK': 'kr', 'DKK': 'kr', 'PLN': 'zł', 'CZK': 'Kč',
        'HUF': 'Ft', 'BGN': 'лв', 'RON': 'lei', 'HRK': 'kn', 'RSD': 'din', 'RUB': '₽',
        'BRL': 'R$', 'MXN': '$', 'ARS': '$', 'CLP': '$', 'COP': '$', 'PEN': 'S/',
        'CNY': '¥', 'KRW': '₩', 'THB': '฿', 'VND': '₫', 'MYR': 'RM', 'SGD': '$',
        'PHP': '₱', 'IDR': 'Rp', 'NZD': '$', 'ZAR': 'R', 'ILS': '₪', 'TRY': '₺'
      };
      this.currentProductId = null;
      this.init();
    }

    async init() {
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      const widgets = document.querySelectorAll('[data-bundle-widget]');
      
      if (widgets.length === 0) {
        console.log('🎁 No bundle widgets found');
        return;
      }

      const firstWidget = widgets[0];
      this.currentProductId = firstWidget.dataset.productId;

      if (!this.currentProductId) {
        console.log('🎁 No product ID found');
        widgets.forEach(w => w.style.display = 'none');
        return;
      }

      console.log(`🎁 Loading bundles for product: ${this.currentProductId}`);
      await this.loadBundles();

      widgets.forEach((widget, index) => {
        if (this.bundles.length > 0) {
          this.renderBundlesInWidget(widget, index);
        } else {
          widget.style.display = 'none';
        }
      });

      console.log(`🎁 Initialized ${this.bundles.length} bundle(s)`);
    }

    async loadBundles() {
      try {
        const timestamp = Date.now();
        const apiUrl = `/apps/cart-uplift/api/bundles?product_id=${this.currentProductId}&_t=${timestamp}`;
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          console.warn(`🎁 Failed to load bundles: ${response.status}`);
          return;
        }

        const data = await response.json();
        
        if (data.success && data.bundles) {
          this.bundles = data.bundles;
          this.currency = data.currency || 'USD';
          console.log(`🎁 Loaded ${this.bundles.length} bundles`);
        }
      } catch (error) {
        console.error('🎁 Error loading bundles:', error);
      }
    }

    renderBundlesInWidget(widget, widgetIndex) {
      const loadingEl = widget.querySelector('.cartuplift-bundle-loading');
      if (loadingEl) loadingEl.remove();

      const title = widget.dataset.bundleTitle;
      if (title) {
        const heading = document.createElement('h2');
        heading.className = 'cartuplift-bundles-heading';
        heading.textContent = title;
        widget.appendChild(heading);
      }

      this.bundles.forEach((bundleData, index) => {
        console.log(`🎁 Rendering bundle ${index + 1}: ${bundleData.name} (Style: ${bundleData.bundleStyle || 'clean'})`);
        const bundle = new ProductBundle(widget, bundleData, index, this.currency, this.currencySymbols);
        bundle.init();
      });
    }
  }

  // ============================================
  // PRODUCT BUNDLE - Individual Bundle Instance
  // ============================================
  class ProductBundle {
    constructor(containerElement, bundleData, index, currency = 'USD', currencySymbols = {}) {
      this.containerElement = containerElement;
      this.config = bundleData;
      this.index = index;
      this.currency = currency;
      this.currencySymbol = currencySymbols[currency] || '$';
      this.element = null;
      this.selectedProducts = [];
      this.products = bundleData.products || [];
      this.selectedQuantityTier = null;
      this.productQuantities = {}; // Track quantities for grid style
    }

    init() {
      console.log(`🎁 Initializing: ${this.config.name}`);
      this.createElement();
      this.render();
      this.trackEvent('view');
    }

    createElement() {
      this.element = document.createElement('div');
      this.element.className = 'cartuplift-bundle';
      this.element.dataset.bundleId = this.config.id;
      
      const bundleStyle = this.config.bundleStyle || 'clean';
      if (bundleStyle === 'tier') {
        this.element.classList.add('tier-bundle');
      }

      // Header
      const header = document.createElement('div');
      header.className = 'cartuplift-bundle-header';

      const title = document.createElement('h3');
      title.textContent = this.config.displayTitle || this.config.name;
      header.appendChild(title);

      if (this.config.description) {
        const desc = document.createElement('p');
        desc.textContent = this.config.description;
        header.appendChild(desc);
      }

      this.element.appendChild(header);

      // Products container
      this.container = document.createElement('div');
      this.container.className = 'cartuplift-bundle-products';
      this.element.appendChild(this.container);

      // Footer
      this.footer = document.createElement('div');
      this.footer.className = 'cartuplift-bundle-footer';
      this.element.appendChild(this.footer);

      this.containerElement.appendChild(this.element);
    }

    render() {
      if (this.products.length === 0 && this.config.bundleStyle !== 'tier') {
        this.container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No products available.</p>';
        return;
      }

      const bundleStyle = this.config.bundleStyle || 'clean';
      console.log(`🎨 Rendering style: ${bundleStyle}`);

      // Render based on style - 5 options only
      switch (bundleStyle) {
        case 'clean':
        case 'fbt': // Backward compatibility
          this.renderCleanHorizontal();
          break;
        case 'grid':
          this.renderGridCheckboxes();
          break;
        case 'list':
          this.renderCompactList();
          break;
        case 'detailed':
        case 'carousel': // Backward compatibility
          this.renderDetailedVariants();
          break;
        case 'tier':
          this.renderQuantityTier();
          break;
        default:
          console.warn(`⚠️ Unknown bundle style: ${bundleStyle}, defaulting to 'clean'`);
          this.renderCleanHorizontal();
      }

      this.renderFooter();
    }

    // ========================================
    // STYLE 1: CLEAN HORIZONTAL (Amazon FBT Style)
    // All products in a row with summary on the right
    // ========================================
    renderCleanHorizontal() {
      console.log('🎨 Rendering Amazon-style FBT layout with', this.products.length, 'products');
      
      const container = document.createElement('div');
      container.className = 'cartuplift-bundle-clean';

      // Products wrapper (left side - scrollable on mobile)
      const productsWrapper = document.createElement('div');
      productsWrapper.className = 'bundle-products-wrapper';
      
      console.log('📦 Creating products wrapper...');

      this.products.forEach((product, index) => {
        console.log(`  Product ${index + 1}:`, product.title, '-', product.variant_id);
        
        // Create product card
        const item = document.createElement('div');
        item.className = 'cartuplift-clean-item selected';
        item.dataset.index = index;
        item.dataset.variantId = product.variant_id;

        // Add checkbox for selection
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.dataset.index = index;
        checkbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            item.classList.add('selected');
            this.selectedProducts.push({ ...product, index, quantity: 1 });
          } else {
            item.classList.remove('selected');
            this.selectedProducts = this.selectedProducts.filter(p => p.index !== index);
          }
          this.updateCleanSummary();
        });
        item.appendChild(checkbox);

        // Product image
        if (product.image) {
          const img = document.createElement('img');
          img.src = product.image;
          img.alt = product.title;
          item.appendChild(img);
        }

        // Product title (with "This item:" prefix for first product)
        const title = document.createElement('h4');
        if (index === 0) {
          const strong = document.createElement('strong');
          strong.textContent = 'This item: ';
          title.appendChild(strong);
          title.appendChild(document.createTextNode(product.title));
        } else {
          title.textContent = product.title;
        }
        item.appendChild(title);

        // Product price
        const price = this.createPriceElement(product);
        item.appendChild(price);

        // Make card clickable to toggle checkbox
        item.addEventListener('click', (e) => {
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        });

        productsWrapper.appendChild(item);

        // Add plus separator between products
        if (index < this.products.length - 1) {
          const plus = document.createElement('span');
          plus.className = 'cartuplift-bundle-plus';
          plus.textContent = '+';
          productsWrapper.appendChild(plus);
        }
      });

      container.appendChild(productsWrapper);
      console.log('✅ Products wrapper created with', productsWrapper.children.length, 'children');

      // Summary section (right side)
      const summary = document.createElement('div');
      summary.className = 'bundle-summary';

      // Total price section
      const totalDiv = document.createElement('div');
      totalDiv.className = 'bundle-total';

      const totalLabel = document.createElement('p');
      totalLabel.className = 'total-label';
      totalLabel.textContent = 'Total price:';
      totalDiv.appendChild(totalLabel);

      const totalPrice = document.createElement('p');
      totalPrice.className = 'bundle-total-price';
      totalPrice.id = 'cartuplift-total-price';
      totalDiv.appendChild(totalPrice);

      summary.appendChild(totalDiv);

      // Add to cart button
      const addBtn = document.createElement('button');
      addBtn.className = 'add-bundle-btn';
      addBtn.id = 'cartuplift-add-bundle';
      addBtn.addEventListener('click', () => this.addBundleToCart());
      summary.appendChild(addBtn);

      container.appendChild(summary);
      console.log('✅ Summary section created');
      
      this.container.appendChild(container);
      console.log('✅ Container appended to DOM');

      // Initialize selected products (all selected by default)
      this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i, quantity: 1 }));
      
      // Initial summary update
      this.updateCleanSummary();
      console.log('✅ Amazon FBT layout complete!');
    }

    // Update the summary section for clean style
    updateCleanSummary() {
      const totalPriceEl = document.getElementById('cartuplift-total-price');
      const addBtnEl = document.getElementById('cartuplift-add-bundle');

      if (!totalPriceEl || !addBtnEl) return;

      const selectedCount = this.selectedProducts.length;
      const total = this.calculateTotal();

      // Update total price
      totalPriceEl.textContent = this.formatPrice(total);

      // Update button text
      addBtnEl.disabled = selectedCount === 0;
      addBtnEl.textContent = selectedCount > 0 
        ? `Add all ${selectedCount} to Cart` 
        : 'Add to Cart';
    }

    // ========================================
    // STYLE 2: GRID WITH CHECKBOXES
    // Like "Pick 3 products" with quantities
    // ========================================
    renderGridCheckboxes() {
      const type = this.config.type || 'manual';
      const isChoosable = type === 'choose_x_from_y' || type === 'category';

      if (isChoosable) {
        const selectMinQty = this.config.selectMinQty || 2;
        const selectMaxQty = this.config.selectMaxQty || this.products.length;
        
        const prompt = document.createElement('p');
        prompt.className = 'cartuplift-bundle-prompt';
        prompt.textContent = `Pick ${selectMinQty} to ${selectMaxQty} products`;
        this.container.appendChild(prompt);
      }

      const grid = document.createElement('div');
      grid.className = 'cartuplift-bundle-grid';

      this.products.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'cartuplift-grid-card';
        card.dataset.index = index;

        if (isChoosable) {
          card.classList.add('selected');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = true;
          checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
              card.classList.add('selected');
              this.handleProductSelection(product, index, true);
            } else {
              card.classList.remove('selected');
              this.handleProductSelection(product, index, false);
            }
          });
          card.appendChild(checkbox);
        } else {
          card.classList.add('selected');
        }

        if (product.image) {
          const img = document.createElement('img');
          img.src = product.image;
          img.alt = product.title;
          card.appendChild(img);
        }

        const title = document.createElement('h4');
        title.textContent = product.title;
        card.appendChild(title);

        const price = this.createPriceElement(product, 'grid');
        card.appendChild(price);

        // Quantity selector
        const qtySelector = this.createQuantitySelector(product.id);
        card.appendChild(qtySelector);

        grid.appendChild(card);
        this.productQuantities[product.id] = 1;
      });

      this.container.appendChild(grid);
      
      if (!isChoosable) {
        this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i, quantity: 1 }));
      } else {
        this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i, quantity: 1 }));
      }
    }

    // ========================================
    // STYLE 3: COMPACT LIST
    // Vertical stacked with remove buttons
    // ========================================
    renderCompactList() {
      const list = document.createElement('div');
      list.className = 'cartuplift-bundle-list';

      this.products.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'cartuplift-list-card selected';
        card.dataset.index = index;

        if (product.image) {
          const img = document.createElement('img');
          img.src = product.image;
          img.alt = product.title;
          card.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'cartuplift-list-info';

        const title = document.createElement('h4');
        title.textContent = product.title;
        info.appendChild(title);

        const price = this.createPriceElement(product, 'list');
        info.appendChild(price);

        card.appendChild(info);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'cartuplift-list-remove';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', () => {
          card.remove();
          this.selectedProducts = this.selectedProducts.filter(p => p.index !== index);
          this.renderFooter();
        });
        card.appendChild(removeBtn);

        list.appendChild(card);
      });

      this.container.appendChild(list);
      this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i, quantity: 1 }));
    }

    // ========================================
    // STYLE 4: DETAILED WITH VARIANTS
    // Images row + detailed info with variant selectors
    // ========================================
    renderDetailedVariants() {
      const detailedContainer = document.createElement('div');
      detailedContainer.className = 'cartuplift-bundle-detailed';

      // Images row (horizontal scroll on mobile)
      const imagesRow = document.createElement('div');
      imagesRow.className = 'cartuplift-detailed-images';

      this.products.forEach((product, index) => {
        if (product.image) {
          const img = document.createElement('img');
          img.src = product.image;
          img.alt = product.title;
          imagesRow.appendChild(img);

          if (index < this.products.length - 1) {
            const plus = document.createElement('span');
            plus.className = 'plus';
            plus.textContent = '+';
            imagesRow.appendChild(plus);
          }
        }
      });

      detailedContainer.appendChild(imagesRow);

      // Products details (vertical list)
      const productsContainer = document.createElement('div');
      productsContainer.className = 'cartuplift-detailed-products';

      this.products.forEach((product, index) => {
        const item = document.createElement('div');
        item.className = 'cartuplift-detailed-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.addEventListener('change', (e) => {
          this.handleProductSelection(product, index, e.target.checked);
        });
        item.appendChild(checkbox);

        const content = document.createElement('div');
        content.className = 'cartuplift-detailed-content';

        if (index === 0) {
          const thisItem = document.createElement('p');
          thisItem.className = 'this-item';
          thisItem.textContent = 'This item:';
          content.appendChild(thisItem);
        }

        const title = document.createElement('h4');
        title.textContent = product.title;
        content.appendChild(title);

        // Rating (placeholder)
        const rating = document.createElement('div');
        rating.className = 'rating';
        rating.innerHTML = '<span class="stars">★★★★★</span><span class="reviews">(3 Reviews)</span>';
        content.appendChild(rating);

        const price = this.createPriceElement(product, 'detailed');
        content.appendChild(price);

        // Variant selector (if product has variants)
        if (product.variants && product.variants.length > 1) {
          const select = document.createElement('select');
          product.variants.forEach(variant => {
            const option = document.createElement('option');
            option.value = variant.id;
            option.textContent = variant.title || variant.name;
            select.appendChild(option);
          });
          content.appendChild(select);
        }

        item.appendChild(content);
        productsContainer.appendChild(item);
      });

      detailedContainer.appendChild(productsContainer);
      this.container.appendChild(detailedContainer);
      this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i, quantity: 1 }));
    }

    // ========================================
    // STYLE 5: QUANTITY TIER
    // Radio buttons with bulk pricing
    // ========================================
    renderQuantityTier() {
      console.log('🎁 Rendering quantity tier bundle');
      console.log('🎁 Config:', this.config);
      console.log('🎁 Products:', this.products);
      
      const tiers = this.parseTierConfig();
      
      console.log(`🎁 Parsed ${tiers.length} tiers`);
      
      if (tiers.length === 0) {
        console.warn('🎁 No tiers found, showing error message');
        this.container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No quantity tiers configured.</p>';
        return;
      }

      const tierContainer = document.createElement('div');
      tierContainer.className = 'cartuplift-bundle-tiers';

      tiers.forEach((tier, tierIndex) => {
        console.log(`🎁 Creating tier option ${tierIndex + 1}/${tiers.length}:`, tier);
        const option = this.createTierOption(tier, tierIndex, tiers.length);
        tierContainer.appendChild(option);
      });

      this.container.appendChild(tierContainer);
      console.log('🎁 Tier container appended to bundle container');

      // Default select first tier
      if (tiers.length > 0) {
        this.selectedQuantityTier = tiers[0];
        console.log('🎁 Selected first tier:', this.selectedQuantityTier);
        const firstRadio = tierContainer.querySelector('input[type="radio"]');
        if (firstRadio) {
          firstRadio.checked = true;
          firstRadio.closest('.cartuplift-tier-option').classList.add('selected');
          console.log('🎁 First radio button checked');
        }
      }
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    createPriceElement(product, style = 'default') {
      const price = document.createElement('div');
      price.className = 'price';

      const priceValue = product.price / 100;
      
      if (product.comparePrice && product.comparePrice > product.price) {
        const compareValue = product.comparePrice / 100;
        price.innerHTML = `<span class="compare-price">${this.currencySymbol}${compareValue.toFixed(2)}</span>${this.currencySymbol}${priceValue.toFixed(2)}`;
      } else {
        price.textContent = `${this.currencySymbol}${priceValue.toFixed(2)}`;
      }

      return price;
    }

    createQuantitySelector(productId) {
      const selector = document.createElement('div');
      selector.className = 'cartuplift-quantity-selector';

      const minusBtn = document.createElement('button');
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => {
        if (this.productQuantities[productId] > 1) {
          this.productQuantities[productId]--;
          qtySpan.textContent = this.productQuantities[productId];
          this.updateSelectedProductQuantity(productId);
          this.renderFooter();
        }
      });

      const qtySpan = document.createElement('span');
      qtySpan.textContent = '1';

      const plusBtn = document.createElement('button');
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => {
        this.productQuantities[productId]++;
        qtySpan.textContent = this.productQuantities[productId];
        this.updateSelectedProductQuantity(productId);
        this.renderFooter();
      });

      selector.appendChild(minusBtn);
      selector.appendChild(qtySpan);
      selector.appendChild(plusBtn);

      return selector;
    }

    updateSelectedProductQuantity(productId) {
      const product = this.selectedProducts.find(p => p.id === productId);
      if (product) {
        product.quantity = this.productQuantities[productId];
      }
    }

    parseTierConfig() {
      let tiers = [];

      console.log('🎁 Parsing tier config:', {
        hasTiers: !!this.config.tiers,
        tiersIsArray: Array.isArray(this.config.tiers),
        tiers: this.config.tiers,
        hasTierConfig: !!this.config.tierConfig,
        tierConfig: this.config.tierConfig,
        productsLength: this.products.length,
        firstProduct: this.products[0]
      });

      // Parse tiers from config
      if (this.config.tiers && Array.isArray(this.config.tiers)) {
        tiers = this.config.tiers
          .filter(t => t !== null && t !== undefined && t !== '')
          .map(tierStr => {
            const [qty, discount] = String(tierStr).split(':').map(Number);
            return { qty, discount };
          })
          .filter(t => !isNaN(t.qty) && !isNaN(t.discount))
          .sort((a, b) => a.qty - b.qty);
      } else if (this.config.tierConfig) {
        try {
          tiers = JSON.parse(this.config.tierConfig);
        } catch (e) {
          console.error('🎁 Failed to parse tier config:', e);
          return [];
        }
      }

      console.log('🎁 Parsed raw tiers:', tiers);

      // For tier bundles, we need at least ONE product to calculate pricing
      // The tier bundle uses the SAME product repeated at different quantities
      if (tiers.length === 0) {
        console.warn('🎁 No valid tiers found');
        return [];
      }

      // Get base product for pricing calculation
      // For quantity tiers, we typically use the CURRENT product, not bundle products
      let baseProduct = null;
      let basePrice = 0;

      if (this.products && this.products.length > 0) {
        // Use first product from bundle config
        baseProduct = this.products[0];
        basePrice = baseProduct.price;
        console.log('🎁 Using bundle product for tier pricing:', baseProduct.title, basePrice);
      } else {
        // FALLBACK: If no products in bundle, try to get current product from page
        console.warn('🎁 No products in bundle config, attempting to use current product');
        
        // Try to get product from the widget's data attribute
        const widget = document.querySelector('[data-bundle-widget]');
        const productId = widget ? widget.dataset.productId : null;
        
        if (productId) {
          console.warn('🎁 Current product ID available but no product data loaded');
          console.warn('🎁 Backend should include product data in bundle config for tier bundles');
        }
        
        // If still no product, show error
        if (basePrice === 0) {
          console.error('🎁 ❌ Cannot calculate tier pricing: no product data available');
          console.error('🎁 ❌ Backend must include at least 1 product in tier bundle config');
          return [];
        }
      }

      // Calculate pricing for each tier
      const result = tiers.map((tier, index) => {
        const quantity = tier.qty;
        const discount = tier.discount;
        
        const originalTotal = basePrice * quantity;
        const discountedTotal = originalTotal * (1 - discount / 100);
        const savings = originalTotal - discountedTotal;
        const unitPrice = discountedTotal / quantity;
        
        console.log(`🎁 Tier ${index + 1}: qty=${quantity}, discount=${discount}%, original=${this.currencySymbol}${(originalTotal/100).toFixed(2)}, final=${this.currencySymbol}${(discountedTotal/100).toFixed(2)}`);
        
        return {
          quantity,
          discount,
          originalPrice: originalTotal,
          discountedPrice: discountedTotal,
          savings,
          unitPrice,
          label: tier.label || `Buy ${quantity}`,
          description: tier.description || `${quantity} ${quantity === 1 ? 'item' : 'items'}`
        };
      });

      console.log('🎁 Final tier options:', result);
      return result;
    }

    createTierOption(tier, index, totalTiers) {
      const option = document.createElement('div');
      option.className = 'cartuplift-tier-option';
      option.dataset.tierIndex = index;
      
      const isPopular = totalTiers > 2 && index === Math.floor(totalTiers / 2);
      if (isPopular) {
        option.classList.add('popular');
      }

      // Popular badge
      if (isPopular) {
        const badge = document.createElement('span');
        badge.className = 'cartuplift-tier-badge';
        badge.textContent = 'Most Popular';
        option.appendChild(badge);
      }

      // Left side: radio + images + info
      const left = document.createElement('div');
      left.className = 'cartuplift-tier-left';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `bundle-tier-${this.config.id}`;
      radio.value = index;
      radio.className = 'cartuplift-tier-radio';
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.selectedQuantityTier = tier;
          this.selectedProducts = Array(tier.quantity).fill({ ...this.products[0], index: 0, quantity: 1 });
          
          option.parentElement.querySelectorAll('.cartuplift-tier-option').forEach(el => {
            el.classList.remove('selected');
          });
          option.classList.add('selected');
          
          this.renderFooter();
        }
      });
      left.appendChild(radio);

      // Stacked product images
      if (this.products[0] && this.products[0].image) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'cartuplift-tier-images';
        
        const maxImages = Math.min(3, tier.quantity);
        for (let i = 0; i < maxImages; i++) {
          const img = document.createElement('img');
          img.src = this.products[0].image;
          img.alt = this.products[0].title;
          imgContainer.appendChild(img);
        }
        left.appendChild(imgContainer);
      }

      // Tier info
      const info = document.createElement('div');
      info.className = 'cartuplift-tier-info';

      const label = document.createElement('h4');
      label.textContent = tier.label;
      
      if (tier.discount > 0) {
        const discountBadge = document.createElement('span');
        discountBadge.className = 'cartuplift-tier-discount-badge';
        discountBadge.textContent = `-${tier.discount}%`;
        label.appendChild(discountBadge);
      }
      
      info.appendChild(label);

      if (tier.description) {
        const desc = document.createElement('p');
        desc.className = 'cartuplift-tier-description';
        desc.textContent = tier.description;
        info.appendChild(desc);
      }

      left.appendChild(info);
      option.appendChild(left);

      // Right side: pricing
      const right = document.createElement('div');
      right.className = 'cartuplift-tier-right';

      const discountedPrice = document.createElement('p');
      discountedPrice.className = 'cartuplift-tier-price';
      discountedPrice.textContent = `${this.currencySymbol}${(tier.discountedPrice / 100).toFixed(2)}`;
      right.appendChild(discountedPrice);

      if (tier.discount > 0) {
        const originalPrice = document.createElement('p');
        originalPrice.className = 'cartuplift-tier-original-price';
        originalPrice.textContent = `${this.currencySymbol}${(tier.originalPrice / 100).toFixed(2)}`;
        right.appendChild(originalPrice);
      }

      const unitPrice = document.createElement('p');
      unitPrice.className = 'cartuplift-tier-unit-price';
      unitPrice.textContent = `${this.currencySymbol}${(tier.unitPrice / 100).toFixed(2)} each`;
      right.appendChild(unitPrice);

      option.appendChild(right);

      // Click handler
      option.addEventListener('click', (e) => {
        if (e.target !== radio) {
          radio.click();
        }
      });

      return option;
    }

    handleProductSelection(product, index, isChecked) {
      const selectMaxQty = this.config.selectMaxQty || this.config.maxProducts || this.products.length;

      if (isChecked) {
        if (this.selectedProducts.length >= selectMaxQty) {
          alert(`You can only select up to ${selectMaxQty} products`);
          const card = this.container.querySelector(`[data-index="${index}"]`);
          const checkbox = card?.querySelector('input[type="checkbox"]');
          if (checkbox) checkbox.checked = false;
          return;
        }

        this.selectedProducts.push({ ...product, index, quantity: 1 });
      } else {
        this.selectedProducts = this.selectedProducts.filter(p => p.index !== index);
      }

      this.renderFooter();
    }

    // ========================================
    // FOOTER RENDERING
    // ========================================

    renderFooter() {
      if (!this.footer) return;
      this.footer.innerHTML = '';

      const { originalPrice, discountedPrice, savings, savingsPercent } = this.calculatePrices();

      const summary = document.createElement('div');
      summary.className = 'cartuplift-bundle-price-summary';

      const priceInfo = document.createElement('div');
      priceInfo.className = 'cartuplift-price-info';

      if (savings > 0) {
        const savingsBadge = document.createElement('div');
        savingsBadge.className = 'cartuplift-bundle-savings';
        let savingsText = this.config.savingsBadgeText || 'Save {amount}!';
        savingsText = savingsText
          .replace('{amount}', `${this.currencySymbol}${(savings / 100).toFixed(2)}`)
          .replace('{percent}', `${savingsPercent}%`);
        savingsBadge.textContent = savingsText;
        priceInfo.appendChild(savingsBadge);
      }

      const totalLabel = document.createElement('p');
      totalLabel.className = 'label';
      totalLabel.textContent = 'Total price:';
      priceInfo.appendChild(totalLabel);

      const priceDisplay = document.createElement('div');
      priceDisplay.className = 'cartuplift-price-display';

      const finalPrice = document.createElement('span');
      finalPrice.className = 'final-price';
      finalPrice.textContent = `${this.currencySymbol}${(discountedPrice / 100).toFixed(2)}`;
      priceDisplay.appendChild(finalPrice);

      if (savings > 0 && originalPrice > 0) {
        const originalPriceEl = document.createElement('span');
        originalPriceEl.className = 'original-price';
        originalPriceEl.textContent = `${this.currencySymbol}${(originalPrice / 100).toFixed(2)}`;
        priceDisplay.appendChild(originalPriceEl);
      }

      priceInfo.appendChild(priceDisplay);
      summary.appendChild(priceInfo);

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'cartuplift-button-container';

      const button = document.createElement('button');
      button.className = 'cartuplift-bundle-add-button';
      button.textContent = this.config.buttonText || 'Add Bundle to Cart';
      
      const bundleStyle = this.config.bundleStyle || 'clean';
      const selectMinQty = this.config.selectMinQty || this.config.minProducts || 0;
      const selectMaxQty = this.config.selectMaxQty || this.config.maxProducts || this.products.length;
      
      let isValid = true;
      
      if (bundleStyle === 'tier') {
        isValid = this.selectedQuantityTier !== null;
        if (!isValid) {
          button.textContent = 'Select a quantity';
        }
      } else {
        const type = this.config.type || 'manual';
        const isChoosable = type === 'choose_x_from_y' || type === 'category';
        
        if (isChoosable) {
          isValid = this.selectedProducts.length >= selectMinQty && this.selectedProducts.length <= selectMaxQty;
          if (!isValid) {
            button.textContent = `Select ${selectMinQty}-${selectMaxQty} products`;
          }
        } else {
          isValid = this.selectedProducts.length > 0;
        }
      }
      
      button.disabled = !isValid;
      button.addEventListener('click', () => this.addBundleToCart());

      buttonContainer.appendChild(button);
      summary.appendChild(buttonContainer);
      this.footer.appendChild(summary);
    }

    calculatePrices() {
      let originalPrice = 0;
      let discountedPrice = 0;

      const bundleStyle = this.config.bundleStyle || 'clean';
      const discountType = this.config.discountType || 'percentage';
      const discountValue = this.config.discountValue || 0;

      if (bundleStyle === 'tier' && this.selectedQuantityTier) {
        originalPrice = this.selectedQuantityTier.originalPrice;
        discountedPrice = this.selectedQuantityTier.discountedPrice;
      } else {
        this.selectedProducts.forEach(p => {
          const qty = p.quantity || 1;
          originalPrice += p.price * qty;
        });

        if (discountType === 'percentage') {
          discountedPrice = originalPrice * (1 - discountValue / 100);
        } else if (discountType === 'fixed') {
          discountedPrice = originalPrice - (discountValue * 100);
        } else {
          discountedPrice = originalPrice;
        }
      }

      const savings = Math.max(0, originalPrice - discountedPrice);
      const savingsPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

      return {
        originalPrice,
        discountedPrice: Math.max(0, discountedPrice),
        savings,
        savingsPercent
      };
    }

    // ========================================
    // ADD TO CART
    // ========================================

    async addBundleToCart() {
      console.log('🎁 Adding bundle to cart');
      this.trackEvent('add_to_cart');

      const items = [];
      
      this.selectedProducts.forEach(product => {
        const qty = product.quantity || 1;
        
        let variantId = product.variant_id || product.variantId;
        if (!variantId && product.variants && product.variants[0]) {
          variantId = product.variants[0].id;
        } else if (!variantId) {
          variantId = product.id;
        }
        
        const numericVariantId = String(variantId).replace(/[^0-9]/g, '');
        
        items.push({
          id: numericVariantId,
          quantity: qty,
          properties: {
            '_bundle_id': this.config.id,
            '_bundle_name': this.config.name || this.config.displayTitle
          }
        });
      });

      console.log('🎁 Cart items:', items);
      
      try {
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('🎁 Bundle added successfully:', result);
          this.showSuccessMessage();
          
          if (window.cartUpliftDrawer) {
            await window.cartUpliftDrawer.fetchCart();
            window.cartUpliftDrawer.updateDrawerContent();
            window.cartUpliftDrawer.open();
          } else {
            document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', {
              bubbles: true
            }));
          }
        } else {
          throw new Error('Failed to add to cart');
        }
      } catch (error) {
        console.error('🎁 Failed to add bundle:', error);
        alert(`Failed to add bundle to cart: ${error.message}`);
      }
    }

    showSuccessMessage() {
      const message = document.createElement('div');
      message.className = 'cartuplift-bundle-success';
      message.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M9 11L12 14L22 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Bundle added to cart!
      `;
      
      document.body.appendChild(message);
      
      setTimeout(() => {
        message.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => message.remove(), 300);
      }, 3000);
    }

    trackEvent(eventType) {
      const data = {
        bundleId: this.config.id,
        bundleName: this.config.name,
        bundleType: this.config.type || 'manual',
        bundleStyle: this.config.bundleStyle || 'clean',
        event: eventType,
        products: this.selectedProducts.map(p => p.id),
        timestamp: Date.now()
      };

      console.log('🎁 Tracking event:', eventType);

      fetch('/apps/cart-uplift/api/bundle-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      }).catch(err => {
        console.warn('🎁 Failed to track event:', err);
      });
    }
  }

  // ============================================
  // INITIALIZE
  // ============================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.bundleManager = new BundleManager();
    });
  } else {
    window.bundleManager = new BundleManager();
  }

})();