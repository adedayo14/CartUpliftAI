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
            {/* Hero */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <InlineStack gap="300" blockAlign="center">
                    <Text variant="heading2xl" as="h1">
                      Cart Uplift
                    </Text>
                    <Badge tone="success">Trial active</Badge>
                  </InlineStack>
                  <Text variant="bodyLg" as="p" tone="subdued">
                    Increase your average order value with AI-enhanced cross-selling that adapts to what customers actually like.
                  </Text>
                </BlockStack>

                <InlineStack gap="300">
                  <a href={`/app/settings${safeSearch}`} style={{ textDecoration: "none" }}>
                    <Button size="large" variant="primary">
                      Open settings
                    </Button>
                  </a>
                  <a href={`/admin/bundles${safeSearch}`} style={{ textDecoration: "none" }}>
                    <Button size="large" variant="secondary">
                      Manage bundles
                    </Button>
                  </a>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Setup/Activation Guide */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingMd" as="h3">
                      ⚡ Activate your cart
                    </Text>
                    <Badge tone="attention">Action required</Badge>
                  </InlineStack>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Enable the Cart Uplift app embed in your theme editor to show the enhanced cart to customers.
                  </Text>
                </BlockStack>
                <Box>
                  <BlockStack gap="300">
                    <Text variant="bodyMd" as="p" tone="subdued">
                      <strong>Steps:</strong> Open theme editor → Click Apps → Enable "Cart Uplift - Smart Cart"
                    </Text>
                    <InlineStack gap="300">
                      <Button
                        variant="primary"
                        url={`https://${shop}/admin/themes/current/editor?context=apps`}
                        target="_blank"
                      >
                        Open theme editor
                      </Button>
                      <Button
                        url="https://help.shopify.com/en/manual/online-store/themes/theme-structure/extend/apps#activate-app-embeds"
                        target="_blank"
                      >
                        View setup guide
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>

            {/* Features */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    Features that grow revenue
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Practical tools for higher spend and a smoother shopping experience.
                  </Text>
                </BlockStack>

                <Divider />

                <InlineGrid columns={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap="400">
                  {/* AI Recommendations */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Bespoke recommendations
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Suggestions tailored to each visitor, based on live browsing and purchase signals.
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
                        Spots items often bought together and builds bundles with flexible discounts.
                      </Text>
                    </BlockStack>
                  </Box>

                  {/* Progress incentives */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Progress incentives
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Progress bars for free shipping and rewards that help lift cart value.
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
                        Reward customers at set spend levels. The app handles the rest.
                      </Text>
                    </BlockStack>
                  </Box>

                  {/* Revenue analytics */}
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Revenue analytics
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Track impressions, clicks, conversions and attributed revenue in real time.
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* How it works */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    How it works
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Three steps to raise average order value.
                  </Text>
                </BlockStack>

                <Divider />

                <InlineGrid columns={{ xs: 1, md: 3 }} gap="500">
                  {/* Step 1 */}
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
                        Understands real behaviour
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        The model analyses browsing and purchase patterns to learn how your products relate each other.
                      </Text>
                    </BlockStack>
                  </BlockStack>

                  {/* Step 2 */}
                  <BlockStack gap="300">
                    <Box
                      background="bg-fill-success"
                      padding="200"
                      borderRadius="200"
                      width="32px"
                      minHeight="32px"
                    >
                      <Text variant="headingMd" as="span" alignment="center">
                        <span style={{ color: 'white' }}>2</span>
                      </Text>
                    </Box>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Shows relevant suggestions
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Personalised products and sensible bundles appear in cart and on product pages.
                      </Text>
                    </BlockStack>
                  </BlockStack>

                  {/* Step 3 */}
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
                        Measures and improves
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Built-in testing tracks performance and continually optimises the model. The more you use it the better it gets!
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* Why it works */}
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">
                    Why AI beats static rules
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Smarter recommendations, better results. Built to learn from real customer behaviour and adapt as patterns change.
                  </Text>
                </BlockStack>

                <Divider />

                <Box
                  padding="500"
                  borderRadius="300"
                >
                  <BlockStack gap="200">
                    <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Learns continuously
                        </Text>
                        <Text variant="bodyMd" as="p">
                          No fixed rules. The model adapts to what people view, click and buy so suggestions stay relevant.
                        </Text>
                      </BlockStack>

                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Personal to each shopper
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Not generic. Visitors see products that fit their intent and context on your site.
                        </Text>
                      </BlockStack>

                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Bundles that make sense
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Identifies products often bought together and offers fair discounts that feel natural.
                        </Text>
                      </BlockStack>

                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h3">
                          Optimises itself
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Tracks what converts and quietly removes suggestions that don't perform. Your recommendations get better over time.
                        </Text>
                      </BlockStack>
                    </InlineGrid>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>

            {/* Support */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">
                    Need help getting started?
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    We can help with set-up and best practice for your catalogue.
                  </Text>
                </BlockStack>
                <InlineStack gap="300">
                  <Button>Contact support</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
