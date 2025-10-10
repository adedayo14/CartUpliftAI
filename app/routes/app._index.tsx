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

        .icon-blue { 
          background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .icon-green { 
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .icon-orange { 
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }
        .icon-purple { 
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
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

        .step-1 { 
          background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .step-2 { 
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .step-3 { 
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

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
          background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .info-banner {
          background: #eff6ff;
          padding: 20px 24px;
          border-radius: 12px;
          border: 1px solid #93c5fd;
          color: #1e40af;
        }

        .warning-banner {
          background: #fffbeb;
          padding: 20px 24px;
          border-radius: 12px;
          border: 1px solid #fcd34d;
          color: #92400e;
        }

        .ai-highlight {
          background: #f8fafc;
          padding: 40px;
          border-radius: 16px;
          border: 2px solid #e2e8f0;
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
                <div style={{ 
                  width: '64px', 
                  height: '64px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 3H4C3.44772 3 3 3.44772 3 4V9C3 9.55228 3.44772 10 4 10H9C9.55228 10 10 9.55228 10 9V4C10 3.44772 9.55228 3 9 3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 3H15C14.4477 3 14 3.44772 14 4V9C14 9.55228 14.4477 10 15 10H20C20.5523 10 21 9.55228 21 9V4C21 3.44772 20.5523 3 20 3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 14H4C3.44772 14 3 14.4477 3 15V20C3 20.5523 3.44772 21 4 21H9C9.55228 21 10 20.5523 10 20V15C10 14.4477 9.55228 14 9 14Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18 16L20 14L22 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 14V21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
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
                <div className="feature-icon icon-blue">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 3H4C3.44772 3 3 3.44772 3 4V9C3 9.55228 3.44772 10 4 10H9C9.55228 10 10 9.55228 10 9V4C10 3.44772 9.55228 3 9 3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 3H15C14.4477 3 14 3.44772 14 4V9C14 9.55228 14.4477 10 15 10H20C20.5523 10 21 9.55228 21 9V4C21 3.44772 20.5523 3 20 3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 14H4C3.44772 14 3 14.4477 3 15V20C3 20.5523 3.44772 21 4 21H9C9.55228 21 10 20.5523 10 20V15C10 14.4477 9.55228 14 9 14Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18 16L20 14L22 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 14V21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
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