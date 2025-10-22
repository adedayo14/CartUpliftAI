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
  InlineGrid,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const search = new URL(request.url).search;

  return json({ 
    shop,
    search,
  });
};

export default function Index() {
  const { shop, search } = useLoaderData<typeof loader>();
  const safeSearch = search || "";

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
                        Cart Uplift
                      </Text>
                      <Badge tone="success">Active Trial</Badge>
                    </InlineStack>
                    <Text variant="bodyLg" as="p" tone="subdued">
                      Increase cart value with AI-powered recommendations and smart bundles
                    </Text>
                  </BlockStack>
                  
                  <InlineStack gap="300">
                    <a href={`/app/settings${safeSearch}`} style={{ textDecoration: 'none' }}>
                      <Button size="large" variant="primary">Configure settings</Button>
                    </a>
                    <a href={`/admin/bundles${safeSearch}`} style={{ textDecoration: 'none' }}>
                      <Button size="large" variant="secondary">Manage bundles</Button>
                    </a>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* How It Works */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    How it works
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Three simple steps to increase your average order value
                  </Text>
                </BlockStack>

                <Divider />

                <InlineGrid columns={{ xs: 1, md: 3 }} gap="500">
                  <BlockStack gap="300">
                    <Box 
                      background="bg-fill-info" 
                      padding="200" 
                      borderRadius="200"
                      width="32px"
                      minHeight="32px"
                    >
                      <Text variant="headingMd" as="span" alignment="center">
                        1
                      </Text>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        AI learns your store
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Machine learning analyzes purchase patterns and customer behavior to understand product relationships
                      </Text>
                    </BlockStack>
                  </BlockStack>

                  <BlockStack gap="300">
                    <Box 
                      background="bg-fill-success" 
                      padding="200" 
                      borderRadius="200"
                      width="32px"
                      minHeight="32px"
                    >
                      <Text variant="headingMd" as="span" alignment="center">
                        2
                      </Text>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Show smart recommendations
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Display personalized product suggestions and bundles in cart and on product pages
                      </Text>
                    </BlockStack>
                  </BlockStack>

                  <BlockStack gap="300">
                    <Box 
                      background="bg-fill-warning" 
                      padding="200" 
                      borderRadius="200"
                      width="32px"
                      minHeight="32px"
                    >
                      <Text variant="headingMd" as="span" alignment="center">
                        3
                      </Text>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Track and optimize
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Monitor performance with real-time analytics and let AI continuously improve results
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* Key Features */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    Features designed to boost revenue
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Everything you need to increase cart value and customer satisfaction
                  </Text>
                </BlockStack>

                <Divider />

                <InlineGrid columns={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap="400">
                  {/* AI Recommendations */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        AI recommendations
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Show personalized products based on customer behavior and purchase patterns
                      </Text>
                    </BlockStack>
                  </Box>

                  {/* Smart Bundles */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Smart bundles
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Create product bundles automatically with dynamic discounting
                      </Text>
                    </BlockStack>
                  </Box>

                  {/* Goal Progress Bars */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Progress incentives
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Visual progress bars for free shipping and gift thresholds
                      </Text>
                    </BlockStack>
                  </Box>

                  {/* Gift with purchase */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Gift with purchase
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Reward customers automatically when they reach spending milestones
                      </Text>
                    </BlockStack>
                  </Box>

                  {/* Revenue Analytics */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Revenue analytics
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Track performance and revenue attribution in real-time
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* Why It Works Better */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    Smarter recommendations, better results
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Built to learn from your customers
                  </Text>
                </BlockStack>

                <Divider />

                <Box 
                  padding="500" 
                  background="bg-surface-success-hover" 
                  borderRadius="300"
                  borderWidth="025"
                  borderColor="border-success"
                >
                  <BlockStack gap="400">
                    <InlineGrid columns={{ xs: 1, md: 2 }} gap="500">
                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">
                          Adapts to real behavior
                        </Text>
                        <Text variant="bodyMd" as="p">
                          This isn't static automation. The system studies what customers actually do—what they view, click, and buy—and adapts continuously to make every suggestion more relevant.
                        </Text>
                      </BlockStack>

                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">
                          Personal to every shopper
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Each visitor sees products they're actually likely to buy, not random "you might also like" fillers. The recommendations match their browsing patterns and interests.
                        </Text>
                      </BlockStack>

                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">
                          Understands product relationships
                        </Text>
                        <Text variant="bodyMd" as="p">
                          It spots which items are frequently bought together and creates smart bundles with flexible discounts (10-25%). No manual setup required.
                        </Text>
                      </BlockStack>

                      <BlockStack gap="300">
                        <Text variant="headingMd" as="h3">
                          Improves itself automatically
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Built-in testing tracks what performs best—from clicks to conversions—and refines recommendations in real time. You get better results without lifting a finger.
                        </Text>
                      </BlockStack>
                    </InlineGrid>

                    <Divider />

                    <InlineStack gap="300" blockAlign="center" align="space-between" wrap={false}>
                      <Text variant="bodyMd" as="span">
                        Typical click rate:
                      </Text>
                      <Badge tone="success" size="large">35-50%</Badge>
                    </InlineStack>
                  </BlockStack>
                </Box>

                <Banner tone="info">
                  <Text variant="bodyMd" as="p">
                    <strong>See results in 24-48 hours.</strong> Most stores notice measurable improvements within the first two days as the system learns from customer interactions.
                  </Text>
                </Banner>
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
                      Our team is here to help you maximize your results
                    </Text>
                  </BlockStack>
                  <InlineStack gap="300">
                    <Button>Contact support</Button>
                    <Button variant="plain">View documentation</Button>
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