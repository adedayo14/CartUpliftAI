import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Banner,
  Box,
  Divider,
  ProgressBar,
  Icon,
  InlineGrid,
} from "@shopify/polaris";
import { 
  CheckCircleIcon,
  AlertCircleIcon,
  XCircleIcon,
  StarFilledIcon,
  GiftIcon,
  ChartVerticalIcon,
  PackageIcon,
  ChartLineIcon,
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await prisma.settings.findUnique({
    where: { shop },
  });

  let currentThemeId: string | null = null;
  let themeEnabled = false;
  
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
    
    themeEnabled = false; // Replace with actual check
  } catch (err) {
    console.error('Failed to fetch current theme:', err);
  }

  const search = new URL(request.url).search;

  const isSettingsConfigured = settings && (
    settings.enableRecommendations !== null ||
    settings.enableFreeShipping !== null ||
    settings.enableGiftGating !== null ||
    settings.freeShippingThreshold !== null
  );

  return json({ 
    shop, 
    currentThemeId,
    hasSettings: isSettingsConfigured,
    themeEnabled,
    search,
  });
};

export default function Index() {
  const { shop, currentThemeId, hasSettings, themeEnabled, search } = useLoaderData<typeof loader>();
  const safeSearch = search || "";

  const shopHandle = (shop || '').replace('.myshopify.com', '');
  const themeEditorUrl = currentThemeId
    ? `https://admin.shopify.com/store/${shopHandle}/themes/${currentThemeId}/editor?context=apps`
    : `https://admin.shopify.com/store/${shopHandle}/themes/current/editor?context=apps`;

  const setupSteps = [
    { id: 'theme', label: 'Theme enabled', completed: themeEnabled },
    { id: 'settings', label: 'Settings configured', completed: hasSettings },
  ];
  const completedSteps = setupSteps.filter(step => step.completed).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;
  const isSetupComplete = completedSteps === setupSteps.length;

  return (
    <Page>
      <TitleBar title="Cart Uplift" />
      
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            
            {/* Hero Section */}
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <InlineStack gap="300" blockAlign="center">
                      <Text variant="heading2xl" as="h1">
                        Welcome to Cart Uplift
                      </Text>
                      <Badge tone="success">Active Trial</Badge>
                    </InlineStack>
                    <Text variant="bodyLg" as="p" tone="subdued">
                      AI-powered cart recommendations and smart bundling for your store
                    </Text>
                  </BlockStack>
                  
                  <InlineStack gap="300">
                    <a href={`/app/settings${safeSearch}`} style={{ textDecoration: 'none' }}>
                      <Button size="large">Configure settings</Button>
                    </a>
                    <a href={`/admin/bundles${safeSearch}`} style={{ textDecoration: 'none' }}>
                      <Button size="large" variant="secondary">Manage bundles</Button>
                    </a>
                  </InlineStack>
                </InlineStack>

                {!isSetupComplete && (
                  <>
                    <Divider />
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingMd" as="p">
                          Setup progress: {completedSteps} of {setupSteps.length} complete
                        </Text>
                        <Text variant="bodySm" as="span" tone="subdued">
                          {Math.round(setupProgress)}%
                        </Text>
                      </InlineStack>
                      <ProgressBar 
                        progress={setupProgress} 
                        size="medium"
                        tone={isSetupComplete ? "success" : "primary"}
                      />
                    </BlockStack>
                  </>
                )}

                {isSetupComplete && (
                  <>
                    <Divider />
                    <Banner tone="success">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={CheckCircleIcon} tone="success" />
                        <Text variant="bodyMd" as="p">
                          Setup complete! Cart Uplift is active and optimizing your store.
                        </Text>
                      </InlineStack>
                    </Banner>
                  </>
                )}
              </BlockStack>
            </Card>

            {/* Setup Checklist */}
            {!isSetupComplete && (
              <Card>
                <BlockStack gap="500">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={AlertCircleIcon} tone="info" />
                      <Text variant="headingLg" as="h2">
                        Complete your setup
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Follow these steps to activate Cart Uplift and start increasing your revenue
                    </Text>
                  </BlockStack>

                  <Divider />

                  <BlockStack gap="400">
                    {/* Step 1: Theme */}
                    <Box 
                      padding="500" 
                      background={themeEnabled ? "bg-surface-success" : "bg-surface-secondary"}
                      borderRadius="300"
                    >
                      <InlineStack align="space-between" blockAlign="start">
                        <BlockStack gap="300">
                          <InlineStack gap="300" blockAlign="center">
                            <Box 
                              background={themeEnabled ? "bg-fill-success" : "bg-fill"} 
                              padding="200" 
                              borderRadius="200"
                              minWidth="32px"
                              minHeight="32px"
                            >
                              <Icon 
                                source={themeEnabled ? CheckCircleIcon : AlertCircleIcon} 
                                tone={themeEnabled ? "success" : "base"} 
                              />
                            </Box>
                            <BlockStack gap="100">
                              <Text variant="headingMd" as="h3">
                                Enable app in your theme
                              </Text>
                              <Text variant="bodyMd" as="p" tone="subdued">
                                Add the Cart Uplift app block to your cart page
                              </Text>
                            </BlockStack>
                          </InlineStack>
                          
                          {!themeEnabled && (
                            <Text variant="bodySm" as="p" tone="subdued">
                              Opens in theme customizer • Takes 30 seconds
                            </Text>
                          )}
                        </BlockStack>
                        
                        {!themeEnabled && (
                          <a 
                            href={themeEditorUrl}
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none' }}
                          >
                            <Button size="large">Open Theme Editor</Button>
                          </a>
                        )}
                        
                        {themeEnabled && (
                          <Badge tone="success" size="large">Complete</Badge>
                        )}
                      </InlineStack>
                    </Box>

                    {/* Step 2: Settings */}
                    <Box 
                      padding="500" 
                      background={hasSettings ? "bg-surface-success" : "bg-surface-secondary"}
                      borderRadius="300"
                    >
                      <InlineStack align="space-between" blockAlign="start">
                        <BlockStack gap="300">
                          <InlineStack gap="300" blockAlign="center">
                            <Box 
                              background={hasSettings ? "bg-fill-success" : "bg-fill"} 
                              padding="200" 
                              borderRadius="200"
                              minWidth="32px"
                              minHeight="32px"
                            >
                              <Icon 
                                source={hasSettings ? CheckCircleIcon : AlertCircleIcon} 
                                tone={hasSettings ? "success" : "base"} 
                              />
                            </Box>
                            <BlockStack gap="100">
                              <Text variant="headingMd" as="h3">
                                Configure your settings
                              </Text>
                              <Text variant="bodyMd" as="p" tone="subdued">
                                Set up AI recommendations, progress bars, and rewards
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </BlockStack>
                        
                        {!hasSettings && (
                          <a 
                            href={`/app/settings${safeSearch}`}
                            style={{ textDecoration: 'none' }}
                          >
                            <Button size="large">Configure Settings</Button>
                          </a>
                        )}
                        
                        {hasSettings && (
                          <Badge tone="success" size="large">Complete</Badge>
                        )}
                      </InlineStack>
                    </Box>
                  </BlockStack>
                </BlockStack>
              </Card>
            )}

            {/* Key Features */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    Key features
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Tools to enhance your cart experience and encourage larger orders
                  </Text>
                </BlockStack>

                <Divider />

                <InlineGrid columns={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap="400">
                  {/* AI Recommendations */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="300">
                      <Box 
                        background="bg-surface-info-active" 
                        padding="400" 
                        borderRadius="200"
                        width="56px"
                        height="56px"
                      >
                        <Icon source={StarFilledIcon} tone="info" />
                      </Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          AI recommendations
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Machine learning analyzes customer behavior to show the most relevant products
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>

                  {/* Goal Progress Bars */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="300">
                      <Box 
                        background="bg-surface-success-active" 
                        padding="400" 
                        borderRadius="200"
                        width="56px"
                        height="56px"
                      >
                        <Icon source={ChartLineIcon} tone="success" />
                      </Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Goal progress bars
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Visual indicators showing progress toward free shipping and rewards
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>

                  {/* Smart Bundles */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="300">
                      <Box 
                        background="bg-surface-brand-active" 
                        padding="400" 
                        borderRadius="200"
                        width="56px"
                        height="56px"
                      >
                        <Icon source={PackageIcon} />
                      </Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Smart bundles
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          AI-powered product bundles with automatic discounts on product pages
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>

                  {/* Gift with Purchase */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="300">
                      <Box 
                        background="bg-surface-warning-active" 
                        padding="400" 
                        borderRadius="200"
                        width="56px"
                        height="56px"
                      >
                        <Icon source={GiftIcon} tone="warning" />
                      </Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Gift with purchase
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Automatic rewards when customers reach spending milestones
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>

                  {/* Revenue Analytics */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="300">
                      <Box 
                        background="bg-surface-emphasis-active" 
                        padding="400" 
                        borderRadius="200"
                        width="56px"
                        height="56px"
                      >
                        <Icon source={ChartVerticalIcon} />
                      </Box>
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Revenue analytics
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Track revenue impact and performance metrics in real-time
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* How It Works - Comparison */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    How AI recommendations work
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    The difference between generic and personalized product recommendations
                  </Text>
                </BlockStack>

                <Divider />

                <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                  {/* Generic Approach */}
                  <Box 
                    padding="500" 
                    background="bg-surface-critical-hover" 
                    borderRadius="300"
                    borderWidth="025"
                    borderColor="border-critical"
                  >
                    <BlockStack gap="400">
                      <InlineStack gap="300" blockAlign="center">
                        <Box 
                          background="bg-fill-critical" 
                          padding="300" 
                          borderRadius="200"
                          minWidth="40px"
                          minHeight="40px"
                        >
                          <Icon source={XCircleIcon} tone="critical" />
                        </Box>
                        <Text variant="headingMd" as="h3">
                          Generic recommendations
                        </Text>
                      </InlineStack>
                      
                      <BlockStack gap="200">
                        <Text variant="bodyMd" as="p">
                          • Shows same products to everyone
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Low relevance for most customers
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Customers ignore recommendations
                        </Text>
                      </BlockStack>

                      <Divider />

                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="headingMd" as="span">
                          Result:
                        </Text>
                        <Badge tone="critical" size="large">5-10% click rate</Badge>
                      </InlineStack>
                    </BlockStack>
                  </Box>

                  {/* AI-Powered Approach */}
                  <Box 
                    padding="500" 
                    background="bg-surface-success-hover" 
                    borderRadius="300"
                    borderWidth="025"
                    borderColor="border-success"
                  >
                    <BlockStack gap="400">
                      <InlineStack gap="300" blockAlign="center">
                        <Box 
                          background="bg-fill-success" 
                          padding="300" 
                          borderRadius="200"
                          minWidth="40px"
                          minHeight="40px"
                        >
                          <Icon source={CheckCircleIcon} tone="success" />
                        </Box>
                        <Text variant="headingMd" as="h3">
                          AI-powered recommendations
                        </Text>
                      </InlineStack>
                      
                      <BlockStack gap="200">
                        <Text variant="bodyMd" as="p">
                          • Learns from customer behavior
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Shows relevant products they want
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Gets smarter with every interaction
                        </Text>
                      </BlockStack>

                      <Divider />

                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="headingMd" as="span">
                          Result:
                        </Text>
                        <Badge tone="success" size="large">35-50% click rate</Badge>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </InlineGrid>

                <Banner tone="info">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Results typically appear within 24-48 hours
                    </Text>
                    <Text variant="bodyMd" as="p">
                      The AI continuously learns from customer interactions and improves over time. Most stores see measurable results within the first two days of activation.
                    </Text>
                  </BlockStack>
                </Banner>
              </BlockStack>
            </Card>

            {/* How It Works - Process */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    How it works
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Three simple steps to boost your cart value
                  </Text>
                </BlockStack>

                <Divider />

                <InlineGrid columns={{ xs: 1, md: 3 }} gap="500">
                  <BlockStack gap="300">
                    <Box 
                      background="bg-fill-info" 
                      padding="300" 
                      borderRadius="200"
                      width="48px"
                      height="48px"
                    >
                      <Text variant="headingLg" as="span" alignment="center">
                        1
                      </Text>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        AI learns your store
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Our ML engine analyzes purchase patterns and product relationships
                      </Text>
                    </BlockStack>
                  </BlockStack>

                  <BlockStack gap="300">
                    <Box 
                      background="bg-fill-success" 
                      padding="300" 
                      borderRadius="200"
                      width="48px"
                      height="48px"
                    >
                      <Text variant="headingLg" as="span" alignment="center">
                        2
                      </Text>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Smart recommendations
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Show relevant products in cart and on product pages
                      </Text>
                    </BlockStack>
                  </BlockStack>

                  <BlockStack gap="300">
                    <Box 
                      background="bg-fill-warning" 
                      padding="300" 
                      borderRadius="200"
                      width="48px"
                      height="48px"
                    >
                      <Text variant="headingLg" as="span" alignment="center">
                        3
                      </Text>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Track performance
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Monitor clicks, conversions, and revenue in your dashboard
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* Support & Resources */}
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Need help getting started?
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Our team is here to help you succeed with personalized onboarding and support
                    </Text>
                  </BlockStack>
                  <InlineStack gap="300">
                    <Button>Contact Support</Button>
                    <Button variant="plain">View Docs</Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">
                    Resources
                  </Text>
                  <BlockStack gap="200">
                    <Button variant="plain" textAlign="start" fullWidth>
                      Setup guide
                    </Button>
                    <Button variant="plain" textAlign="start" fullWidth>
                      Best practices
                    </Button>
                    <Button variant="plain" textAlign="start" fullWidth>
                      Video tutorials
                    </Button>
                    <Button variant="plain" textAlign="start" fullWidth>
                      FAQs
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>
            </InlineGrid>

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}