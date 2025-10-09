# Settings Integration Implementation Plan

## Changes Being Made

### TASK 1: Remove Duplicate Settings from App Settings Page

#### 1.1 Remove "Maximum Products to Show"
- **Location**: `app/routes/app.settings.tsx` line ~363-372
- **Reason**: Duplicate - already in theme embed as `recommendations_max_count` (better UX)
- **Action**: DELETE TextField for `maxRecommendationProducts`

#### 1.2 Remove "Action Text" Field
- **Location**: `app/routes/app.settings.tsx` line ~472-477
- **Reason**: Not used anywhere in codebase
- **Action**: DELETE TextField for `actionText`

### TASK 2: Add 25th Setting to Theme Embed

#### 2.1 Add Recommendation Title Caps Setting
- **Location**: `extensions/cart-uplift/blocks/app-embed.liquid` schema
- **Position**: After "Cart quick links" section (renamed to "Cart customization")
- **Type**: checkbox
- **ID**: `enable_recommendation_title_caps`
- **Label**: "Uppercase recommendation title"
- **Default**: true
- **Info**: "Makes recommendation section title all uppercase"

#### 2.2 Inject Setting into JavaScript
- **Location**: `app-embed.liquid` line ~100
- **Add to window.CartUpliftSettings**:
  ```javascript
  enableRecommendationTitleCaps: {{ block.settings.enable_recommendation_title_caps | json }}
  ```

### TASK 3: Create API Bridge for App Settings

#### 3.1 Add Settings Fetch Script
- **Location**: `app-embed.liquid` after initial settings block
- **Purpose**: Fetch database settings and merge with theme settings
- **Implementation**:
  ```liquid
  <script>
    (async function loadAppSettings() {
      try {
        const response = await fetch('/apps/cart-uplift/api/settings?shop={{ shop.permanent_domain }}');
        if (response.ok) {
          const dbSettings = await response.json();
          window.CartUpliftSettings = Object.assign(window.CartUpliftSettings, {
            // ML & AI Settings
            enableMLRecommendations: dbSettings.enableMLRecommendations,
            mlPersonalizationMode: dbSettings.mlPersonalizationMode,
            mlPrivacyLevel: dbSettings.mlPrivacyLevel,
            enableBehaviorTracking: dbSettings.enableBehaviorTracking,
            enableAdvancedPersonalization: dbSettings.enableAdvancedPersonalization,
            mlDataRetentionDays: dbSettings.mlDataRetentionDays,
            
            // Threshold Settings
            hideRecommendationsAfterThreshold: dbSettings.hideRecommendationsAfterThreshold,
            enableThresholdBasedSuggestions: dbSettings.enableThresholdBasedSuggestions,
            thresholdSuggestionMode: dbSettings.thresholdSuggestionMode,
            
            // Manual Recommendations
            enableManualRecommendations: dbSettings.enableManualRecommendations,
            manualRecommendationProducts: dbSettings.manualRecommendationProducts,
            
            // Button Text Overrides
            checkoutButtonText: dbSettings.checkoutButtonText,
            addButtonText: dbSettings.addButtonText,
            applyButtonText: dbSettings.applyButtonText,
            
            _dbSettingsLoaded: true
          });
          document.dispatchEvent(new CustomEvent('cartuplift:settings:updated'));
        }
      } catch (error) {
        console.warn('[CartUplift] App settings unavailable, using theme defaults');
      }
    })();
  </script>
  ```

### TASK 4: Testing Checklist

After implementation, verify:

- [ ] Theme embed settings still work (24 existing settings)
- [ ] New 25th setting (recommendation title caps) works
- [ ] App settings page loads without errors
- [ ] Removed fields are gone from UI
- [ ] Database settings flow to storefront via API
- [ ] Fallback works if API fails (theme settings only)
- [ ] No console errors in browser
- [ ] Settings save correctly in app settings page
- [ ] Changes reflect on storefront within ~5 seconds
- [ ] ML recommendations respect `enableMLRecommendations` setting
- [ ] Threshold suggestions respect `enableThresholdBasedSuggestions`
- [ ] Button text overrides work (checkout/add/apply buttons)
- [ ] Manual product recommendations work if enabled

## Files Modified

1. ✅ `app/routes/app.settings.tsx` - Remove duplicate/unused fields
2. ✅ `extensions/cart-uplift/blocks/app-embed.liquid` - Add API bridge + 25th setting
3. ✅ `SETTINGS_INTEGRATION_PLAN.md` - This documentation file

## Rollback Plan

If issues occur:
1. Git revert to commit: "CART before settings update"
2. All cart functionality will work as before
3. No data loss (database settings preserved)

## Success Criteria

✅ All 25 theme embed settings functional
✅ 14 app settings now flow to storefront
✅ No duplicate settings confusion
✅ Clean, maintainable codebase
✅ Graceful fallback if API fails
