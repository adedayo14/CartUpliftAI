import * as React from "react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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
  Icon,
} from "@shopify/polaris";
import { CheckIcon } from '@shopify/polaris-icons';
import { withAuth } from "../utils/auth.server";
import { getSettings } from "../models/settings.server";

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

export default function AppSettings() {
  const loaderData = useLoaderData<typeof loader>();
  const [formSettings, setFormSettings] = React.useState<any>(loaderData.settings || {});
  const [showSuccessBanner, setShowSuccessBanner] = React.useState(false);
  const [showErrorBanner, setShowErrorBanner] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [buttonSuccess, setButtonSuccess] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const ordersBadgeText = loaderData.ordersBadgeText || "0 Orders";
  const dataQualityTone = loaderData.dataQualityTone || "info";
  const dataQualityLabel = loaderData.dataQualityLabel || "Low";

  const updateSetting = (key: string, value: any) => {
    setFormSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setShowSuccessBanner(false);
    setShowErrorBanner(false);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('id_token') || '';
      const shop = urlParams.get('shop') || '';
      
      const payload = {
        shop,
        sessionToken,
        settings: formSettings
      };
      
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();

      if (data.success) {
        setShowSuccessBanner(true);
        setButtonSuccess(true);
        setTimeout(() => {
          setShowSuccessBanner(false);
          setButtonSuccess(false);
        }, 3000);
      } else {
        setShowErrorBanner(true);
        setErrorMessage(data.error || 'Failed to save settings');
        setTimeout(() => setShowErrorBanner(false), 5000);
      }
    } catch (error: any) {
      setShowErrorBanner(true);
      setErrorMessage(error.message || 'Failed to save settings');
      setTimeout(() => setShowErrorBanner(false), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const badgeTone = dataQualityTone === 'info' ? 'info' :
    dataQualityTone === 'success' ? 'success' :
    dataQualityTone === 'warning' ? 'warning' :
    dataQualityTone === 'critical' ? 'critical' : undefined;

  return (
    <Page
      title="Settings"
      subtitle="Configure AI recommendations, text customization, and features"
    >
      <BlockStack gap="500">
        {/* Success/Error Banners */}
        {showSuccessBanner && (
          <Banner tone="success">Settings saved successfully!</Banner>
        )}
        {showErrorBanner && (
          <Banner tone="critical">{errorMessage || 'Failed to save settings'}</Banner>
        )}

        {/* AI Recommendations */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">🤖 AI-Powered Recommendations</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Configure machine learning to show personalized product suggestions based on customer behavior.
              </Text>
            </BlockStack>

            <Checkbox
              label="Enable ML Recommendations"
              checked={formSettings.enableMLRecommendations}
              onChange={(value) => updateSetting("enableMLRecommendations", value)}
              helpText="Use machine learning to personalize product recommendations"
            />

            {formSettings.enableMLRecommendations && (
              <BlockStack gap="400">
                <Divider />

                {/* Data Control - PROMINENT */}
                <Card background="bg-surface-secondary">
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h3">🔒 You Control Your Data</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Choose what data the AI uses to learn. More data = better recommendations, but you decide what you're comfortable with.
                    </Text>

                    <Select
                      label="Privacy & Data Usage Level"
                      options={[
                        { label: '🔒 Basic - Product data only (No customer tracking)', value: 'basic' },
                        { label: '📊 Standard - Anonymous behavior patterns', value: 'standard' },
                        { label: '🎯 Advanced - Full personalization (Best results)', value: 'advanced' }
                      ]}
                      value={formSettings.mlPrivacyLevel || "basic"}
                      onChange={(value) => updateSetting("mlPrivacyLevel", value)}
                    />

                    {/* Explain what each level means */}
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        <strong>📊 Your current data:</strong>
                      </Text>
                      <InlineStack gap="200">
                        <Badge tone={badgeTone}>{ordersBadgeText}</Badge>
                        <Badge tone={badgeTone}>Quality: {dataQualityLabel}</Badge>
                      </InlineStack>
                      
                      {formSettings.mlPrivacyLevel === 'basic' && (
                        <Text as="p" variant="bodyMd" tone="subdued">
                          ℹ️ <strong>Basic mode:</strong> Uses product categories and order history only. No customer tracking. Anonymous and privacy-safe.
                        </Text>
                      )}
                      {formSettings.mlPrivacyLevel === 'standard' && (
                        <Text as="p" variant="bodyMd" tone="subdued">
                          ℹ️ <strong>Standard mode:</strong> Tracks anonymous shopping patterns (no personal info). Learns which products pair well together.
                        </Text>
                      )}
                      {formSettings.mlPrivacyLevel === 'advanced' && (
                        <>
                          <Text as="p" variant="bodyMd" tone="subdued">
                            ℹ️ <strong>Advanced mode:</strong> Full behavioral tracking for maximum personalization. Learns from individual customer preferences over time.
                          </Text>
                          <Banner tone="warning">
                            <Text as="p" variant="bodyMd">
                              Update your privacy policy to inform customers: "We analyze shopping patterns to improve product recommendations."
                            </Text>
                          </Banner>
                        </>
                      )}
                    </BlockStack>
                  </BlockStack>
                </Card>

                {/* ML Settings */}
                <FormLayout>
                  <Select
                    label="Recommendation Strategy"
                    options={[
                      { label: 'Balanced - Mix of AI and popular products', value: 'balanced' },
                      { label: 'AI-First - Prioritize personalized suggestions', value: 'ai_first' },
                      { label: 'Popular - Show bestsellers and trending items', value: 'popular' }
                    ]}
                    value={formSettings.mlPersonalizationMode || "balanced"}
                    onChange={(value) => updateSetting("mlPersonalizationMode", value)}
                    helpText="How the AI chooses which products to recommend"
                  />

                  <TextField
                    label="Data Retention Period"
                    type="number"
                    value={formSettings.mlDataRetentionDays || "90"}
                    onChange={(value) => updateSetting("mlDataRetentionDays", value)}
                    suffix="days"
                    helpText="How long to keep learning data. Longer = more accurate recommendations."
                    autoComplete="off"
                  />
                </FormLayout>

                <Divider />

                {/* Smart Threshold Features */}
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">🎯 Smart Threshold Suggestions</Text>
                  
                  <Checkbox
                    label="Help customers reach free shipping & gift thresholds"
                    checked={formSettings.enableThresholdBasedSuggestions}
                    onChange={(value) => updateSetting("enableThresholdBasedSuggestions", value)}
                    helpText="Suggest products at the right price to help customers unlock rewards (e.g., suggest $15 items when cart is $85 and threshold is $100)"
                  />

                  {formSettings.enableThresholdBasedSuggestions && (
                    <Select
                      label="Threshold Strategy"
                      options={[
                        { label: '🤖 Smart AI - Best relevance + price match', value: 'smart' },
                        { label: '💰 Price Only - Cheapest path to threshold', value: 'price' },
                        { label: '🔥 Popular + Price - Trending items at right price', value: 'popular_price' }
                      ]}
                      value={formSettings.thresholdSuggestionMode || 'smart'}
                      onChange={(value) => updateSetting("thresholdSuggestionMode", value)}
                    />
                  )}

                  <Checkbox
                    label="Hide recommendations after all thresholds met"
                    checked={formSettings.hideRecommendationsAfterThreshold}
                    onChange={(value) => updateSetting("hideRecommendationsAfterThreshold", value)}
                    helpText="Collapse recommendation section when customer has unlocked all rewards"
                  />
                </BlockStack>
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* Text Customization */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">✏️ Text & Copy</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Customize text shown to customers in the cart.
              </Text>
            </BlockStack>

            <FormLayout>
              <Text variant="headingSm" as="h3">🎁 Gift Settings</Text>
              
              <TextField
                label="Free Gift Price Label"
                value={formSettings.giftPriceText || "FREE"}
                onChange={(value) => updateSetting("giftPriceText", value)}
                helpText="Text shown instead of price for free gift products"
                placeholder="FREE"
                autoComplete="off"
              />

              <Divider />

              <Text variant="headingSm" as="h3">🔘 Button Labels</Text>

              <InlineStack gap="400" wrap>
                <TextField
                  label="Checkout Button"
                  value={formSettings.checkoutButtonText || "CHECKOUT"}
                  onChange={(value) => updateSetting("checkoutButtonText", value)}
                  autoComplete="off"
                />
                <TextField
                  label="Add Button"
                  value={formSettings.addButtonText || "Add"}
                  onChange={(value) => updateSetting("addButtonText", value)}
                  autoComplete="off"
                />
                <TextField
                  label="Apply Button"
                  value={formSettings.applyButtonText || "Apply"}
                  onChange={(value) => updateSetting("applyButtonText", value)}
                  autoComplete="off"
                />
              </InlineStack>
            </FormLayout>
          </BlockStack>
        </Card>

        {/* Save Button */}
        <Card>
          <InlineStack align="end">
            <Button
              variant="primary"
              tone={buttonSuccess ? "success" : undefined}
              size="large"
              onClick={handleSaveSettings}
              loading={isSaving}
              icon={buttonSuccess ? CheckIcon : undefined}
            >
              {isSaving ? "Saving..." : buttonSuccess ? "Saved!" : "Save Settings"}
            </Button>
          </InlineStack>
        </Card>
      </BlockStack>
    </Page>
  );
}