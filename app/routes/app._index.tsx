import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Badge,
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

  return json({ 
    shop, 
    currentThemeId,
    hasSettings: !!settings,
  });
};

export default function Index() {
  const { shop, currentThemeId, hasSettings } = useLoaderData<typeof loader>();

  const shopHandle = (shop || '').replace('.myshopify.com', '');
  const themeEditorUrl = currentThemeId
    ? `https://admin.shopify.com/store/${shopHandle}/themes/${currentThemeId}/editor?context=apps`
    : `https://admin.shopify.com/store/${shopHandle}/themes/current/editor?context=apps`;

  return (
    <>
      <style>{`
        .hero-section {
          background: #ffffff;
          padding: 56px;
          border-radius: 16px;
          border: 1px solid #e5e7eb;
        }

        .feature-card {
          padding: 32px;
          border-radius: 12px;
          height: 100%;
          transition: transform 0.2s, box-shadow 0.2s;
          border: 1px solid #e5e7eb;
          background: white;
        }

        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .icon-blue { 
          background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }
        .icon-green { 
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
        }
        .icon-orange { 
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
        }
        .icon-purple { 
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
        }

        .action-card {
          padding: 32px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: white;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
        }

        .info-banner {
          background: #f0f9ff;
          padding: 20px 24px;
          border-radius: 12px;
          border: 1px solid #bae6fd;
        }

        .ai-highlight {
          background: #ffffff;
          padding: 40px;
          border-radius: 16px;
          border: 1px solid #e5e7eb;
          margin-bottom: 32px;
        }

        .comparison-box {
          background: white;
          padding: 24px;
          border-radius: 10px;
          border: 2px solid #e5e7eb;
        }

        .comparison-box.success {
          border-color: #10b981;
          background: #f0fdf4;
        }

        .comparison-box.error {
          border-color: #ef4444;
          background: #fef2f2;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
        }

        .grid-4 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
        }
      `}</style>

      <Page fullWidth>
        <TitleBar title="Cart Uplift" />
        
        <BlockStack gap="600">
          {/* Hero Section */}
          <div className="hero-section">
            <BlockStack gap="500">
              <BlockStack gap="300">
                <Text as="h1" variant="heading2xl">
                  Welcome to Cart Uplift 🎉
                </Text>
                <Text as="p" variant="bodyLg" tone="subdued">
                  Boost your revenue with AI-powered cart optimization. Turn browsers into buyers with smart recommendations, progress bars, and rewards.
                </Text>
              </BlockStack>

              {!hasSettings && (
                <div className="info-banner">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      ⚡ Quick Setup Required
                    </Text>
                    <Text as="p" variant="bodyMd">
                      Enable the app embed in your theme, then configure your settings to start seeing results.
                    </Text>
                  </BlockStack>
                </div>
              )}

              <InlineStack gap="300" wrap={false}>
                <a 
                  href={themeEditorUrl} 
                  target="_top" 
                  rel="noopener noreferrer" 
                  style={{ textDecoration: 'none' }}
                >
                  <Button size="large" variant="primary">
                    🎨 Enable in Theme
                  </Button>
                </a>
                <Link to="/app/settings" style={{ textDecoration: 'none' }}>
                  <Button size="large">
                    ⚙️ Configure Settings
                  </Button>
                </Link>
              </InlineStack>
            </BlockStack>
          </div>

          {/* AI Personalization Highlight */}
          <div className="ai-highlight">
            <BlockStack gap="400">
              <BlockStack gap="300">
                <Text as="h2" variant="headingLg" fontWeight="bold">
                  Why Personalized Recommendations Matter
                </Text>
                <Text as="p" variant="bodyLg" tone="subdued">
                  Our AI learns from each customer's behavior to show products they actually want, not random suggestions. This is the difference between a 5% conversion rate and a 40% conversion rate.
                </Text>
                
                <div className="grid-2" style={{ marginTop: '16px' }}>
                  <div className="comparison-box error">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <span style={{ fontSize: '20px' }}>❌</span>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Random Recommendations
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Shows the same products to everyone. Low relevance = customers ignore them = wasted opportunity.
                      </Text>
                      <Text as="p" variant="bodyMd" fontWeight="bold" tone="critical">
                        5-10% click rate
                      </Text>
                    </BlockStack>
                  </div>

                  <div className="comparison-box success">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <span style={{ fontSize: '20px' }}>✅</span>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          AI Personalized (Cart Uplift)
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Analyzes cart contents, behavior patterns, and purchase history to show products each customer wants.
                      </Text>
                      <Text as="p" variant="bodyMd" fontWeight="bold" tone="success">
                        35-42% click rate → More revenue
                      </Text>
                    </BlockStack>
                  </div>
                </div>
              </BlockStack>
            </BlockStack>
          </div>

          {/* Features */}
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg" fontWeight="semibold">
              What you get with Cart Uplift
            </Text>
            
            <div className="grid-4">
              <div className="feature-card">
                <div className="feature-icon icon-blue">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    AI Personalized Recommendations
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Machine learning analyzes each customer's cart and behavior to show products they're most likely to buy.
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Badge tone="info">Increases AOV by 18-32%</Badge>
                  </div>
                </BlockStack>
              </div>

              <div className="feature-card">
                <div className="feature-icon icon-green">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    Progress Bars & Goals
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Show customers exactly how close they are to free shipping and rewards with visual progress tracking.
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Badge tone="success">68% reach threshold</Badge>
                  </div>
                </BlockStack>
              </div>

              <div className="feature-card">
                <div className="feature-icon icon-orange">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    Gift with Purchase
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Automatically reward customers with gifts when they hit spending milestones to motivate larger orders.
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Badge tone="warning">Motivates +$22 spending</Badge>
                  </div>
                </BlockStack>
              </div>

              <div className="feature-card">
                <div className="feature-icon icon-purple">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    Revenue Analytics
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Track exactly how much extra money you're making with real-time performance insights and optimization tips.
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Badge>See your ROI instantly</Badge>
                  </div>
                </BlockStack>
              </div>
            </div>
          </BlockStack>

          {/* Quick Actions */}
          <div className="grid-2">
            <div className="action-card">
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    📊 Analytics Dashboard
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    See your revenue impact, conversion rates, and top products at a glance.
                  </Text>
                </BlockStack>
                <Link to="/app/dashboard" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="large" fullWidth>
                    View Dashboard →
                  </Button>
                </Link>
              </BlockStack>
            </div>

            <div className="action-card">
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    ⚙️ App Settings
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Configure AI recommendations, progress bars, gifts, and customize the cart experience.
                  </Text>
                </BlockStack>
                <Link to="/app/settings" style={{ textDecoration: 'none' }}>
                  <Button size="large" fullWidth>
                    Manage Settings →
                  </Button>
                </Link>
              </BlockStack>
            </div>
          </div>
        </BlockStack>
      </Page>
    </>
  );
}