import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useCallback } from "react";
import {
  Page,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Grid,
  Icon,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { 
  SettingsIcon,
  ChartVerticalIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Get current settings
  const settings = await prisma.settings.findUnique({
    where: { shop },
  });

  // Get the current theme ID for direct linking to Theme Editor
  let currentThemeId: string | null = null;
  try {
    const response = await admin.graphql(`
      #graphql
      query getCurrentThemeForAppIndex {
        themes(first: 50) {
          edges {
            node { id name role }
          }
        }
      }
    `);
    const responseJson = await response.json();
    const themes = responseJson.data?.themes?.edges || [];
    const currentTheme = themes.find((t: any) => t.node.role === 'MAIN');
    if (currentTheme) {
      currentThemeId = currentTheme.node.id.split('/').pop();
    }
  } catch (err) {
    console.error('Failed to fetch current theme:', err);
  }

  return json({ 
    shop, 
    currentThemeId,
    hasSettings: !!settings,
  });
};

export default function Index() {
  const { shop, currentThemeId, hasSettings } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Build absolute admin URL so it doesn't try to open inside the embed iframe
  const shopHandle = (shop || '').replace('.myshopify.com', '');
  const themeEditorUrl = currentThemeId
    ? `https://admin.shopify.com/store/${shopHandle}/themes/${currentThemeId}/editor?context=apps`
    : `https://admin.shopify.com/store/${shopHandle}/themes/current/editor?context=apps`;

  return (
    <Page>
      <TitleBar title="Cart Uplift" />
      
      <BlockStack gap="600">
        {/* Hero Section */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="h1" variant="headingXl">
                Welcome to Cart Uplift 🎉
              </Text>
              <Text as="p" variant="bodyLg" tone="subdued">
                Increase your average order value with AI-powered recommendations, free shipping progress bars, and gift rewards.
              </Text>
            </BlockStack>

            {/* Primary CTA - Enable Theme Embed */}
            <Banner tone="info">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  👉 First step: Enable the app in your theme
                </Text>
                <Text as="p" variant="bodyMd">
                  Go to your theme editor, click "App embeds" in the sidebar, find "Cart Uplift - Smart Cart" and toggle it ON.
                </Text>
              </BlockStack>
            </Banner>

            <InlineStack gap="300" align="start">
              <a href={themeEditorUrl} target="_top" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <Button size="large" variant="primary">
                  Enable Theme Embed
                </Button>
              </a>
              <Button 
                size="large" 
                onClick={() => handleNavigate("/app/settings")}
                icon={SettingsIcon}
              >
                Configure Settings
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* What We Do */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              What Cart Uplift Does
            </Text>
            <Grid columns={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2 }}>
              <Grid.Cell>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    🤖 AI Product Recommendations
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Smart suggestions based on customer behavior and purchase patterns to increase cart value.
                  </Text>
                </BlockStack>
              </Grid.Cell>

              <Grid.Cell>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    📊 Free Shipping Progress
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Dynamic progress bars that motivate customers to reach your free shipping threshold.
                  </Text>
                </BlockStack>
              </Grid.Cell>

              <Grid.Cell>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    🎁 Gift with Purchase
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Automatic gift rewards when customers reach spending thresholds to boost AOV.
                  </Text>
                </BlockStack>
              </Grid.Cell>

              <Grid.Cell>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    📈 Performance Analytics
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Real-time insights showing exactly how much additional revenue you're generating.
                  </Text>
                </BlockStack>
              </Grid.Cell>
            </Grid>
          </BlockStack>
        </Card>

        {/* Quick Access Cards */}
        <Grid columns={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2 }}>
          <Grid.Cell>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="start">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">
                      Analytics Dashboard
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Track revenue impact, conversion rates, and top-performing products.
                    </Text>
                  </BlockStack>
                  <Icon source={ChartVerticalIcon} tone="base" />
                </InlineStack>
                <Button 
                  variant="primary" 
                  onClick={() => handleNavigate("/app/dashboard")}
                  fullWidth
                >
                  View Dashboard
                </Button>
              </BlockStack>
            </Card>
          </Grid.Cell>

          <Grid.Cell>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="start">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">
                      App Settings
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Configure ML recommendations, text customization, and feature controls.
                    </Text>
                  </BlockStack>
                  <Icon source={SettingsIcon} tone="base" />
                </InlineStack>
                <Button 
                  onClick={() => handleNavigate("/app/settings")}
                  fullWidth
                >
                  Manage Settings
                </Button>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* Getting Started Guide */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              Quick Start Guide
            </Text>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center">
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  background: '#000', 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}>
                  1
                </div>
                <Text as="p" variant="bodyMd">
                  <strong>Enable the app embed</strong> in your theme editor (click button above)
                </Text>
              </InlineStack>

              <InlineStack gap="200" blockAlign="center">
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  background: '#000', 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}>
                  2
                </div>
                <Text as="p" variant="bodyMd">
                  <strong>Configure your settings</strong> - Set up ML recommendations, free shipping thresholds, and gifts
                </Text>
              </InlineStack>

              <InlineStack gap="200" blockAlign="center">
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  background: '#000', 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}>
                  3
                </div>
                <Text as="p" variant="bodyMd">
                  <strong>Monitor performance</strong> in the Analytics Dashboard to track your ROI
                </Text>
              </InlineStack>
            </BlockStack>

            {!hasSettings && (
              <Banner tone="warning">
                <Text as="p" variant="bodyMd">
                  💡 Tip: Start by configuring your settings to enable features and customize the cart experience.
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
