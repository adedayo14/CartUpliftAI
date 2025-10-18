(function() {
  'use strict';

  console.log('🎁 Cart Uplift Bundles - Standalone Module Loaded');

  // Bundle Manager - Handles all bundle blocks on the page
  class BundleManager {
    constructor() {
      this.bundles = [];
      this.currentProductId = null;
      this.init();
    }

    async init() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Find bundle widget containers
      const widgets = document.querySelectorAll('[data-bundle-widget]');
      
      if (widgets.length === 0) {
        console.log('🎁 No bundle widgets found on this page');
        return;
      }

      // Get current product ID from widget
      const firstWidget = widgets[0];
      this.currentProductId = firstWidget.dataset.productId;

      if (!this.currentProductId) {
        console.log('🎁 No product ID found, hiding bundle widgets');
        widgets.forEach(w => w.style.display = 'none');
        return;
      }

      console.log(`🎁 Loading bundles for product: ${this.currentProductId}`);

      // Fetch bundles from backend API
      await this.loadBundles();

      // Render bundles in each widget container
      widgets.forEach((widget, index) => {
        if (this.bundles.length > 0) {
          this.renderBundlesInWidget(widget, index);
        } else {
          widget.style.display = 'none';
        }
      });

      console.log(`🎁 Initialized ${this.bundles.length} bundle(s) on this page`);
    }

    async loadBundles() {
      try {
        // Call backend API to get bundles for this product
        const apiUrl = `/apps/cart-uplift/api/bundles?product_id=${this.currentProductId}`;
        console.log(`🎁 Fetching bundles from: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          console.warn(`🎁 Failed to load bundles: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.warn('🎁 Error response:', errorText);
          return;
        }

        const data = await response.json();
        console.log('🎁 API Response:', data);
        
        if (data.success && data.bundles) {
          this.bundles = data.bundles;
          console.log(`🎁 Loaded ${this.bundles.length} bundles from backend:`, this.bundles);
        } else {
          console.log('🎁 No bundles returned or API returned error:', data);
        }
      } catch (error) {
        console.error('🎁 Error loading bundles:', error);
      }
    }

    renderBundlesInWidget(widget, widgetIndex) {
      const loadingEl = widget.querySelector('.cartuplift-bundle-loading');
      if (loadingEl) loadingEl.remove();

      const title = widget.dataset.bundleTitle;

      // Add section title if provided
      if (title) {
        const heading = document.createElement('h2');
        heading.className = 'cartuplift-bundles-heading';
        heading.textContent = title;
        heading.style.cssText = 'margin: 0 0 24px 0; font-size: 28px; font-weight: 700; text-align: center;';
        widget.appendChild(heading);
      }

      // Render each bundle
      this.bundles.forEach((bundleData, index) => {
        const bundle = new ProductBundle(widget, bundleData, index);
        bundle.init();
      });
    }
  }

  // Individual Product Bundle
  class ProductBundle {
    constructor(containerElement, bundleData, index) {
      this.containerElement = containerElement;
      this.config = bundleData;
      this.index = index;
      this.element = null;
      this.selectedProducts = [];
      this.products = bundleData.products || [];
      this.selectedQuantityTier = null;
    }

    async init() {
      console.log(`🎁 Initializing bundle: ${this.config.name}`, this.config);

      // Create bundle DOM element
      this.createElement();

      // Render based on bundle type and style
      this.render();

      // Track view event
      this.trackEvent('view');
    }

    createElement() {
      this.element = document.createElement('div');
      this.element.className = 'cartuplift-bundle';
      this.element.dataset.bundleId = this.config.id;
      
      const bundleStyle = this.config.bundleStyle || 'fbt';
      const isQuantityTier = bundleStyle === 'tier';
      
      this.element.style.cssText = `
        margin-bottom: 40px; 
        padding: ${isQuantityTier ? '32px' : '24px'}; 
        border: ${isQuantityTier ? '2px' : '1px'} solid #e0e0e0; 
        border-radius: 12px; 
        background: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      `;

      // Bundle header
      const header = document.createElement('div');
      header.className = 'cartuplift-bundle-header';
      header.style.cssText = 'margin-bottom: 24px; text-align: center;';

      const title = document.createElement('h3');
      title.textContent = this.config.displayTitle || this.config.name;
      title.style.cssText = 'margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1a1a1a;';
      header.appendChild(title);

      if (this.config.description) {
        const desc = document.createElement('p');
        desc.textContent = this.config.description;
        desc.style.cssText = 'margin: 0; font-size: 15px; color: #666; line-height: 1.5;';
        header.appendChild(desc);
      }

      this.element.appendChild(header);

      // Products container
      const container = document.createElement('div');
      container.className = 'cartuplift-bundle-products';
      this.element.appendChild(container);
      this.container = container;

      // Footer container
      const footer = document.createElement('div');
      footer.className = 'cartuplift-bundle-footer';
      this.element.appendChild(footer);
      this.footer = footer;

      // Add to parent
      this.containerElement.appendChild(this.element);
    }

    render() {
      if (this.products.length === 0) {
        this.container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No products available for this bundle.</p>';
        return;
      }

      const bundleStyle = this.config.bundleStyle || 'fbt';
      const bundleType = this.config.type || 'manual';

      // Render based on display style
      switch (bundleStyle) {
        case 'fbt':
          this.renderFBTLayout();
          break;
        case 'grid':
          this.renderGridLayout();
          break;
        case 'list':
          this.renderListLayout();
          break;
        case 'carousel':
          this.renderCarouselLayout();
          break;
        case 'tier':
          this.renderQuantityTierLayout();
          break;
        default:
          this.renderFBTLayout();
      }

      // Render footer (price summary + add button)
      this.renderFooter();
    }

    // STYLE 1: FBT (Frequently Bought Together) - Horizontal with + signs
    renderFBTLayout() {
      const type = this.config.type || 'manual';
      const isChoosable = type === 'choose_x_from_y' || type === 'category';

      const fbtContainer = document.createElement('div');
      fbtContainer.className = 'cartuplift-bundle-fbt';
      fbtContainer.style.cssText = `
        display: flex; 
        align-items: flex-start; 
        gap: 16px; 
        margin: 24px 0; 
        flex-wrap: wrap;
        justify-content: center;
      `;

      this.products.forEach((product, index) => {
        // Product card wrapper with checkbox
        const wrapper = document.createElement('div');
        wrapper.className = 'cartuplift-fbt-item';
        wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; position: relative;';

        // Checkbox (if choosable)
        if (isChoosable) {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'cartuplift-bundle-checkbox';
          checkbox.checked = true; // Default checked
          checkbox.style.cssText = `
            position: absolute; 
            top: 8px; 
            right: 8px; 
            width: 24px; 
            height: 24px; 
            cursor: pointer;
            z-index: 2;
            accent-color: #4CAF50;
          `;
          checkbox.addEventListener('change', (e) => {
            this.handleProductSelection(product, index, e.target.checked);
            card.style.opacity = e.target.checked ? '1' : '0.5';
            card.style.borderColor = e.target.checked ? '#4CAF50' : '#e0e0e0';
          });
          wrapper.appendChild(checkbox);
        }

        const card = this.createFBTProductCard(product, index);
        wrapper.appendChild(card);

        fbtContainer.appendChild(wrapper);

        // Add "+" between items (but not after last)
        if (index < this.products.length - 1) {
          const plus = document.createElement('span');
          plus.className = 'cartuplift-bundle-plus';
          plus.textContent = '+';
          plus.style.cssText = `
            font-size: 32px; 
            font-weight: 700; 
            color: #999;
            align-self: center;
            flex-shrink: 0;
          `;
          fbtContainer.appendChild(plus);
        }
      });

      this.container.appendChild(fbtContainer);

      // Auto-select all products for FBT (manual bundles)
      if (!isChoosable) {
        this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i }));
      } else {
        // For choosable, default to all checked
        this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i }));
      }
    }

    createFBTProductCard(product, index) {
      const card = document.createElement('div');
      card.className = 'cartuplift-fbt-card';
      card.dataset.productId = product.id;
      card.dataset.index = index;
      card.style.cssText = `
        display: flex; 
        flex-direction: column; 
        padding: 16px; 
        border: 2px solid #4CAF50; 
        border-radius: 12px; 
        cursor: pointer; 
        transition: all 0.3s;
        background: white;
        width: 180px;
        text-align: center;
      `;

      // Product image
      if (product.image) {
        const img = document.createElement('img');
        img.src = product.image;
        img.alt = product.title;
        img.style.cssText = `
          width: 100%; 
          aspect-ratio: 1; 
          object-fit: cover; 
          border-radius: 8px; 
          margin-bottom: 12px;
        `;
        card.appendChild(img);
      }

      // Product info
      const info = document.createElement('div');
      info.className = 'cartuplift-fbt-info';

      const title = document.createElement('h4');
      title.textContent = product.title;
      title.style.cssText = `
        margin: 0 0 8px 0; 
        font-size: 14px; 
        font-weight: 600; 
        line-height: 1.3;
        color: #1a1a1a;
        min-height: 36px;
      `;
      info.appendChild(title);

      const price = document.createElement('p');
      price.className = 'cartuplift-bundle-product-price';
      price.style.cssText = 'margin: 0; font-size: 16px; font-weight: 700; color: #1a1a1a;';
      
      const priceValue = product.price / 100;
      price.textContent = `$${priceValue.toFixed(2)}`;
      
      if (product.comparePrice && product.comparePrice > product.price) {
        const compareValue = product.comparePrice / 100;
        price.innerHTML = `
          <span style="text-decoration: line-through; color: #999; margin-right: 6px; font-size: 14px; font-weight: 400;">$${compareValue.toFixed(2)}</span>
          <span style="color: #4CAF50;">$${priceValue.toFixed(2)}</span>
        `;
      }
      
      info.appendChild(price);
      card.appendChild(info);

      return card;
    }

    // STYLE 2: Grid Layout - Selectable grid with checkboxes
    renderGridLayout() {
      const type = this.config.type || 'manual';
      const isChoosable = type === 'choose_x_from_y' || type === 'category';
      
      if (isChoosable) {
        const selectMinQty = this.config.selectMinQty || this.config.minProducts || 2;
        const selectMaxQty = this.config.selectMaxQty || this.config.maxProducts || this.products.length;
        
        const promptEl = document.createElement('p');
        promptEl.className = 'cartuplift-bundle-prompt';
        promptEl.textContent = `Choose ${selectMinQty} to ${selectMaxQty} items`;
        promptEl.style.cssText = 'margin: 0 0 20px 0; font-size: 17px; font-weight: 600; color: #333; text-align: center;';
        this.container.appendChild(promptEl);
      }

      const grid = document.createElement('div');
      grid.className = 'cartuplift-bundle-grid';
      grid.style.cssText = `
        display: grid; 
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); 
        gap: 16px; 
        margin: 20px 0;
      `;

      this.products.forEach((product, index) => {
        const card = this.createGridProductCard(product, index, isChoosable);
        grid.appendChild(card);
      });

      this.container.appendChild(grid);

      // Auto-select for non-choosable
      if (!isChoosable) {
        this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i }));
      }
    }

    createGridProductCard(product, index, isChoosable) {
      const card = document.createElement('div');
      card.className = 'cartuplift-grid-card';
      card.dataset.productId = product.id;
      card.dataset.index = index;
      card.style.cssText = `
        display: flex; 
        flex-direction: column; 
        padding: 12px; 
        border: 2px solid ${isChoosable ? '#e0e0e0' : '#4CAF50'}; 
        border-radius: 8px; 
        cursor: pointer; 
        transition: border-color 0.2s, transform 0.2s;
        background: white;
      `;

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
      });

      // Checkbox
      if (isChoosable) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'cartuplift-bundle-checkbox';
        checkbox.style.cssText = 'width: 20px; height: 20px; cursor: pointer; margin-bottom: 8px; accent-color: #4CAF50;';
        checkbox.addEventListener('change', (e) => {
          this.handleProductSelection(product, index, e.target.checked);
          card.style.borderColor = e.target.checked ? '#4CAF50' : '#e0e0e0';
        });
        card.appendChild(checkbox);
      }

      // Product image
      if (product.image) {
        const img = document.createElement('img');
        img.src = product.image;
        img.alt = product.title;
        img.style.cssText = 'width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; margin-bottom: 8px;';
        card.appendChild(img);
      }

      // Product info
      const title = document.createElement('h4');
      title.textContent = product.title;
      title.style.cssText = 'margin: 0 0 6px 0; font-size: 14px; font-weight: 600; line-height: 1.3; color: #1a1a1a;';
      card.appendChild(title);

      const price = document.createElement('p');
      price.className = 'cartuplift-bundle-product-price';
      price.style.cssText = 'margin: 0; font-size: 15px; font-weight: 600;';
      
      const priceValue = product.price / 100;
      price.textContent = `$${priceValue.toFixed(2)}`;
      
      if (product.comparePrice && product.comparePrice > product.price) {
        const compareValue = product.comparePrice / 100;
        price.innerHTML = `<span style="text-decoration: line-through; color: #999; margin-right: 6px; font-size: 13px;">$${compareValue.toFixed(2)}</span>$${priceValue.toFixed(2)}`;
      }
      
      card.appendChild(price);

      return card;
    }

    // STYLE 3: List Layout - Vertical stacked layout
    renderListLayout() {
      const type = this.config.type || 'manual';
      const isChoosable = type === 'choose_x_from_y' || type === 'category';

      if (isChoosable) {
        const selectMinQty = this.config.selectMinQty || this.config.minProducts || 2;
        const selectMaxQty = this.config.selectMaxQty || this.config.maxProducts || this.products.length;
        
        const promptEl = document.createElement('p');
        promptEl.className = 'cartuplift-bundle-prompt';
        promptEl.textContent = `Choose ${selectMinQty} to ${selectMaxQty} items`;
        promptEl.style.cssText = 'margin: 0 0 20px 0; font-size: 17px; font-weight: 600; color: #333; text-align: center;';
        this.container.appendChild(promptEl);
      }

      const list = document.createElement('div');
      list.className = 'cartuplift-bundle-list';
      list.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin: 20px 0;';

      this.products.forEach((product, index) => {
        const card = this.createListProductCard(product, index, isChoosable);
        list.appendChild(card);
      });

      this.container.appendChild(list);

      // Auto-select for non-choosable
      if (!isChoosable) {
        this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i }));
      }
    }

    createListProductCard(product, index, isChoosable) {
      const card = document.createElement('div');
      card.className = 'cartuplift-list-card';
      card.dataset.productId = product.id;
      card.dataset.index = index;
      card.style.cssText = `
        display: flex; 
        gap: 16px; 
        align-items: center; 
        padding: 16px; 
        border: 2px solid ${isChoosable ? '#e0e0e0' : '#4CAF50'}; 
        border-radius: 8px; 
        cursor: pointer; 
        transition: border-color 0.2s;
        background: white;
      `;

      // Checkbox
      if (isChoosable) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'cartuplift-bundle-checkbox';
        checkbox.style.cssText = 'width: 20px; height: 20px; cursor: pointer; flex-shrink: 0; accent-color: #4CAF50;';
        checkbox.addEventListener('change', (e) => {
          this.handleProductSelection(product, index, e.target.checked);
          card.style.borderColor = e.target.checked ? '#4CAF50' : '#e0e0e0';
        });
        card.appendChild(checkbox);
      }

      // Product image
      if (product.image) {
        const img = document.createElement('img');
        img.src = product.image;
        img.alt = product.title;
        img.style.cssText = 'width: 100px; height: 100px; object-fit: cover; border-radius: 6px; flex-shrink: 0;';
        card.appendChild(img);
      }

      // Product info
      const info = document.createElement('div');
      info.className = 'cartuplift-list-info';
      info.style.cssText = 'flex: 1;';

      const title = document.createElement('h4');
      title.textContent = product.title;
      title.style.cssText = 'margin: 0 0 8px 0; font-size: 16px; font-weight: 600; line-height: 1.3; color: #1a1a1a;';
      info.appendChild(title);

      const price = document.createElement('p');
      price.className = 'cartuplift-bundle-product-price';
      price.style.cssText = 'margin: 0; font-size: 17px; font-weight: 700;';
      
      const priceValue = product.price / 100;
      price.textContent = `$${priceValue.toFixed(2)}`;
      
      if (product.comparePrice && product.comparePrice > product.price) {
        const compareValue = product.comparePrice / 100;
        price.innerHTML = `<span style="text-decoration: line-through; color: #999; margin-right: 8px; font-size: 15px;">$${compareValue.toFixed(2)}</span>$${priceValue.toFixed(2)}`;
      }
      
      info.appendChild(price);
      card.appendChild(info);

      return card;
    }

    // STYLE 4: Carousel Layout - Horizontal scrollable
    renderCarouselLayout() {
      const type = this.config.type || 'manual';
      const isChoosable = type === 'choose_x_from_y' || type === 'category';

      if (isChoosable) {
        const selectMinQty = this.config.selectMinQty || this.config.minProducts || 2;
        const selectMaxQty = this.config.selectMaxQty || this.config.maxProducts || this.products.length;
        
        const promptEl = document.createElement('p');
        promptEl.className = 'cartuplift-bundle-prompt';
        promptEl.textContent = `Choose ${selectMinQty} to ${selectMaxQty} items`;
        promptEl.style.cssText = 'margin: 0 0 20px 0; font-size: 17px; font-weight: 600; color: #333; text-align: center;';
        this.container.appendChild(promptEl);
      }

      const carousel = document.createElement('div');
      carousel.className = 'cartuplift-bundle-carousel';
      carousel.style.cssText = `
        display: flex; 
        overflow-x: auto; 
        gap: 16px; 
        margin: 20px 0; 
        scroll-snap-type: x mandatory;
        padding-bottom: 10px;
      `;

      this.products.forEach((product, index) => {
        const card = this.createCarouselProductCard(product, index, isChoosable);
        carousel.appendChild(card);
      });

      this.container.appendChild(carousel);

      // Auto-select for non-choosable
      if (!isChoosable) {
        this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i }));
      }
    }

    createCarouselProductCard(product, index, isChoosable) {
      const card = document.createElement('div');
      card.className = 'cartuplift-carousel-card';
      card.dataset.productId = product.id;
      card.dataset.index = index;
      card.style.cssText = `
        display: flex; 
        flex-direction: column; 
        padding: 12px; 
        border: 2px solid ${isChoosable ? '#e0e0e0' : '#4CAF50'}; 
        border-radius: 8px; 
        cursor: pointer; 
        transition: border-color 0.2s;
        flex: 0 0 180px;
        scroll-snap-align: start;
        background: white;
      `;

      // Checkbox
      if (isChoosable) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'cartuplift-bundle-checkbox';
        checkbox.style.cssText = 'width: 20px; height: 20px; cursor: pointer; margin-bottom: 8px; accent-color: #4CAF50;';
        checkbox.addEventListener('change', (e) => {
          this.handleProductSelection(product, index, e.target.checked);
          card.style.borderColor = e.target.checked ? '#4CAF50' : '#e0e0e0';
        });
        card.appendChild(checkbox);
      }

      // Product image
      if (product.image) {
        const img = document.createElement('img');
        img.src = product.image;
        img.alt = product.title;
        img.style.cssText = 'width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; margin-bottom: 8px;';
        card.appendChild(img);
      }

      // Product info
      const title = document.createElement('h4');
      title.textContent = product.title;
      title.style.cssText = 'margin: 0 0 6px 0; font-size: 14px; font-weight: 600; line-height: 1.3; color: #1a1a1a;';
      card.appendChild(title);

      const price = document.createElement('p');
      price.className = 'cartuplift-bundle-product-price';
      price.style.cssText = 'margin: 0; font-size: 15px; font-weight: 600;';
      
      const priceValue = product.price / 100;
      price.textContent = `$${priceValue.toFixed(2)}`;
      
      if (product.comparePrice && product.comparePrice > product.price) {
        const compareValue = product.comparePrice / 100;
        price.innerHTML = `<span style="text-decoration: line-through; color: #999; margin-right: 6px; font-size: 13px;">$${compareValue.toFixed(2)}</span>$${priceValue.toFixed(2)}`;
      }
      
      card.appendChild(price);

      return card;
    }

    // STYLE 5: Quantity Tier Layout - Radio buttons with tiered pricing
    renderQuantityTierLayout() {
      // Parse tier configuration
      const tiers = this.parseTierConfig();
      
      console.log('🎁 Quantity tiers:', tiers);

      // Tier selection container
      const tierContainer = document.createElement('div');
      tierContainer.className = 'cartuplift-bundle-tiers';
      tierContainer.style.cssText = 'margin-bottom: 24px;';

      tiers.forEach((tier, tierIndex) => {
        const tierOption = this.createTierOption(tier, tierIndex);
        tierContainer.appendChild(tierOption);
      });

      this.container.appendChild(tierContainer);

      // Default select first tier
      if (tiers.length > 0) {
        this.selectedQuantityTier = tiers[0];
        const firstRadio = tierContainer.querySelector('input[type="radio"]');
        if (firstRadio) firstRadio.checked = true;
      }
    }

    parseTierConfig() {
      // Multiple possible formats
      let tiers = [];

      // Format 1: config.tiers array (from your DB)
      if (this.config.tiers && Array.isArray(this.config.tiers)) {
        tiers = this.config.tiers
          .filter(t => t !== null)
          .map(tierStr => {
            const [qty, discount] = tierStr.split(':').map(Number);
            return { qty, discount };
          })
          .sort((a, b) => a.qty - b.qty);
      }
      
      // Format 2: config.tierConfig JSON string
      else if (this.config.tierConfig) {
        try {
          tiers = JSON.parse(this.config.tierConfig);
        } catch (e) {
          console.error('Failed to parse tier config:', e);
        }
      }

      // Calculate pricing for each tier
      return tiers.map(tier => {
        const quantity = tier.qty;
        const discount = tier.discount;
        
        // Assuming first product as base
        const baseProduct = this.products[0];
        const basePrice = baseProduct ? baseProduct.price : 0;
        
        const originalTotal = basePrice * quantity;
        const discountedTotal = originalTotal * (1 - discount / 100);
        const savings = originalTotal - discountedTotal;
        
        return {
          quantity,
          discount,
          originalPrice: originalTotal,
          discountedPrice: discountedTotal,
          savings,
          label: tier.label || `${quantity} ${quantity === 1 ? 'Item' : 'Items'}`
        };
      });
    }

    createTierOption(tier, index) {
      const option = document.createElement('div');
      option.className = 'cartuplift-tier-option';
      option.dataset.tierIndex = index;
      
      const isPopular = index === 1; // Mark middle option as popular
      
      option.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        margin-bottom: 12px;
        border: 2px solid ${isPopular ? '#4CAF50' : '#e0e0e0'};
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        background: ${isPopular ? '#f0f9f4' : 'white'};
        position: relative;
      `;

      // Popular badge
      if (isPopular) {
        const badge = document.createElement('span');
        badge.className = 'cartuplift-tier-badge';
        badge.textContent = 'Most popular';
        badge.style.cssText = `
          position: absolute;
          top: -12px;
          right: 20px;
          background: #4CAF50;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        `;
        option.appendChild(badge);
      }

      // Left side - Radio + Product info
      const left = document.createElement('div');
      left.style.cssText = 'display: flex; align-items: center; gap: 16px; flex: 1;';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `bundle-tier-${this.config.id}`;
      radio.value = index;
      radio.style.cssText = 'width: 24px; height: 24px; cursor: pointer; accent-color: #4CAF50;';
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.selectedQuantityTier = tier;
          this.selectedProducts = Array(tier.quantity).fill({ ...this.products[0], index: 0 });
          
          // Update visual selection
          option.parentElement.querySelectorAll('.cartuplift-tier-option').forEach(el => {
            el.style.borderColor = '#e0e0e0';
            el.style.background = 'white';
          });
          option.style.borderColor = '#4CAF50';
          option.style.background = '#f0f9f4';
          
          this.renderFooter();
        }
      });
      left.appendChild(radio);

      // Product preview images (stacked)
      if (this.products[0] && this.products[0].image) {
        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'display: flex; margin-right: 8px;';
        
        const maxImages = Math.min(2, tier.quantity);
        for (let i = 0; i < maxImages; i++) {
          const img = document.createElement('img');
          img.src = this.products[0].image;
          img.style.cssText = `
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 8px;
            border: 2px solid white;
            margin-left: ${i > 0 ? '-20px' : '0'};
          `;
          imgContainer.appendChild(img);
        }
        left.appendChild(imgContainer);
      }

      // Tier info
      const info = document.createElement('div');
      info.style.cssText = 'flex: 1;';

      const label = document.createElement('h4');
      label.textContent = tier.label;
      label.style.cssText = 'margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #1a1a1a;';
      info.appendChild(label);

      if (tier.discount > 0) {
        const discountBadge = document.createElement('span');
        discountBadge.textContent = `-${tier.discount}%`;
        discountBadge.style.cssText = `
          display: inline-block;
          background: #FF5722;
          color: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 700;
          margin-left: 8px;
        `;
        label.appendChild(discountBadge);
      }

      info.appendChild(label);
      left.appendChild(info);
      option.appendChild(left);

      // Right side - Pricing
      const right = document.createElement('div');
      right.style.cssText = 'text-align: right;';

      const discountedPrice = document.createElement('p');
      discountedPrice.style.cssText = 'margin: 0; font-size: 24px; font-weight: 700; color: #4CAF50;';
      discountedPrice.textContent = `$${(tier.discountedPrice / 100).toFixed(2)}`;
      right.appendChild(discountedPrice);

      if (tier.discount > 0) {
        const originalPrice = document.createElement('p');
        originalPrice.style.cssText = 'margin: 0; font-size: 16px; color: #999; text-decoration: line-through;';
        originalPrice.textContent = `$${(tier.originalPrice / 100).toFixed(2)}`;
        right.appendChild(originalPrice);
      }

      option.appendChild(right);

      // Click handler
      option.addEventListener('click', () => radio.click());

      return option;
    }

    handleProductSelection(product, index, isChecked) {
      const selectMinQty = this.config.selectMinQty || this.config.minProducts || 0;
      const selectMaxQty = this.config.selectMaxQty || this.config.maxProducts || this.products.length;

      if (isChecked) {
        // Check if max selection reached
        if (this.selectedProducts.length >= selectMaxQty) {
          alert(`You can only select up to ${selectMaxQty} products`);
          const card = this.container.querySelector(`[data-index="${index}"]`);
          const checkbox = card?.querySelector('.cartuplift-bundle-checkbox');
          if (checkbox) checkbox.checked = false;
          return;
        }

        // Add to selection
        this.selectedProducts.push({ ...product, index });
        
        // Visual feedback
        const card = this.container.querySelector(`[data-index="${index}"]`);
        if (card) card.style.borderColor = '#4CAF50';
      } else {
        // Remove from selection
        this.selectedProducts = this.selectedProducts.filter(p => p.index !== index);
        
        // Visual feedback
        const card = this.container.querySelector(`[data-index="${index}"]`);
        if (card) card.style.borderColor = '#e0e0e0';
      }

      console.log(`🎁 Selected products: ${this.selectedProducts.length}/${selectMaxQty}`);

      // Update footer
      this.renderFooter();
    }

    renderFooter() {
      if (!this.footer) return;

      this.footer.innerHTML = '';

      // Calculate prices
      const { originalPrice, discountedPrice, savings, savingsPercent } = this.calculatePrices();

      // Price summary container
      const summary = document.createElement('div');
      summary.className = 'cartuplift-bundle-price-summary';
      summary.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px;
        background: #f9f9f9;
        border-radius: 12px;
        margin-top: 24px;
        flex-wrap: wrap;
        gap: 20px;
      `;

      // Left side - Price info
      const priceInfo = document.createElement('div');
      priceInfo.style.cssText = 'flex: 1; min-width: 200px;';

      // Savings badge (if applicable)
      if (savings > 0) {
        const savingsBadge = document.createElement('div');
        savingsBadge.className = 'cartuplift-bundle-savings';
        savingsBadge.style.cssText = `
          display: inline-block;
          background: #FF5722;
          color: white;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 12px;
        `;
        
        let savingsText = this.config.savingsBadgeText || 'Save {amount}!';
        savingsText = savingsText
          .replace('{amount}', `$${(savings / 100).toFixed(2)}`)
          .replace('{percent}', `${savingsPercent}%`);
        
        savingsBadge.textContent = savingsText;
        priceInfo.appendChild(savingsBadge);
      }

      // Total price label
      const totalLabel = document.createElement('p');
      totalLabel.style.cssText = 'margin: 0 0 4px 0; font-size: 14px; color: #666; font-weight: 500;';
      totalLabel.textContent = 'Total price:';
      priceInfo.appendChild(totalLabel);

      // Price display
      const priceDisplay = document.createElement('div');
      priceDisplay.style.cssText = 'display: flex; align-items: baseline; gap: 12px;';

      const finalPrice = document.createElement('span');
      finalPrice.style.cssText = 'font-size: 32px; font-weight: 700; color: #1a1a1a;';
      finalPrice.textContent = `$${(discountedPrice / 100).toFixed(2)}`;
      priceDisplay.appendChild(finalPrice);

      if (savings > 0 && originalPrice > 0) {
        const originalPriceEl = document.createElement('span');
        originalPriceEl.style.cssText = 'font-size: 20px; color: #999; text-decoration: line-through;';
        originalPriceEl.textContent = `$${(originalPrice / 100).toFixed(2)}`;
        priceDisplay.appendChild(originalPriceEl);
      }

      priceInfo.appendChild(priceDisplay);
      summary.appendChild(priceInfo);

      // Right side - Add to cart button
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'flex-shrink: 0;';

      const button = document.createElement('button');
      button.className = 'cartuplift-bundle-add-button';
      button.textContent = this.config.buttonText || 'Add Bundle to Cart';
      button.style.cssText = `
        padding: 18px 40px;
        background: #000;
        color: #fff;
        border: none;
        border-radius: 50px;
        font-size: 17px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        min-width: 220px;
      `;
      
      // Validate selection
      const bundleStyle = this.config.bundleStyle || 'fbt';
      const selectMinQty = this.config.selectMinQty || this.config.minProducts || 0;
      const selectMaxQty = this.config.selectMaxQty || this.config.maxProducts || this.products.length;
      
      let isValid = true;
      
      if (bundleStyle === 'tier') {
        isValid = this.selectedQuantityTier !== null;
      } else {
        const type = this.config.type || 'manual';
        const isChoosable = type === 'choose_x_from_y' || type === 'category';
        
        if (isChoosable) {
          isValid = this.selectedProducts.length >= selectMinQty && this.selectedProducts.length <= selectMaxQty;
        } else {
          isValid = this.selectedProducts.length > 0;
        }
      }
      
      if (!isValid) {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
        if (bundleStyle === 'tier') {
          button.textContent = 'Select a quantity';
        } else {
          button.textContent = `Select ${selectMinQty}-${selectMaxQty} products`;
        }
      }

      button.addEventListener('click', () => this.addBundleToCart());
      button.addEventListener('mouseenter', () => {
        if (!button.disabled) {
          button.style.background = '#333';
          button.style.transform = 'translateY(-2px)';
          button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
        }
      });
      button.addEventListener('mouseleave', () => {
        if (!button.disabled) {
          button.style.background = '#000';
          button.style.transform = 'translateY(0)';
          button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }
      });

      buttonContainer.appendChild(button);
      summary.appendChild(buttonContainer);

      this.footer.appendChild(summary);
    }

    calculatePrices() {
      let originalPrice = 0;
      let discountedPrice = 0;

      const bundleType = this.config.type || 'manual';
      const bundleStyle = this.config.bundleStyle || 'fbt';
      const discountType = this.config.discountType || 'percentage';
      const discountValue = this.config.discountValue || 0;

      // Tier pricing
      if (bundleStyle === 'tier' && this.selectedQuantityTier) {
        originalPrice = this.selectedQuantityTier.originalPrice;
        discountedPrice = this.selectedQuantityTier.discountedPrice;
      }
      // Standard bundle pricing
      else {
        // Sum selected product prices
        this.selectedProducts.forEach(p => {
          originalPrice += p.price;
        });

        // Apply discount
        if (discountType === 'percentage') {
          discountedPrice = originalPrice * (1 - discountValue / 100);
        } else if (discountType === 'fixed') {
          discountedPrice = originalPrice - (discountValue * 100); // Convert to cents
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

    async addBundleToCart() {
      console.log('🎁 Adding bundle to cart:', this.selectedProducts);

      // Track add to cart event
      this.trackEvent('add_to_cart');

      // Prepare cart items
      const items = this.selectedProducts.map(product => {
        const variant = product.variants && product.variants[0] 
          ? product.variants[0] 
          : { id: product.id };
        
        return {
          id: variant.id,
          quantity: 1,
          properties: {
            '_bundle_id': this.config.id,
            '_bundle_name': this.config.name || this.config.displayTitle
          }
        };
      });

      try {
        // Add all items to cart via Shopify Cart API
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items })
        });

        if (response.ok) {
          console.log('🎁 Bundle added to cart successfully');
          
          // Show success message
          this.showSuccessMessage();
          
          // Trigger cart refresh
          if (window.cartUpliftDrawer) {
            await window.cartUpliftDrawer.fetchCart();
            window.cartUpliftDrawer.updateDrawerContent();
            window.cartUpliftDrawer.open();
          } else {
            // Fallback: trigger theme's cart update
            document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', {
              bubbles: true
            }));
            
            // Try common theme cart update methods
            if (typeof window.theme !== 'undefined' && window.theme.cart) {
              window.theme.cart.getCart();
            }
            if (typeof Shopify !== 'undefined' && Shopify.theme && Shopify.theme.cart) {
              Shopify.theme.cart.get();
            }
          }
        } else {
          const error = await response.json();
          throw new Error(error.description || 'Failed to add bundle to cart');
        }
      } catch (error) {
        console.error('🎁 Failed to add bundle to cart:', error);
        alert('Failed to add bundle to cart. Please try again.');
      }
    }

    showSuccessMessage() {
      const message = document.createElement('div');
      message.className = 'cartuplift-bundle-success';
      message.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="margin-right: 8px;">
          <path d="M9 11L12 14L22 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Bundle added to cart!
      `;
      message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 16px;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
      `;
      
      document.body.appendChild(message);
      
      setTimeout(() => {
        message.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => message.remove(), 300);
      }, 3000);
    }

    trackEvent(eventType) {
      // Track to backend analytics
      const data = {
        bundleId: this.config.id,
        bundleName: this.config.name,
        bundleType: this.config.type || 'manual',
        bundleStyle: this.config.bundleStyle || 'fbt',
        event: eventType,
        products: this.selectedProducts.map(p => p.id),
        timestamp: Date.now()
      };

      console.log('🎁 Tracking event:', eventType, data);

      fetch('/apps/cart-uplift/api/bundle-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      }).catch(err => {
        console.warn('🎁 Failed to track bundle event:', err);
      });
    }
  }

  // Initialize bundle manager when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.bundleManager = new BundleManager();
    });
  } else {
    window.bundleManager = new BundleManager();
  }

  // Add CSS animations and styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    /* Scrollbar styling */
    .cartuplift-bundle-carousel::-webkit-scrollbar {
      height: 8px;
    }

    .cartuplift-bundle-carousel::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }

    .cartuplift-bundle-carousel::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }

    .cartuplift-bundle-carousel::-webkit-scrollbar-thumb:hover {
      background: #555;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .cartuplift-bundle-fbt {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      
      .cartuplift-bundle-plus {
        display: none !important;
      }
      
      .cartuplift-fbt-card,
      .cartuplift-grid-card,
      .cartuplift-carousel-card {
        width: 100% !important;
        flex: 1 1 100% !important;
      }
      
      .cartuplift-bundle-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      
      .cartuplift-bundle-price-summary {
        flex-direction: column !important;
        text-align: center;
      }
      
      .cartuplift-bundle-add-button {
        width: 100% !important;
        min-width: auto !important;
      }
      
      .cartuplift-tier-option {
        flex-direction: column !important;
        text-align: center;
      }
      
      .cartuplift-bundles-heading {
        font-size: 22px !important;
      }
    }

    @media (max-width: 480px) {
      .cartuplift-bundle-grid {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);

})();