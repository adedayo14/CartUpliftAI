import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Page,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Banner,
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
  const fetcher = useFetcher();
  const [subscribing, setSubscribing] = useState<string | null>(null);
  
  // Billing feature flag - disable until database migrated
  const billingEnabled = false; // Set to true after running: npx prisma db push

  const shopHandle = (shop || '').replace('.myshopify.com', '');
  const themeEditorUrl = currentThemeId
    ? `https://admin.shopify.com/store/${shopHandle}/themes/${currentThemeId}/editor?context=apps`
    : `https://admin.shopify.com/store/${shopHandle}/themes/current/editor?context=apps`;

  // Handle subscription flow
  const handleSubscribe = async (plan: string) => {
    if (!billingEnabled) {
      alert('Billing system will be activated after deployment. Stay tuned!');
      return;
    }
    
    setSubscribing(plan);
    
    const formData = new FormData();
    formData.append("plan", plan);
    
    fetcher.submit(formData, {
      method: "post",
      action: "/api/billing/subscribe",
    });
  };

  // Handle subscription response
  useEffect(() => {
    if (!billingEnabled) return;
    
    if (fetcher.data) {
      const data = fetcher.data as { success?: boolean; confirmationUrl?: string; error?: string };
      
      if (data.success && data.confirmationUrl) {
        // Redirect to Shopify billing confirmation
        window.top!.location.href = data.confirmationUrl;
      } else if (data.error) {
        console.error("Subscription error:", data.error);
        setSubscribing(null);
      }
    }
  }, [fetcher.data, billingEnabled]);

  // Check for billing status in URL
  useEffect(() => {
    if (!billingEnabled) return;
    
    const url = new URL(window.location.href);
    const billingStatus = url.searchParams.get("billing");
    
    if (billingStatus === "success") {
      shopify.toast.show("Subscription activated successfully! 🎉");
      // Clean up URL
      url.searchParams.delete("billing");
      window.history.replaceState({}, '', url.toString());
    } else if (billingStatus === "error") {
      shopify.toast.show("Failed to activate subscription. Please try again.", { isError: true });
      url.searchParams.delete("billing");
      window.history.replaceState({}, '', url.toString());
    }
  }, [billingEnabled]);

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
          display: flex;
          flex-direction: column;
          transition: transform 0.2s, box-shadow 0.2s;
          border: 1px solid #e5e7eb;
          background: white;
        }

        .feature-card-content {
          flex: 1;
        }

        .feature-card-badge {
          margin-top: auto;
          padding-top: 16px;
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

        .no-underline {
          text-decoration: none;
        }

        .grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .pricing-card {
          padding: 40px;
          border-radius: 16px;
          border: 2px solid #e5e7eb;
          background: white;
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
        }

        .pricing-card.featured {
          border-color: #3b82f6;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          position: relative;
        }

        .pricing-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
          color: white;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .pricing-price {
          font-size: 48px;
          font-weight: bold;
          color: #1f2937;
          line-height: 1;
        }

        .pricing-features {
          flex: 1;
          margin: 24px 0;
        }

        .pricing-button-wrapper {
          margin-top: auto;
        }

        .pricing-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .pricing-checkmark {
          color: #10b981;
          font-size: 20px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .grid-4 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
        }

        .text-center {
          text-align: center;
        }

        .mt-8 {
          margin-top: 8px;
        }

        .mt-12 {
          margin-top: 12px;
        }

        .mt-16 {
          margin-top: 16px;
        }

        .price-display {
          margin-top: 12px;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .icon-size {
          font-size: 20px;
        }

        .pricing-trust-badges {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }

        .trust-badge {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.6;
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
                  className="no-underline"
                >
                  <Button size="large" variant="primary">
                    🎨 Enable in Theme
                  </Button>
                </a>
                <Link to="/app/settings" className="no-underline">
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
                
                <div className="grid-2 mt-16">
                  <div className="comparison-box error">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <span className="icon-size">❌</span>
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
                        <span className="icon-size">✅</span>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          ML-Powered Recommendations
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Learns what each customer wants. Shows them products they're likely to buy. Feels personalized = higher trust = more sales.
                      </Text>
                      <Text as="p" variant="bodyMd" fontWeight="bold" tone="success">
                        35-50% click rate
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
                <div className="feature-card-content">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd" fontWeight="semibold">
                      AI Personalized Recommendations
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Machine learning analyzes each customer's cart and behavior to show products they're most likely to buy.
                    </Text>
                  </BlockStack>
                </div>
                <div className="feature-card-badge">
                  <Badge tone="info">Increases AOV by 18-32%</Badge>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon icon-green">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="feature-card-content">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd" fontWeight="semibold">
                      Progress Bars & Goals
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Show customers exactly how close they are to free shipping and rewards with visual progress tracking.
                    </Text>
                  </BlockStack>
                </div>
                <div className="feature-card-badge">
                  <Badge tone="success">68% reach threshold</Badge>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon icon-orange">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="feature-card-content">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd" fontWeight="semibold">
                      Gift with Purchase
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Automatically reward customers with gifts when they hit spending milestones to motivate larger orders.
                    </Text>
                  </BlockStack>
                </div>
                <div className="feature-card-badge">
                  <Badge tone="warning">Motivates +$22 spending</Badge>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon icon-purple">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="feature-card-content">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd" fontWeight="semibold">
                      Revenue Analytics
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Track exactly how much extra money you're making with real-time performance insights and optimization tips.
                    </Text>
                  </BlockStack>
                </div>
                <div className="feature-card-badge">
                  <Badge tone="magic">See your ROI instantly</Badge>
                </div>
              </div>
            </div>
          </BlockStack>

          {/* Pricing Section */}
          <BlockStack gap="400">
            <div className="text-center">
              <Text as="h2" variant="headingLg" fontWeight="semibold">
                Choose Your Plan
              </Text>
              <div className="mt-8">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Start with our 14-day free trial. Cancel anytime.
                </Text>
              </div>
            </div>

            <div className="grid-3">
              {/* Starter Plan */}
              <div className="pricing-card">
                <div>
                  <Text as="h3" variant="headingLg" fontWeight="bold">
                    Starter
                  </Text>
                  <div className="price-display">
                    <span className="pricing-price">$49</span>
                    <Text as="span" variant="bodyLg" tone="subdued">/month</Text>
                  </div>
                  <div className="mt-8">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Up to 500 orders per month
                    </Text>
                  </div>
                </div>

                <div className="pricing-features">
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">14-day free trial included</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">AI-powered personalized recommendations</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">ML engine that learns from customers</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Unlimited progress bars & gift tiers</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Cart goal incentives</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Full design customization</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Analytics dashboard</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Email support (24-48hr)</Text>
                  </div>
                </div>

                <div className="pricing-button-wrapper">
                  <Button 
                    size="large" 
                    fullWidth
                    onClick={() => handleSubscribe('starter')}
                    loading={subscribing === 'starter'}
                  >
                    Start Free Trial
                  </Button>
                  
                  <div className="pricing-trust-badges">
                    <div className="trust-badge">✓ Cancel anytime • No setup fees</div>
                    <div className="trust-badge">💡 Average ROI: 123x in first week</div>
                  </div>
                </div>
              </div>

              {/* Growth Plan - Featured */}
              <div className="pricing-card featured">
                <div className="pricing-badge">RECOMMENDED</div>
                <div>
                  <Text as="h3" variant="headingLg" fontWeight="bold">
                    Growth
                  </Text>
                  <div className="price-display">
                    <span className="pricing-price">$79</span>
                    <Text as="span" variant="bodyLg" tone="subdued">/month</Text>
                  </div>
                  <div className="mt-8">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Up to 2,000 orders per month
                    </Text>
                  </div>
                </div>

                <div className="pricing-features">
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">14-day free trial included</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Everything in Starter, plus:</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Higher order capacity (2,000/month)</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Priority email support (12-24hr)</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Advanced analytics with data exports</Text>
                  </div>
                </div>

                <div className="pricing-button-wrapper">
                  <Button 
                    size="large" 
                    variant="primary" 
                    fullWidth
                    onClick={() => handleSubscribe('growth')}
                    loading={subscribing === 'growth'}
                  >
                    Upgrade to Growth
                  </Button>
                  
                  <div className="pricing-trust-badges">
                    <div className="trust-badge">✓ Cancel anytime • No per-order fees</div>
                    <div className="trust-badge">💡 Most popular plan</div>
                  </div>
                </div>
              </div>

              {/* Pro Plan */}
              <div className="pricing-card">
                <div>
                  <Text as="h3" variant="headingLg" fontWeight="bold">
                    Pro
                  </Text>
                  <div className="price-display">
                    <span className="pricing-price">$149</span>
                    <Text as="span" variant="bodyLg" tone="subdued">/month</Text>
                  </div>
                  <div className="mt-8">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Unlimited orders
                    </Text>
                  </div>
                </div>

                <div className="pricing-features">
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">14-day free trial included</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Everything in Growth, plus:</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Unlimited orders (no limits)</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Priority support (4-12hr response)</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Dedicated onboarding assistance</Text>
                  </div>
                  <div className="pricing-feature-item">
                    <span className="pricing-checkmark">✓</span>
                    <Text as="p" variant="bodyMd">Custom feature requests priority</Text>
                  </div>
                </div>

                <div className="pricing-button-wrapper">
                  <Button 
                    size="large" 
                    fullWidth
                    onClick={() => handleSubscribe('pro')}
                    loading={subscribing === 'pro'}
                  >
                    Upgrade to Pro
                  </Button>
                  
                  <div className="pricing-trust-badges">
                    <div className="trust-badge">✓ No hidden charges • Priority support</div>
                    <div className="trust-badge">🔒 Privacy-first approach</div>
                  </div>
                </div>
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
                <Link to="/app/dashboard" className="no-underline">
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
                <Link to="/app/settings" className="no-underline">
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

