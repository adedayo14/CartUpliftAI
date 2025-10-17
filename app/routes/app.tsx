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
} from "@shopify/polaris";
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

  const search = new URL(request.url).search;

  return json({ 
    shop, 
    currentThemeId,
    hasSettings: !!settings,
    search,
  });
};

export default function Index() {
  const { shop, currentThemeId, hasSettings, search } = useLoaderData<typeof loader>();
  const safeSearch = search || "";

  const shopHandle = (shop || '').replace('.myshopify.com', '');
  const themeEditorUrl = currentThemeId
    ? `https://admin.shopify.com/store/${shopHandle}/themes/${currentThemeId}/editor?context=apps`
    : `https://admin.shopify.com/store/${shopHandle}/themes/current/editor?context=apps`;

  return (
    <Page>
      <TitleBar title="Cart Uplift" />
      
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Welcome Banner */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="heading2xl" as="h1">Welcome to Cart Uplift</Text>
                    <Badge tone="success">Active Trial</Badge>
                  </InlineStack>
                  <Text variant="bodyLg" tone="subdued">
                    AI-powered cart optimization to boost your revenue. Let's get you set up in 2 minutes.
                  </Text>
                </BlockStack>

                {!hasSettings && (
                  <Banner tone="info">
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="semibold">Quick setup required</Text>
                      <Text variant="bodyMd">
                        Follow the steps below to activate Cart Uplift and start seeing results.
                      </Text>
                    </BlockStack>
                  </Banner>
                )}
              </BlockStack>
            </Card>

            {/* Setup Steps */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Setup steps</Text>
                
                <BlockStack gap="400">
                  {/* Step 1 */}
                  <Box>
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <Box 
                          background="bg-surface-success" 
                          padding="200" 
                          borderRadius="100"
                          minWidth="32px"
                        >
                          <Text variant="bodyMd" fontWeight="semibold" alignment="center">1</Text>
                        </Box>
                        <BlockStack gap="100">
                          <Text variant="bodyLg" fontWeight="semibold">Enable app in your theme</Text>
                          <Text variant="bodyMd" tone="subdued">
                            Add Cart Uplift to your cart page - takes 30 seconds
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      
                      <Box paddingInlineStart="1200">
                        <a 
                          href={themeEditorUrl} 
                          target="_top" 
                          rel="noopener noreferrer"
                          style={{ textDecoration: 'none' }}
                        >
                          <Button variant="primary" size="large">
                            Open theme editor
                          </Button>
                        </a>
                      </Box>
                    </BlockStack>
                  </Box>

                  <Divider />

                  {/* Step 2 */}
                  <Box>
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <Box 
                          background="bg-surface-info" 
                          padding="200" 
                          borderRadius="100"
                          minWidth="32px"
                        >
                          <Text variant="bodyMd" fontWeight="semibold" alignment="center">2</Text>
                        </Box>
                        <BlockStack gap="100">
                          <Text variant="bodyLg" fontWeight="semibold">Configure your settings</Text>
                          <Text variant="bodyMd" tone="subdued">
                            Set up AI recommendations, progress bars, and rewards
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      
                      <Box paddingInlineStart="1200">
                        <a 
                          href={`/app/settings${safeSearch}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Button size="large">
                            Configure settings
                          </Button>
                        </a>
                      </Box>
                    </BlockStack>
                  </Box>

                  <Divider />

                  {/* Step 3 */}
                  <Box>
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <Box 
                          background="bg-surface-warning" 
                          padding="200" 
                          borderRadius="100"
                          minWidth="32px"
                        >
                          <Text variant="bodyMd" fontWeight="semibold" alignment="center">3</Text>
                        </Box>
                        <BlockStack gap="100">
                          <Text variant="bodyLg" fontWeight="semibold">Track your results</Text>
                          <Text variant="bodyMd" tone="subdued">
                            See real-time revenue impact and optimization insights
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      
                      <Box paddingInlineStart="1200">
                        <a 
                          href={`/admin/dashboard${safeSearch}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Button size="large">
                            View analytics
                          </Button>
                        </a>
                      </Box>
                    </BlockStack>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Why It Works */}
            <Card>
              <BlockStack gap="500">
                <Text variant="headingMd" as="h2">Why personalized recommendations work</Text>
                
                <Layout>
                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-critical">
                      <BlockStack gap="300">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="headingMd" fontWeight="semibold">❌</Text>
                          <Text variant="headingMd" fontWeight="semibold">Random recommendations</Text>
                        </InlineStack>
                        <Text variant="bodyMd">
                          Shows the same products to everyone. Low relevance means customers ignore them.
                        </Text>
                        <Box paddingBlockStart="200">
                          <Badge tone="critical" size="large">5-10% click rate</Badge>
                        </Box>
                      </BlockStack>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <Card background="bg-surface-success">
                      <BlockStack gap="300">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="headingMd" fontWeight="semibold">✅</Text>
                          <Text variant="headingMd" fontWeight="semibold">AI-powered recommendations</Text>
                        </InlineStack>
                        <Text variant="bodyMd">
                          Learns what each customer wants. Shows relevant products they're likely to buy.
                        </Text>
                        <Box paddingBlockStart="200">
                          <Badge tone="success" size="large">35-50% click rate</Badge>
                        </Box>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>

                <Banner tone="info">
                  <Text variant="bodyMd">
                    The AI learns from every customer interaction, getting smarter over time. Most stores see results within 24-48 hours.
                  </Text>
                </Banner>
              </BlockStack>
            </Card>

            {/* Features Overview */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">What's included</Text>
                
                <Layout>
                  <Layout.Section variant="oneHalf">
                    <BlockStack gap="400">
                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="headingMd">✨</Text>
                          <Text variant="bodyLg" fontWeight="semibold">AI recommendations</Text>
                        </InlineStack>
                        <Text variant="bodyMd" tone="subdued">
                          Machine learning shows products customers actually want to buy
                        </Text>
                        <Badge tone="info">Increases AOV by 18-32%</Badge>
                      </BlockStack>

                      <Divider />

                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="headingMd">📊</Text>
                          <Text variant="bodyLg" fontWeight="semibold">Progress bars</Text>
                        </InlineStack>
                        <Text variant="bodyMd" tone="subdued">
                          Show customers how close they are to free shipping and rewards
                        </Text>
                        <Badge tone="success">68% reach threshold</Badge>
                      </BlockStack>
                    </BlockStack>
                  </Layout.Section>

                  <Layout.Section variant="oneHalf">
                    <BlockStack gap="400">
                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="headingMd">🎁</Text>
                          <Text variant="bodyLg" fontWeight="semibold">Gift with purchase</Text>
                        </InlineStack>
                        <Text variant="bodyMd" tone="subdued">
                          Reward customers automatically when they hit spending milestones
                        </Text>
                        <Badge tone="warning">Motivates +$22 spending</Badge>
                      </BlockStack>

                      <Divider />

                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="headingMd">💰</Text>
                          <Text variant="bodyLg" fontWeight="semibold">Revenue analytics</Text>
                        </InlineStack>
                        <Text variant="bodyMd" tone="subdued">
                          Track exactly how much extra revenue you're generating in real-time
                        </Text>
                        <Badge tone="magic">See your ROI instantly</Badge>
                      </BlockStack>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>

            {/* Quick Links */}
            <Layout>
              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" fontWeight="semibold">📊 Analytics dashboard</Text>
                    <Text variant="bodyMd" tone="subdued">
                      See your revenue impact, conversion rates, and top products
                    </Text>
                    <a 
                      href={`/admin/dashboard${safeSearch}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <Button variant="primary" fullWidth>
                        View dashboard
                      </Button>
                    </a>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" fontWeight="semibold">⚙️ App settings</Text>
                    <Text variant="bodyMd" tone="subdued">
                      Configure AI, progress bars, gifts, and customize the experience
                    </Text>
                    <a 
                      href={`/app/settings${safeSearch}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <Button fullWidth>
                        Manage settings
                      </Button>
                    </a>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>

            {/* Support */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" fontWeight="semibold">Need help?</Text>
                <Text variant="bodyMd" tone="subdued">
                  Our support team is here to help you succeed. Reach out if you have any questions during setup.
                </Text>
                <InlineStack gap="300">
                  <Button>Contact support</Button>
                  <Button variant="plain">View documentation</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}