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
  Icon,
  InlineGrid,
} from "@shopify/polaris";
import { 
  CheckCircleIcon,
} from "@shopify/polaris-icons";
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
              </BlockStack>
            </Card>

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
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        AI recommendations
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Machine learning analyzes customer behavior to show the most relevant products
                      </Text>
                    </BlockStack>
                  </Box>

                  {/* Goal Progress Bars */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Goal progress bars
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Visual indicators showing progress toward free shipping and rewards
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
                        AI-powered product bundles with automatic discounts on product pages
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
                        Automatic rewards when customers reach spending milestones
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
                        Track revenue impact and performance metrics in real-time
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* How It Works - AI Benefits */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    Why AI-powered recommendations work better
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Smart recommendations and bundles that drive real results
                  </Text>
                </BlockStack>

                <Divider />

                {/* AI-Powered Benefits */}
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
                        AI-powered recommendations & smart bundles
                      </Text>
                    </InlineStack>
                    
                    <BlockStack gap="300">
                      <Text variant="bodyMd" as="p">
                        <strong>Personalized Product Recommendations</strong>
                      </Text>
                      <BlockStack gap="200" inlineAlign="start">
                        <Text variant="bodyMd" as="p">
                          • Learns from customer behavior and purchase patterns
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Shows products each customer actually wants to buy
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Gets smarter with every interaction
                        </Text>
                      </BlockStack>

                      <Divider />

                      <Text variant="bodyMd" as="p">
                        <strong>Intelligent Bundle Creation</strong>
                      </Text>
                      <BlockStack gap="200" inlineAlign="start">
                        <Text variant="bodyMd" as="p">
                          • Automatically creates product bundles from co-purchase data
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Offers dynamic discounts (10-25%) based on bundle value
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Shows bundles on product pages and cart drawer
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Manual bundle override for strategic promotions
                        </Text>
                      </BlockStack>

                      <Divider />

                      <Text variant="bodyMd" as="p">
                        <strong>Continuous Optimization</strong>
                      </Text>
                      <BlockStack gap="200" inlineAlign="start">
                        <Text variant="bodyMd" as="p">
                          • A/B testing built-in to find what works best
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Tracks impressions, clicks, and conversions
                        </Text>
                        <Text variant="bodyMd" as="p">
                          • Measures direct revenue attribution
                        </Text>
                      </BlockStack>
                    </BlockStack>

                    <Divider />

                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="headingMd" as="span">
                        Typical Results:
                      </Text>
                      <Badge tone="success" size="large">35-50% click rate</Badge>
                    </InlineStack>
                  </BlockStack>
                </Box>

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