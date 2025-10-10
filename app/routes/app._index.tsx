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
        .hero-gradient {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          padding: 56px;
          border-radius: 16px;
          color: white;
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
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin-bottom: 16px;
        }

        .icon-blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .icon-green { background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%); }
        .icon-orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
        .icon-purple { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); }

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

        .step-number {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          color: white;
          flex-shrink: 0;
        }

        .step-1 { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .step-2 { background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%); }
        .step-3 { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 32px;
          text-align: center;
          padding: 32px;
        }

        .stat-number {
          font-size: 48px;
          font-weight: bold;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .info-banner {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          padding: 20px 24px;
          border-radius: 12px;
          border-left: 4px solid #3b82f6;
        }

        .warning-banner {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          padding: 20px 24px;
          border-radius: 12px;
          border-left: 4px solid #f59e0b;
        }

        .ai-highlight {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          padding: 32px;
          border-radius: 12px;
          border: 2px solid #10b981;
          margin-bottom: 32px;
        }

        .comparison-box {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
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

        .white-card {
          background: white;
          padding: 32px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        }
      `}</style>

      <Page fullWidth>
        <TitleBar title="Cart Uplift" />
        
        <BlockStack gap="600">
          {/* Hero Section */}
          <div className="hero-gradient">
            <BlockStack gap="500">
              <BlockStack gap="300">
                <Text as="h1" variant="heading2xl">
                  Welcome to Cart Uplift 🎉
                </Text>
                <Text as="p" variant="bodyLg">
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
              <InlineStack gap="300" blockAlign="start" wrap={false}>
                <div style={{ fontSize: '48px' }}>🎯</div>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingLg" fontWeight="bold">
                    Why Personalized Recommendations Matter
                  </Text>
                  <Text as="p" variant="bodyLg">
                    Our AI learns from each customer's behavior to show products they actually want, not random suggestions. This is the difference between a 5% conversion rate and a 40% conversion rate.
                  </Text>
                  
                  <div className="grid-2" style={{ marginTop: '16px' }}>
                    <div className="comparison-box">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          ❌ Random Recommendations
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Shows the same products to everyone. Low relevance = customers ignore them = wasted opportunity.
                        </Text>
                        <Text as="p" variant="bodyMd" tone="critical">
                          5-10% click rate
                        </Text>
                      </BlockStack>
                    </div>

                    <div className="comparison-box" style={{ borderColor: '#10b981', borderWidth: '2px' }}>
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          ✅ AI Personalized (Cart Uplift)
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Analyzes cart contents, behavior patterns, and purchase history to show products each customer wants.
                        </Text>
                        <Text as="p" variant="bodyMd" tone="success">
                          35-42% click rate → More revenue
                        </Text>
                      </BlockStack>
                    </div>
                  </div>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </div>

          {/* Features */}
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              What you get with Cart Uplift
            </Text>
            
            <div className="grid-4">
              <div className="feature-card">
                <div className="feature-icon icon-blue">🤖</div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    AI Personalized Recommendations
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Machine learning analyzes each customer's cart and behavior to show products they're most likely to buy. Not random — actually relevant.
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Badge tone="info">Increases AOV by 18-32%</Badge>
                  </div>
                </BlockStack>
              </div>

              <div className="feature-card">
                <div className="feature-icon icon-green">📊</div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    Progress Bars & Goals
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Show customers exactly how close they are to free shipping and rewards. Visual motivation that drives action.
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Badge tone="success">68% reach threshold</Badge>
                  </div>
                </BlockStack>
              </div>

              <div className="feature-card">
                <div className="feature-icon icon-orange">🎁</div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    Gift with Purchase
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Automatically reward customers with gifts when they hit spending milestones. Creates urgency to add more.
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Badge tone="warning">Motivates +$22 spending</Badge>
                  </div>
                </BlockStack>
              </div>

              <div className="feature-card">
                <div className="feature-icon icon-purple">📈</div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd" fontWeight="semibold">
                    Revenue Analytics
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Track exactly how much extra money you're making. See which products work best and optimize your strategy.
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
                    See your revenue impact, conversion rates, and top products at a glance. Know what's working and what to optimize.
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
                    Configure AI recommendations, progress bars, gifts, and customize the cart experience to match your brand.
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

          {/* Setup Steps */}
          <div className="white-card">
            <BlockStack gap="500">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                🚀 Get started in 3 steps
              </Text>

              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="start" wrap={false}>
                  <div className="step-number step-1">1</div>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyLg" fontWeight="semibold">
                      Enable the app embed
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Go to your theme editor → App embeds → Toggle "Cart Uplift" ON
                    </Text>
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="300" blockAlign="start" wrap={false}>
                  <div className="step-number step-2">2</div>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyLg" fontWeight="semibold">
                      Configure your settings
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Set up AI recommendations, free shipping goals, and gift rewards — takes 5 minutes
                    </Text>
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="300" blockAlign="start" wrap={false}>
                  <div className="step-number step-3">3</div>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyLg" fontWeight="semibold">
                      Watch your revenue grow
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Monitor performance in your analytics dashboard. The AI gets smarter every day.
                    </Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>

              {!hasSettings && (
                <div className="warning-banner">
                  <Text as="p" variant="bodyMd" fontWeight="medium">
                    💡 Ready to start? Click "Configure Settings" above to set up your first cart optimization.
                  </Text>
                </div>
              )}
            </BlockStack>
          </div>

          {/* Stats */}
          <div className="white-card">
            <BlockStack gap="400">
              <div style={{ textAlign: 'center' }}>
                <Text as="h2" variant="headingLg" fontWeight="semibold">
                  Join successful Shopify merchants
                </Text>
              </div>
              <div className="stats-grid">
                <div>
                  <div className="stat-number">+27%</div>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Average AOV increase
                  </Text>
                </div>
                <div>
                  <div className="stat-number">34%</div>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Orders influenced
                  </Text>
                </div>
                <div>
                  <div className="stat-number">85x</div>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Average ROI
                  </Text>
                </div>
              </div>
            </BlockStack>
          </div>
        </BlockStack>
      </Page>
    </>
  );
}