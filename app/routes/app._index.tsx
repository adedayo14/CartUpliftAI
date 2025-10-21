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
  List,
} from "@shopify/polaris";
import { 
  CheckCircleIcon,
  AlertCircleIcon,
  ChartVerticalIcon,
  SettingsIcon,
  ThemeIcon,
  StarFilledIcon,
  GiftCardIcon,
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
    
    // Check if app block is enabled (you'd implement this check based on your app's logic)
    themeEnabled = false; // Replace with actual check
  } catch (err) {
    console.error('Failed to fetch current theme:', err);
  }

  const search = new URL(request.url).search;

  return json({ 
    shop, 
    currentThemeId,
    hasSettings: !!settings,
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

  // Calculate setup progress
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
        {/* Main Content */}
        <Layout.Section>
          <BlockStack gap="500">
            
            {/* Hero Section */}
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                  <BlockStack gap="200">
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <Text variant="heading2xl" as="h1">
                        Welcome to Cart Uplift
                      </Text>
                      <Badge tone="success" size="large">
                        Active Trial
                      </Badge>
                    </InlineStack>
                    <Text variant="bodyLg" as="p" tone="subdued">
                      AI-powered cart optimization that increases average order value by 18-32%
                    </Text>
                  </BlockStack>
                </InlineStack>

                {!isSetupComplete && (
                  <Box paddingBlockStart="400">
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          Setup progress: {completedSteps} of {setupSteps.length} steps
                        </Text>
                        <Text variant="bodyMd" as="span" tone="subdued">
                          {Math.round(setupProgress)}%
                        </Text>
                      </InlineStack>
                      <ProgressBar 
                        progress={setupProgress} 
                        size="small"
                        tone={isSetupComplete ? "success" : "primary"}
                      />
                    </BlockStack>
                  </Box>
                )}

                {isSetupComplete && (
                  <Banner tone="success">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={CheckCircleIcon} tone="success" />
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        Setup complete! Cart Uplift is now active and optimizing your store.
                      </Text>
                    </InlineStack>
                  </Banner>
                )}
              </BlockStack>
            </Card>

            {/* Quick Action Cards */}
            <InlineGrid columns={{ xs: 1, sm: 2, md: 2, lg: 2 }} gap="400">
              <Card>
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="start">
                    <Box 
                      background="bg-fill-info" 
                      padding="300" 
                      borderRadius="200"
                    >
                      <Icon source={ChartVerticalIcon} tone="info" />
                    </Box>
                    <BlockStack gap="100">
                      <Text variant="headingMd" as="h3" fontWeight="semibold">
                        Analytics Dashboard
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Track revenue impact and performance metrics
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  
                  <a 
                    href={`/admin/dashboard${safeSearch}`}
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    <Button variant="primary" fullWidth size="large">
                      View Analytics
                    </Button>
                  </a>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="start">
                    <Box 
                      background="bg-fill-magic" 
                      padding="300" 
                      borderRadius="200"
                    >
                      <Icon source={SettingsIcon} tone="magic" />
                    </Box>
                    <BlockStack gap="100">
                      <Text variant="headingMd" as="h3" fontWeight="semibold">
                        Configuration
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Customize AI, progress bars, and rewards
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  
                  <a 
                    href={`/app/settings${safeSearch}`}
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    <Button fullWidth size="large">
                      Manage Settings
                    </Button>
                  </a>
                </BlockStack>
              </Card>
            </InlineGrid>

            {/* Setup Checklist - Only show if not complete */}
            {!isSetupComplete && (
              <Card>
                <BlockStack gap="500">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={AlertCircleIcon} tone="info" />
                      <Text variant="headingMd" as="h2">
                        Complete your setup
                      </Text>
                    </InlineStack>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Follow these steps to activate Cart Uplift and start increasing your revenue
                    </Text>
                  </BlockStack>

                  <BlockStack gap="0">
                    {/* Step 1: Theme */}
                    <Box 
                      padding="400" 
                      background={themeEnabled ? "bg-surface-success-hover" : "bg-surface"}
                      borderBlockEndWidth="025"
                      borderColor="border"
                    >
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="start" wrap={false}>
                          <InlineStack gap="400" blockAlign="center" wrap={false}>
                            <Box minWidth="fit-content">
                              {themeEnabled ? (
                                <Box 
                                  background="bg-fill-success" 
                                  padding="200" 
                                  borderRadius="100"
                                  minWidth="32px"
                                  minHeight="32px"
                                >
                                  <Icon source={CheckCircleIcon} tone="success" />
                                </Box>
                              ) : (
                                <Box 
                                  background="bg-fill" 
                                  padding="200" 
                                  borderRadius="100"
                                  minWidth="32px"
                                  minHeight="32px"
                                  borderWidth="025"
                                  borderColor="border"
                                >
                                  <Icon source={ThemeIcon} />
                                </Box>
                              )}
                            </Box>
                            <BlockStack gap="100">
                              <Text variant="bodyLg" as="h3" fontWeight="semibold">
                                Enable app in your theme
                              </Text>
                              <Text variant="bodyMd" as="p" tone="subdued">
                                Add the Cart Uplift app block to your cart page
                              </Text>
                            </BlockStack>
                          </InlineStack>
                          
                          {themeEnabled && (
                            <Badge tone="success">Complete</Badge>
                          )}
                        </InlineStack>

                        {!themeEnabled && (
                          <Box paddingInlineStart="1200">
                            <a 
                              href={themeEditorUrl} 
                              target="_top" 
                              rel="noopener noreferrer"
                              style={{ textDecoration: 'none', display: 'inline-block' }}
                            >
                              <Button variant="primary" size="large">
                                Open Theme Editor
                              </Button>
                            </a>
                            <Box paddingBlockStart="200">
                              <Text variant="bodySm" as="p" tone="subdued">
                                Opens in theme customizer • Takes 30 seconds
                              </Text>
                            </Box>
                          </Box>
                        )}
                      </BlockStack>
                    </Box>

                    {/* Step 2: Settings */}
                    <Box 
                      padding="400" 
                      background={hasSettings ? "bg-surface-success-hover" : "bg-surface"}
                    >
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="start" wrap={false}>
                          <InlineStack gap="400" blockAlign="center" wrap={false}>
                            <Box minWidth="fit-content">
                              {hasSettings ? (
                                <Box 
                                  background="bg-fill-success" 
                                  padding="200" 
                                  borderRadius="100"
                                  minWidth="32px"
                                  minHeight="32px"
                                >
                                  <Icon source={CheckCircleIcon} tone="success" />
                                </Box>
                              ) : (
                                <Box 
                                  background="bg-fill" 
                                  padding="200" 
                                  borderRadius="100"
                                  minWidth="32px"
                                  minHeight="32px"
                                  borderWidth="025"
                                  borderColor="border"
                                >
                                  <Icon source={SettingsIcon} />
                                </Box>
                              )}
                            </Box>
                            <BlockStack gap="100">
                              <Text variant="bodyLg" as="h3" fontWeight="semibold">
                                Configure your settings
                              </Text>
                              <Text variant="bodyMd" as="p" tone="subdued">
                                Set up AI recommendations, progress bars, and rewards
                              </Text>
                            </BlockStack>
                          </InlineStack>
                          
                          {hasSettings && (
                            <Badge tone="success">Complete</Badge>
                          )}
                        </InlineStack>

                        {!hasSettings && (
                          <Box paddingInlineStart="1200">
                            <a 
                              href={`/app/settings${safeSearch}`}
                              style={{ textDecoration: 'none', display: 'inline-block' }}
                            >
                              <Button size="large">
                                Configure Settings
                              </Button>
                            </a>
                            <Box paddingBlockStart="200">
                              <Text variant="bodySm" as="p" tone="subdued">
                                Customize the experience for your customers
                              </Text>
                            </Box>
                          </Box>
                        )}
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </BlockStack>
              </Card>
            )}

            {/* Features Grid */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    Features that drive results
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Proven tools to increase average order value and conversion rates
                  </Text>
                </BlockStack>

                <InlineGrid columns={{ xs: 1, sm: 2, md: 2, lg: 2 }} gap="400">
                  {/* AI Recommendations */}
                  <Box 
                    padding="400" 
                    background="bg-surface-secondary" 
                    borderRadius="200"
                  >
                    <BlockStack gap="300">
                      <Box 
                        background="bg-fill-info" 
                        padding="200" 
                        borderRadius="100"
                        width="fit-content"
                      >
                        <Icon source={StarFilledIcon} tone="info" />
                      </Box>
                      <BlockStack gap="100">
                        <Text variant="headingMd" as="h3" fontWeight="semibold">
                          AI Recommendations
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Machine learning analyzes customer behavior to show the most relevant products
                        </Text>
                      </BlockStack>
                      <Badge tone="info">+18-32% AOV increase</Badge>
                    </BlockStack>
                  </Box>

                  {/* Progress Bars */}
                  <Box 
                    padding="400" 
                    background="bg-surface-secondary" 
                    borderRadius="200"
                  >
                    <BlockStack gap="300">
                      <Box 
                        background="bg-fill-success" 
                        padding="200" 
                        borderRadius="100"
                        width="fit-content"
                      >
                        <Icon source={StarFilledIcon} tone="success" />
                      </Box>
                      <BlockStack gap="100">
                        <Text variant="headingMd" as="h3" fontWeight="semibold">
                          Goal Progress Bars
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Visual indicators showing progress toward free shipping and rewards
                        </Text>
                      </BlockStack>
                      <Badge tone="success">68% reach threshold</Badge>
                    </BlockStack>
                  </Box>

                  {/* Gift with Purchase */}
                  <Box 
                    padding="400" 
                    background="bg-surface-secondary" 
                    borderRadius="200"
                  >
                    <BlockStack gap="300">
                      <Box 
                        background="bg-fill-warning" 
                        padding="200" 
                        borderRadius="100"
                        width="fit-content"
                      >
                        <Icon source={GiftCardIcon} tone="warning" />
                      </Box>
                      <BlockStack gap="100">
                        <Text variant="headingMd" as="h3" fontWeight="semibold">
                          Gift with Purchase
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Automatic rewards when customers reach spending milestones
                        </Text>
                      </BlockStack>
                      <Badge tone="warning">+$22 avg. spending lift</Badge>
                    </BlockStack>
                  </Box>

                  {/* Analytics */}
                  <Box 
                    padding="400" 
                    background="bg-surface-secondary" 
                    borderRadius="200"
                  >
                    <BlockStack gap="300">
                      <Box 
                        background="bg-fill-magic" 
                        padding="200" 
                        borderRadius="100"
                        width="fit-content"
                      >
                        <Icon source={ChartLineIcon} tone="magic" />
                      </Box>
                      <BlockStack gap="100">
                        <Text variant="headingMd" as="h3" fontWeight="semibold">
                          Revenue Analytics
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Real-time tracking of your revenue impact and performance metrics
                        </Text>
                      </BlockStack>
                      <Badge tone="magic">Live ROI tracking</Badge>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* How It Works */}
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

                <InlineGrid columns={{ xs: 1, sm: 2, md: 2, lg: 2 }} gap="400">
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
                          padding="200" 
                          borderRadius="100"
                        >
                          <Text variant="headingMd" as="span" fontWeight="bold" alignment="center">
                            ✕
                          </Text>
                        </Box>
                        <Text variant="headingMd" as="h3" fontWeight="semibold">
                          Generic recommendations
                        </Text>
                      </InlineStack>
                      
                      <List type="bullet">
                        <List.Item>Shows same products to everyone</List.Item>
                        <List.Item>Low relevance for most customers</List.Item>
                        <List.Item>Customers ignore recommendations</List.Item>
                      </List>

                      <Divider />

                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyLg" as="span" fontWeight="semibold">
                          Result:
                        </Text>
                        <Badge tone="critical" size="large">
                          5-10% click rate
                        </Badge>
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
                          padding="200" 
                          borderRadius="100"
                        >
                          <Icon source={CheckCircleIcon} tone="success" />
                        </Box>
                        <Text variant="headingMd" as="h3" fontWeight="semibold">
                          AI-powered recommendations
                        </Text>
                      </InlineStack>
                      
                      <List type="bullet">
                        <List.Item>Learns from customer behavior</List.Item>
                        <List.Item>Shows relevant products they want</List.Item>
                        <List.Item>Gets smarter with every interaction</List.Item>
                      </List>

                      <Divider />

                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyLg" as="span" fontWeight="semibold">
                          Result:
                        </Text>
                        <Badge tone="success" size="large">
                          35-50% click rate
                        </Badge>
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

            {/* Support Card */}
            <Card>
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3" fontWeight="semibold">
                    Need help getting started?
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Our team is here to help you succeed with personalized onboarding and support
                  </Text>
                </BlockStack>
                <InlineStack gap="300" wrap={false}>
                  <Button>
                    Contact Support
                  </Button>
                  <Button variant="plain">
                    View Docs
                  </Button>
                </InlineStack>
              </InlineStack>
            </Card>

          </BlockStack>
        </Layout.Section>

        {/* Sidebar - Optional Stats/Info */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            
            {/* Quick Stats */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2" fontWeight="semibold">
                  Average results
                </Text>
                
                <BlockStack gap="300">
                  <Box>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      +24%
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Average order value increase
                    </Text>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      41%
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Customers engage with AI picks
                    </Text>
                  </Box>
                  
                  <Divider />
                  
                  <Box>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      24-48h
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Time to see first results
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Resources */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2" fontWeight="semibold">
                  Resources
                </Text>
                
                <BlockStack gap="300">
                  <Button variant="plain" fullWidth textAlign="start">
                    Setup guide
                  </Button>
                  <Button variant="plain" fullWidth textAlign="start">
                    Best practices
                  </Button>
                  <Button variant="plain" fullWidth textAlign="start">
                    Video tutorials
                  </Button>
                  <Button variant="plain" fullWidth textAlign="start">
                    FAQs
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}