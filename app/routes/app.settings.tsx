import * as React from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  BlockStack,
  Text,
  Banner,
  Checkbox,
  Button,
  InlineStack,
  Badge,
  Divider,
  Modal,
  Spinner,
  Icon,
} from "@shopify/polaris";
import {
  CheckIcon,
} from '@shopify/polaris-icons';
import { withAuth, withAuthAction } from "../utils/auth.server";
import { getSettings, saveSettings } from "../models/settings.server";

// Loader: Fetch settings from database
export const loader = withAuth(async ({ auth }) => {
  const shop = auth.session.shop;
  const settings = await getSettings(shop);
  
  return json({
    settings,
    ordersBadgeText: '0 Orders',
    dataQualityTone: 'info',
    dataQualityLabel: 'Low',
  });
});

// Action: Save settings to database
export const action = withAuthAction(async ({ request, auth }) => {
  const shop = auth.session.shop;
  console.log(`[SETTINGS ACTION] Received request for shop: ${shop}`);

  try {
    const formData = await request.formData();
    const settings = Object.fromEntries(formData);
    console.log(`[SETTINGS ACTION] Parsed ${Object.keys(settings).length} fields from formData.`);

    // Convert string values to appropriate types
    const processedSettings: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value !== 'string') {
        processedSettings[key] = value;
        continue;
      }
      if (value === 'true') {
        processedSettings[key] = true;
      } else if (value === 'false') {
        processedSettings[key] = false;
      } else if (!isNaN(Number(value)) && value.trim() !== '') {
        processedSettings[key] = Number(value);
      } else {
        processedSettings[key] = value;
      }
    }
    console.log('[SETTINGS ACTION] Processed settings object:', processedSettings);

    console.log('[SETTINGS ACTION] Attempting to save settings to the database...');
    await saveSettings(shop, processedSettings);
    console.log('✅ [SETTINGS ACTION] Successfully saved settings to the database.');
    
    return json({ success: true, message: "Settings saved successfully!" });
  } catch (error) {
    console.error("❌ [SETTINGS ACTION] An error occurred:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return json({ 
      success: false, 
      message: errorMessage,
    }, { status: 500 });
  }
});

export default function AppSettings() {
  // Hooks and state
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [formSettings, setFormSettings] = React.useState<any>(loaderData.settings || {});
  const [showSuccessBanner, setShowSuccessBanner] = React.useState(false);
  const [showErrorBanner, setShowErrorBanner] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [buttonSuccess, setButtonSuccess] = React.useState(false);
  const [showProductSelector, setShowProductSelector] = React.useState(false);
  const [selectedProducts, setSelectedProducts] = React.useState<any[]>([]);
  const [productSearchQuery, setProductSearchQuery] = React.useState("");
  const [productsLoading, setProductsLoading] = React.useState(false);
  const [productsError, setProductsError] = React.useState<string | null>(null);
  const [products, setProducts] = React.useState<any[]>([]);
  const ordersBadgeText = loaderData.ordersBadgeText || "0 Orders";
  const dataQualityTone = loaderData.dataQualityTone || "info";
  const dataQualityLabel = loaderData.dataQualityLabel || "Low";
  const [isSaving, setIsSaving] = React.useState(false);

  // Helper: update a setting
  const updateSetting = (key: string, value: any) => {
    setFormSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  // Handle save via direct fetch to API route
  const handleSaveSettings = async () => {
    console.log("=".repeat(80));
    console.log('[SETTINGS CLIENT] Save button clicked at:', new Date().toISOString());
    console.log('[SETTINGS CLIENT] Current settings count:', Object.keys(formSettings).length);
    console.log("=".repeat(80));
    
    setIsSaving(true);
    setShowSuccessBanner(false);
    setShowErrorBanner(false);

    try {
      // Get session token from URL for authentication
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('id_token') || '';
      const shop = urlParams.get('shop') || '';
      
      console.log('[SETTINGS CLIENT] Session token available:', !!sessionToken);
      console.log('[SETTINGS CLIENT] Shop:', shop);

      // Create JSON payload instead of FormData
      const payload = {
        shop,
        sessionToken,
        settings: formSettings
      };

      console.log('[SETTINGS CLIENT] Sending JSON payload to /api/settings...');
      console.log('[SETTINGS CLIENT] Current URL:', window.location.href);
      
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      console.log('[SETTINGS CLIENT] Response received!');
      console.log('[SETTINGS CLIENT] Response status:', response.status);
      console.log('[SETTINGS CLIENT] Response headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('[SETTINGS CLIENT] Response data:', data);

      if (data.success) {
        console.log('[SETTINGS CLIENT] ✅ Success!');
        setShowSuccessBanner(true);
        setButtonSuccess(true);
        setTimeout(() => {
          setShowSuccessBanner(false);
          setButtonSuccess(false);
        }, 3000);
      } else {
        console.log('[SETTINGS CLIENT] ❌ Failed:', data.error);
        setShowErrorBanner(true);
        setErrorMessage(data.error || 'Failed to save settings');
        setButtonSuccess(false);
        setTimeout(() => setShowErrorBanner(false), 5000);
      }
    } catch (error: any) {
      console.error('[SETTINGS CLIENT] ❌ Exception:', error);
      console.error('[SETTINGS CLIENT] Error details:', error.message, error.stack);
      setShowErrorBanner(true);
      setErrorMessage(error.message || 'Failed to save settings');
      setTimeout(() => setShowErrorBanner(false), 5000);
    } finally {
      console.log('[SETTINGS CLIENT] Setting isSaving to false');
      setIsSaving(false);
    }
  };

  // Handle fetcher response for success/error messages (kept for compatibility)
  React.useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const data: any = fetcher.data;
      if (data?.success) {
        setShowSuccessBanner(true);
        setShowErrorBanner(false);
        setButtonSuccess(true);
        setTimeout(() => {
          setShowSuccessBanner(false);
          setButtonSuccess(false);
        }, 3000);
      } else {
        setShowErrorBanner(true);
        setErrorMessage(data?.message || 'Failed to save settings');
        setButtonSuccess(false);
        setTimeout(() => setShowErrorBanner(false), 5000);
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Simulate product search (replace with real API call)
  React.useEffect(() => {
    if (!showProductSelector) return;
    setProductsLoading(true);
    setProductsError(null);
    // Simulate async fetch
    setTimeout(() => {
      // TODO: Replace with real product search logic
      setProducts([
        { id: 1, title: "Sample Product 1", handle: "sample-1", image: "", imageAlt: "Sample Product 1" },
        { id: 2, title: "Sample Product 2", handle: "sample-2", image: "", imageAlt: "Sample Product 2" },
      ]);
      setProductsLoading(false);
    }, 500);
  }, [showProductSelector, productSearchQuery]);

  // Map dataQualityTone to valid Polaris Badge tone
  const badgeTone =
    dataQualityTone === 'info' ? 'info' :
    dataQualityTone === 'success' ? 'success' :
    dataQualityTone === 'warning' ? 'warning' :
    dataQualityTone === 'critical' ? 'critical' : undefined;

  // Main JSX return
  return (
    <Page>
      {/* ...existing JSX code... */}

      <div id="settings-form">
        {/* Content wrapper - no longer needs to be a form */}
        
        <div className="cartuplift-settings-layout">{(showSuccessBanner || showErrorBanner) && (
          <div className="cartuplift-success-banner">
            {showSuccessBanner && (
              <Banner tone="success">Settings saved successfully!</Banner>
            )}
            {showErrorBanner && (
              <Banner tone="critical">{errorMessage || 'Failed to save settings'}</Banner>
            )}
          </div>
        )}
        
        {/* Settings Column - Left Side */}
        <div className="cartuplift-settings-column">
          <BlockStack gap="500">
            {/* Header */}
            <Card padding="300">
              <Text as="p" variant="bodyMd" tone="subdued" fontWeight="bold">
                Settings • Configure your cart optimization features
              </Text>
            </Card>
            
            {/* Quick Setup - Most Important First */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🚀 Quick Setup</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Analytics tracking is always enabled to power your dashboard insights. No personal information is collected.
                </Text>
              </BlockStack>
            </Card>

            {/* AI-Powered Recommendations - PROMINENT PLACEMENT */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">� AI-Powered Recommendations</Text>
                <Text as="p" variant="bodyMd">Configure machine learning and intelligent product recommendations to boost conversions.</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable ML Recommendations"
                    checked={(formSettings as any).enableMLRecommendations}
                    onChange={(value) => updateSetting("enableMLRecommendations", value)}
                    helpText="Use machine learning to personalize product recommendations"
                  />

                  {(formSettings as any).enableMLRecommendations && (
                    <BlockStack gap="400">
                      <Select
                        label="ML Personalization Mode"
                        options={[
                          { label: 'Basic', value: 'basic' },
                          { label: 'Advanced', value: 'advanced' },
                          { label: 'Custom', value: 'custom' }
                        ]}
                        value={(formSettings as any).mlPersonalizationMode || "basic"}
                        onChange={(value) => updateSetting("mlPersonalizationMode", value)}
                        helpText="Choose the level of personalization for recommendations"
                      />

                      <Select
                        label="Privacy Level"
                        options={[
                          { label: 'Basic (Anonymous)', value: 'basic' },
                          { label: 'Standard (Session-based)', value: 'standard' },
                          { label: 'Advanced (User tracking)', value: 'advanced' }
                        ]}
                        value={(formSettings as any).mlPrivacyLevel || "basic"}
                        onChange={(value) => updateSetting("mlPrivacyLevel", value)}
                        helpText="Balance between personalization and privacy"
                      />

                      <Checkbox
                        label="Advanced Personalization"
                        checked={(formSettings as any).enableAdvancedPersonalization}
                        onChange={(value) => updateSetting("enableAdvancedPersonalization", value)}
                        helpText="Enable cross-session learning and behavioral analysis"
                      />

                      <Checkbox
                        label="Behavior Tracking"
                        checked={(formSettings as any).enableBehaviorTracking}
                        onChange={(value) => updateSetting("enableBehaviorTracking", value)}
                        helpText="Track user behavior for improved recommendations (requires privacy disclosure)"
                      />

                      <TextField
                        label="Data Retention (Days)"
                        value={(formSettings as any).mlDataRetentionDays || "90"}
                        onChange={(value) => updateSetting("mlDataRetentionDays", value)}
                        helpText="How long to keep ML training data (affects recommendation accuracy)"
                        type="number"
                        autoComplete="off"
                      />

                      {/* 📊 REAL DATA TRANSPARENCY */}
                      <Card background="bg-surface-secondary">
                        <BlockStack gap="200">
                          <Text variant="headingSm" as="h3">📊 Your ML Data Status</Text>
                          <Text as="p" variant="bodyMd" tone="subdued">
                            <strong>More data = Better recommendations.</strong> Here's what we're using:
                          </Text>
                          
                          <InlineStack gap="300">
                            <Badge tone="info">{ordersBadgeText}</Badge>
                            <Badge tone={badgeTone}>
                              {dataQualityLabel}
                            </Badge>
                          </InlineStack>
                          
                          <Text as="p" variant="bodyMd" tone="subdued">
                            • <strong>Basic Mode:</strong> Uses order patterns (anonymous)<br/>
                            • <strong>Advanced Mode:</strong> Adds customer behavior tracking<br/>  
                            • <strong>Privacy:</strong> All data stays in your Shopify store<br/>
                            • <strong>Performance:</strong> Recommendations improve over time
                          </Text>

                          {(formSettings as any).enableBehaviorTracking && (
                            <Banner title="Customer Privacy Notice" tone="warning">
                              <Text as="p">With behavior tracking enabled, inform customers about data collection in your privacy policy. We recommend: "We analyze shopping patterns to improve product recommendations."</Text>
                            </Banner>
                          )}
                        </BlockStack>
                      </Card>

                      <Divider />

                      <Text variant="headingSm" as="h3">📦 Advanced Recommendation Controls</Text>
                      
                      <Checkbox
                        label="Hide Recommendations After All Thresholds Met"
                        checked={formSettings.hideRecommendationsAfterThreshold}
                        onChange={(value) => updateSetting("hideRecommendationsAfterThreshold", value)}
                        helpText="Collapse recommendation section when customer reaches all available gift/shipping thresholds"
                      />

                      <Checkbox
                        label="Enable Threshold-Based Product Suggestions"
                        checked={formSettings.enableThresholdBasedSuggestions}
                        onChange={(value) => updateSetting("enableThresholdBasedSuggestions", value)}
                        helpText="Smart product suggestions to help customers reach thresholds (e.g., suggest $20+ items when customer has $80 and threshold is $100)"
                      />

                      {formSettings.enableThresholdBasedSuggestions && (
                        <Select
                          label="Threshold Suggestion Strategy"
                          options={[
                            { label: '🤖 Smart AI Selection', value: 'smart' },
                            { label: '💰 Price-Based Only', value: 'price' },
                            { label: '🎯 Category Match + Price', value: 'category_price' },
                            { label: '🔥 Popular + Price', value: 'popular_price' }
                          ]}
                          value={formSettings.thresholdSuggestionMode}
                          onChange={(value) => updateSetting("thresholdSuggestionMode", value)}
                          helpText="How to select products that help customers reach thresholds"
                        />
                      )}
                    </BlockStack>
                  )}


                </FormLayout>
              </BlockStack>
            </Card>

            {/* Text & Copy Customization */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">✏️ Text & Copy</Text>
                <Text as="p" variant="bodyMd">Customize all text displayed to customers in the cart experience.</Text>
                <FormLayout>
                  <Text variant="headingSm" as="h3">🛍️ Advanced Text Customization</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">Basic cart text (recommendations title, discount/notes links) is configured in theme editor.</Text>

                  <Divider />

                  <Text variant="headingSm" as="h3">🎁 Gift Settings</Text>

                  <TextField
                    label="Gift Price Label"
                    value={formSettings.giftPriceText || "FREE"}
                    onChange={(value) => updateSetting("giftPriceText", value)}
                    helpText="Text shown instead of price for free gift products"
                    autoComplete="off"
                  />

                  <Divider />

                  <Text variant="headingSm" as="h3">🔘 Button Labels</Text>

                  <InlineStack gap="400" wrap={false}>
                    <TextField
                      label="Checkout Button"
                      value={formSettings.checkoutButtonText || "CHECKOUT"}
                      onChange={(value) => updateSetting("checkoutButtonText", value)}
                      helpText="Main checkout button text"
                      autoComplete="off"
                    />

                    <TextField
                      label="Add Button"
                      value={formSettings.addButtonText || "Add"}
                      onChange={(value) => updateSetting("addButtonText", value)}
                      helpText="Add to cart button text"
                      autoComplete="off"
                    />

                    <TextField
                      label="Apply Button"
                      value={formSettings.applyButtonText || "Apply"}
                      onChange={(value) => updateSetting("applyButtonText", value)}
                      helpText="Apply discount code button"
                      autoComplete="off"
                    />
                  </InlineStack>
                </FormLayout>
              </BlockStack>
            </Card>






          </BlockStack>
        </div>
      </div>

      {/* Product Selector Modal for Manual Recommendations */}
      {showProductSelector && (
        <Modal
          open
          onClose={() => setShowProductSelector(false)}
          title="Select Products for Manual Recommendations"
          primaryAction={{
            content: 'Done',
            onAction: () => {
              setShowProductSelector(false);
            }
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setShowProductSelector(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <TextField
                label="Search products"
                value={productSearchQuery}
                onChange={(v: string) => setProductSearchQuery(v)}
                autoComplete="off"
                placeholder="Search by title, vendor, or tag"
              />
              {productsLoading ? (
                <InlineStack align="center">
                  <Spinner accessibilityLabel="Loading products" />
                </InlineStack>
              ) : (
                <div className="cartuplift-product-selector-list">
                  {productsError && (
                    <Banner tone="critical">{productsError}</Banner>
                  )}
                  {products.length === 0 && (
                    <Text as="p" tone="subdued">No products found.</Text>
                  )}
                  {products.map((p: any) => {
                    const isSelected = selectedProducts.includes(p.id);
                    return (
                      <div key={p.id} className="cartuplift-product-row">
                        <Checkbox
                          label=""
                          checked={isSelected}
                          onChange={(val: boolean) => {
                            if (val) {
                              const updated = [...selectedProducts, p.id];
                              setSelectedProducts(updated);
                              updateSetting('manualRecommendationProducts', updated.join(','));
                            } else {
                              const updated = selectedProducts.filter(id => id !== p.id);
                              setSelectedProducts(updated);
                              updateSetting('manualRecommendationProducts', updated.join(','));
                            }
                          }}
                        />
                        <img className="cartuplift-product-thumb" src={p.image || ''} alt={p.imageAlt || p.title} />
                        <div className="cartuplift-product-meta">
                          <p className="cartuplift-product-title">{p.title}</p>
                          <p className="cartuplift-product-sub">{p.handle}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

        {/* Save Button */}
        <Card>
          <InlineStack align="end">
            <Button
              variant="primary"
              tone={buttonSuccess ? "success" : undefined}
              size="large"
              onClick={handleSaveSettings}
              loading={isSaving}
              icon={buttonSuccess ? <Icon source={CheckIcon} /> : undefined}
            >
              {isSaving
                ? "Saving..." 
                : buttonSuccess 
                  ? "Saved!" 
                  : "Save Settings"}
            </Button>
          </InlineStack>
        </Card>

      </div>
    </Page>
  );
}