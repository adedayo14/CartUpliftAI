(function() {
  'use strict';

  console.log('🎁 Cart Uplift Bundles - Standalone Module Loaded');

  // Bundle Manager - Handles all bundle blocks on the page
  class BundleManager {
    constructor() {
      this.bundles = [];
      this.init();
    }

    async init() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Find all bundle blocks on the page
      this.detectBundles();

      // Initialize each bundle
      this.bundles.forEach(bundle => bundle.init());

      console.log(`🎁 Initialized ${this.bundles.length} bundle(s) on this page`);
    }

    detectBundles() {
      const bundleElements = document.querySelectorAll('.cartuplift-bundle-block');
      
      bundleElements.forEach(element => {
        // Read configuration from script tag
        const configScript = element.querySelector('script[data-bundle-config]');
        if (!configScript) {
          console.warn('🎁 Bundle block missing config script:', element);
          return;
        }

        try {
          const config = JSON.parse(configScript.textContent);
          
          // Check if bundle should be shown on current product
          if (!this.shouldShowBundle(config)) {
            console.log(`🎁 Bundle "${config.bundleName}" hidden (not assigned to this product)`);
            element.style.display = 'none';
            return;
          }

          // Create bundle instance
          const bundle = new ProductBundle(element, config);
          this.bundles.push(bundle);
        } catch (error) {
          console.error('🎁 Failed to parse bundle config:', error);
        }
      });

      // Sort bundles by priority (lower number = higher priority)
      this.bundles.sort((a, b) => a.config.priority - b.config.priority);
    }

    shouldShowBundle(config) {
      // If showEverywhere is true, always show
      if (config.showEverywhere) {
        return true;
      }

      // Check if current product matches assigned products
      const currentProductId = config.currentProductId;
      if (!currentProductId) {
        console.log('🎁 No current product ID, hiding bundle');
        return false;
      }

      // Check if product ID is in showOnProducts list
      if (config.showOnProducts && config.showOnProducts.length > 0) {
        const productIdString = String(currentProductId);
        const shouldShow = config.showOnProducts.some(id => String(id) === productIdString);
        console.log(`🎁 Product ${productIdString} in assignment list:`, shouldShow, config.showOnProducts);
        return shouldShow;
      }

      // If no assignment specified, hide bundle
      return false;
    }
  }

  // Individual Product Bundle
  class ProductBundle {
    constructor(element, config) {
      this.element = element;
      this.config = config;
      this.container = element.querySelector('[data-bundle-container]');
      this.footer = element.querySelector('[data-bundle-footer]');
      this.selectedProducts = [];
      this.products = [];
    }

    async init() {
      console.log(`🎁 Initializing bundle: ${this.config.bundleName}`, this.config);

      // Load product data
      await this.loadProducts();

      // Render based on bundle type
      this.render();

      // Track view event
      this.trackEvent('view');
    }

    async loadProducts() {
      // Products come from Liquid - already in config
      if (this.config.products && this.config.products.length > 0) {
        // Fetch full product details from Shopify
        this.products = await this.fetchProductDetails(this.config.products);
      } else if (this.config.bundleType === 'ai') {
        // Fetch AI recommendations
        this.products = await this.fetchAIRecommendations();
      } else if (this.config.collections && this.config.collections.length > 0) {
        // Fetch products from collections
        this.products = await this.fetchCollectionProducts(this.config.collections);
      }

      console.log(`🎁 Loaded ${this.products.length} products for bundle`);
    }

    async fetchProductDetails(liquidProducts) {
      // liquidProducts is an array from Liquid's product_list
      // Format: [{ id: "gid://shopify/Product/123", handle: "product-handle", ... }]
      
      const products = [];
      
      for (const liquidProduct of liquidProducts) {
        try {
          // Extract numeric ID from GID
          const productId = liquidProduct.id.split('/').pop();
          const handle = liquidProduct.handle;
          
          // Fetch product JSON from Shopify
          const response = await fetch(`/products/${handle}.js`);
          const productData = await response.json();
          
          products.push({
            id: productId,
            handle: handle,
            title: productData.title,
            price: productData.price,
            comparePrice: productData.compare_at_price,
            available: productData.available,
            image: productData.featured_image,
            variants: productData.variants,
            url: `/products/${handle}`
          });
        } catch (error) {
          console.error(`🎁 Failed to load product ${liquidProduct.handle}:`, error);
        }
      }
      
      return products;
    }

    async fetchAIRecommendations() {
      // TODO: Call your ML API endpoint
      console.log('🎁 Fetching AI recommendations...');
      // For now, return empty array
      return [];
    }

    async fetchCollectionProducts(collections) {
      // TODO: Fetch products from collections
      console.log('🎁 Fetching collection products...', collections);
      // For now, return empty array
      return [];
    }

    render() {
      if (this.products.length === 0) {
        if (this.config.hideIfNoML) {
          this.element.style.display = 'none';
          return;
        }
        this.container.innerHTML = '<p>No products available for this bundle.</p>';
        return;
      }

      // Remove loading state
      const loadingEl = this.container.querySelector('.cartuplift-bundle-loading');
      if (loadingEl) loadingEl.remove();

      // Render based on bundle type and style
      switch (this.config.bundleType) {
        case 'choose_x_from_y':
          this.renderChooseXFromY();
          break;
        case 'manual':
          this.renderFixedBundle();
          break;
        case 'bogo':
          this.renderBOGO();
          break;
        case 'quantity_tiers':
          this.renderQuantityTiers();
          break;
        case 'collection':
          this.renderChooseXFromY(); // Same UI as choose_x_from_y
          break;
        default:
          this.renderFixedBundle();
      }

      // Render footer (price summary + add button)
      this.renderFooter();
    }

    renderChooseXFromY() {
      const { selectMinQty, selectMaxQty, selectionPrompt, bundleStyle } = this.config;
      
      // Show selection prompt
      const promptText = selectionPrompt
        .replace('{min}', selectMinQty)
        .replace('{max}', selectMaxQty);
      
      const promptEl = document.createElement('p');
      promptEl.className = 'cartuplift-bundle-prompt';
      promptEl.textContent = promptText;
      this.container.appendChild(promptEl);

      // Render products based on style
      if (bundleStyle === 'grid') {
        this.renderGridLayout();
      } else if (bundleStyle === 'carousel') {
        this.renderCarouselLayout();
      } else if (bundleStyle === 'list') {
        this.renderListLayout();
      } else if (bundleStyle === 'fbt') {
        this.renderFBTLayout();
      }
    }

    renderGridLayout() {
      const grid = document.createElement('div');
      grid.className = 'cartuplift-bundle-grid';
      grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; margin: 20px 0;';

      this.products.forEach((product, index) => {
        const card = this.createProductCard(product, index);
        grid.appendChild(card);
      });

      this.container.appendChild(grid);
    }

    renderCarouselLayout() {
      const carousel = document.createElement('div');
      carousel.className = 'cartuplift-bundle-carousel';
      carousel.style.cssText = 'display: flex; overflow-x: auto; gap: 16px; margin: 20px 0; scroll-snap-type: x mandatory;';

      this.products.forEach((product, index) => {
        const card = this.createProductCard(product, index);
        card.style.cssText += 'flex: 0 0 200px; scroll-snap-align: start;';
        carousel.appendChild(card);
      });

      this.container.appendChild(carousel);
    }

    renderListLayout() {
      const list = document.createElement('div');
      list.className = 'cartuplift-bundle-list';
      list.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin: 20px 0;';

      this.products.forEach((product, index) => {
        const card = this.createProductCard(product, index, true); // true = horizontal layout
        list.appendChild(card);
      });

      this.container.appendChild(list);
    }

    renderFBTLayout() {
      const fbt = document.createElement('div');
      fbt.className = 'cartuplift-bundle-fbt';
      fbt.style.cssText = 'display: flex; align-items: center; gap: 12px; margin: 20px 0; flex-wrap: wrap;';

      this.products.forEach((product, index) => {
        const card = this.createProductCard(product, index);
        card.style.cssText += 'flex: 1; min-width: 120px;';
        fbt.appendChild(card);

        // Add "+" between items (but not after last)
        if (index < this.products.length - 1) {
          const plus = document.createElement('span');
          plus.textContent = '+';
          plus.style.cssText = 'font-size: 24px; font-weight: bold; color: #666;';
          fbt.appendChild(plus);
        }
      });

      this.container.appendChild(fbt);
    }

    createProductCard(product, index, horizontal = false) {
      const card = document.createElement('div');
      card.className = 'cartuplift-bundle-product-card';
      card.dataset.productId = product.id;
      card.dataset.index = index;
      
      const cardStyle = horizontal
        ? 'display: flex; gap: 12px; align-items: center; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: border-color 0.2s;'
        : 'display: flex; flex-direction: column; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: border-color 0.2s;';
      
      card.style.cssText = cardStyle;

      // Checkbox (for choose_x_from_y)
      if (this.config.bundleType === 'choose_x_from_y' || this.config.bundleType === 'collection') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'cartuplift-bundle-checkbox';
        checkbox.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
        checkbox.addEventListener('change', (e) => this.handleProductSelection(product, index, e.target.checked));
        card.appendChild(checkbox);
      }

      // Product image
      if (product.image) {
        const img = document.createElement('img');
        img.src = product.image;
        img.alt = product.title;
        img.style.cssText = horizontal ? 'width: 80px; height: 80px; object-fit: cover; border-radius: 4px;' : 'width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; margin-bottom: 8px;';
        card.appendChild(img);
      }

      // Product info
      const info = document.createElement('div');
      info.className = 'cartuplift-bundle-product-info';
      info.style.cssText = horizontal ? 'flex: 1;' : '';

      const title = document.createElement('h4');
      title.textContent = product.title;
      title.style.cssText = 'margin: 0 0 4px 0; font-size: 14px; font-weight: 600; line-height: 1.3;';
      info.appendChild(title);

      const price = document.createElement('p');
      price.className = 'cartuplift-bundle-product-price';
      price.style.cssText = 'margin: 0; font-size: 14px; font-weight: 500;';
      
      const priceValue = product.price / 100;
      price.textContent = `$${priceValue.toFixed(2)}`;
      
      if (product.comparePrice && product.comparePrice > product.price) {
        const compareValue = product.comparePrice / 100;
        price.innerHTML = `<span style="text-decoration: line-through; color: #999; margin-right: 8px;">$${compareValue.toFixed(2)}</span>$${priceValue.toFixed(2)}`;
      }
      
      info.appendChild(price);
      card.appendChild(info);

      // Click handler (for non-checkbox selections)
      if (this.config.bundleType === 'manual' || !this.config.allowDeselect) {
        card.addEventListener('click', () => {
          const checkbox = card.querySelector('.cartuplift-bundle-checkbox');
          if (checkbox) {
            checkbox.checked = !checkbox.checked;
            this.handleProductSelection(product, index, checkbox.checked);
          }
        });
      }

      return card;
    }

    renderFixedBundle() {
      // For fixed bundles, all products are included
      this.selectedProducts = this.products.map((p, i) => ({ ...p, index: i }));
      
      // Render as grid (non-selectable)
      const grid = document.createElement('div');
      grid.className = 'cartuplift-bundle-grid';
      grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; margin: 20px 0;';

      this.products.forEach((product, index) => {
        const card = this.createProductCard(product, index);
        card.style.border = '2px solid #4CAF50'; // Highlight as selected
        card.style.opacity = '1';
        grid.appendChild(card);
      });

      this.container.appendChild(grid);
    }

    renderBOGO() {
      // TODO: Implement BOGO rendering
      console.log('🎁 BOGO rendering not yet implemented');
      this.renderFixedBundle();
    }

    renderQuantityTiers() {
      // Parse tier configuration
      const tiers = this.config.tiers
        .filter(t => t !== null)
        .map(tierStr => {
          const [qty, discount] = tierStr.split(':').map(Number);
          return { qty, discount };
        })
        .sort((a, b) => a.qty - b.qty);

      console.log('🎁 Quantity tiers:', tiers);

      // Show tier information
      const tierInfo = document.createElement('div');
      tierInfo.className = 'cartuplift-bundle-tiers';
      tierInfo.style.cssText = 'background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 20px;';

      const tierTitle = document.createElement('h4');
      tierTitle.textContent = 'Buy More, Save More!';
      tierTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; font-weight: 600;';
      tierInfo.appendChild(tierTitle);

      const tierList = document.createElement('ul');
      tierList.style.cssText = 'margin: 0; padding-left: 20px; list-style: none;';
      
      tiers.forEach(tier => {
        const li = document.createElement('li');
        li.style.cssText = 'margin-bottom: 8px; font-size: 14px;';
        li.innerHTML = `<strong>Buy ${tier.qty}+</strong> → Save ${tier.discount}%`;
        tierList.appendChild(li);
      });

      tierInfo.appendChild(tierList);
      this.container.appendChild(tierInfo);

      // Render products as grid
      this.renderGridLayout();
      
      // Auto-select first product
      this.selectedProducts = [{ ...this.products[0], index: 0 }];
    }

    handleProductSelection(product, index, isChecked) {
      const { selectMinQty, selectMaxQty } = this.config;

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

      // Price summary
      const summary = document.createElement('div');
      summary.className = 'cartuplift-bundle-price-summary';
      summary.style.cssText = 'padding: 20px; background: #f9f9f9; border-radius: 8px;';

      // Original price (strikethrough)
      if (originalPrice > 0) {
        const originalEl = document.createElement('p');
        originalEl.style.cssText = 'margin: 0 0 8px 0; font-size: 14px; color: #999; text-decoration: line-through;';
        originalEl.textContent = `Regular Price: $${(originalPrice / 100).toFixed(2)}`;
        summary.appendChild(originalEl);
      }

      // Bundle price
      const bundleEl = document.createElement('p');
      bundleEl.style.cssText = 'margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #4CAF50;';
      bundleEl.textContent = `Bundle Price: $${(discountedPrice / 100).toFixed(2)}`;
      summary.appendChild(bundleEl);

      // Savings badge
      if (savings > 0) {
        const savingsEl = document.createElement('p');
        savingsEl.className = 'cartuplift-bundle-savings';
        savingsEl.style.cssText = 'margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #FF5722;';
        
        let savingsText = this.config.savingsBadgeText || 'Save {amount}!';
        savingsText = savingsText
          .replace('{amount}', `$${(savings / 100).toFixed(2)}`)
          .replace('{percent}', `${savingsPercent}%`);
        
        savingsEl.textContent = savingsText;
        summary.appendChild(savingsEl);
      }

      // Add to cart button
      const button = document.createElement('button');
      button.className = 'cartuplift-bundle-add-button';
      button.textContent = this.config.addButtonText || 'Add Bundle to Cart';
      button.style.cssText = 'width: 100%; padding: 16px; background: #000; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s;';
      
      // Validate selection
      const { selectMinQty, selectMaxQty } = this.config;
      const isValid = this.selectedProducts.length >= selectMinQty && this.selectedProducts.length <= selectMaxQty;
      
      if (!isValid) {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
        button.textContent = `Select ${selectMinQty}-${selectMaxQty} products`;
      }

      button.addEventListener('click', () => this.addBundleToCart());
      button.addEventListener('mouseenter', () => {
        if (!button.disabled) button.style.background = '#333';
      });
      button.addEventListener('mouseleave', () => {
        if (!button.disabled) button.style.background = '#000';
      });

      summary.appendChild(button);
      this.footer.appendChild(summary);
    }

    calculatePrices() {
      let originalPrice = 0;
      let discountedPrice = 0;

      // Calculate based on bundle type
      if (this.config.bundleType === 'quantity_tiers') {
        // Tier pricing based on quantity
        const quantity = this.selectedProducts.length;
        const tiers = this.config.tiers
          .filter(t => t !== null)
          .map(tierStr => {
            const [qty, discount] = tierStr.split(':').map(Number);
            return { qty, discount };
          })
          .sort((a, b) => b.qty - a.qty); // Sort descending

        // Find applicable tier
        let applicableDiscount = 0;
        for (const tier of tiers) {
          if (quantity >= tier.qty) {
            applicableDiscount = tier.discount;
            break;
          }
        }

        // Calculate prices
        this.selectedProducts.forEach(p => {
          originalPrice += p.price;
        });

        discountedPrice = originalPrice * (1 - applicableDiscount / 100);
      } else {
        // Standard discount
        this.selectedProducts.forEach(p => {
          originalPrice += p.price;
        });

        if (this.config.discountType === 'percentage') {
          discountedPrice = originalPrice * (1 - this.config.discountValue / 100);
        } else {
          discountedPrice = originalPrice - (this.config.discountValue * 100); // Convert to cents
        }
      }

      const savings = originalPrice - discountedPrice;
      const savingsPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

      return {
        originalPrice,
        discountedPrice: Math.max(0, discountedPrice),
        savings: Math.max(0, savings),
        savingsPercent
      };
    }

    async addBundleToCart() {
      console.log('🎁 Adding bundle to cart:', this.selectedProducts);

      // Track add to cart event
      this.trackEvent('add_to_cart');

      // Prepare cart items
      const items = this.selectedProducts.map(product => ({
        id: product.variants[0].id, // Use first variant
        quantity: 1,
        properties: {
          '_bundle_id': this.config.bundleId,
          '_bundle_name': this.config.bundleName
        }
      }));

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
          
          // Trigger cart refresh (if cart drawer exists)
          if (window.cartUpliftDrawer) {
            await window.cartUpliftDrawer.fetchCart();
            window.cartUpliftDrawer.updateDrawerContent();
            window.cartUpliftDrawer.open();
          } else {
            // Fallback: trigger theme's cart update
            document.documentElement.dispatchEvent(new CustomEvent('cart:refresh'));
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
      message.textContent = '✓ Bundle added to cart!';
      message.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 16px 24px; border-radius: 8px; font-weight: 600; z-index: 10000; animation: slideIn 0.3s ease-out;';
      
      document.body.appendChild(message);
      
      setTimeout(() => {
        message.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => message.remove(), 300);
      }, 3000);
    }

    trackEvent(eventType) {
      // Track to backend analytics
      const data = {
        bundleId: this.config.bundleId,
        bundleName: this.config.bundleName,
        bundleType: this.config.bundleType,
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

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .cartuplift-bundle-grid::-webkit-scrollbar,
    .cartuplift-bundle-carousel::-webkit-scrollbar {
      height: 8px;
    }

    .cartuplift-bundle-grid::-webkit-scrollbar-track,
    .cartuplift-bundle-carousel::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }

    .cartuplift-bundle-grid::-webkit-scrollbar-thumb,
    .cartuplift-bundle-carousel::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }

    .cartuplift-bundle-grid::-webkit-scrollbar-thumb:hover,
    .cartuplift-bundle-carousel::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
  `;
  document.head.appendChild(style);

})();
