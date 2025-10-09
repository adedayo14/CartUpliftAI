import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useCallback } from "react";
// CartUplift Home Page - Updated Oct 2025
import {
  Page,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Grid,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Get current settings to calculate setup progress
  const settings = await prisma.settings.findUnique({
    where: { shop },
  });

  // Get the current theme ID for direct linking to Theme Editor
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

  // Calculate setup progress based on core features
  const setupSteps = [
    { key: 'analytics', label: 'Analytics enabled', completed: !!settings?.enableAnalytics },
    { key: 'recommendations', label: 'Recommendations configured', completed: !!settings?.enableRecommendations },
    { key: 'freeshipping', label: 'Free shipping setup', completed: (!!settings?.enableFreeShipping && Number(settings?.freeShippingThreshold) > 0) },
    { key: 'gifts', label: 'Gift rewards configured', completed: (!!(settings as any)?.enableGiftGating && (() => { try { return (JSON.parse((settings as any)?.giftThresholds || '[]') || []).length > 0; } catch { return false; } })()) },
  ];

  const completedSteps = setupSteps.filter(step => step.completed).length;
  const progressPercentage = Math.round((completedSteps / setupSteps.length) * 100);

  return json({ setupSteps, progressPercentage, shop, currentThemeId });
};

export default function Index() {
  const { setupSteps, progressPercentage, shop, currentThemeId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const completedSteps = setupSteps.filter(step => step.completed).length;

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Build absolute admin URL so it doesn't try to open inside the embed iframe
  const shopHandle = (shop || '').replace('.myshopify.com', '');
  const themeEditorUrl = currentThemeId
    ? `https://admin.shopify.com/store/${shopHandle}/themes/${currentThemeId}/editor?context=apps`
    : `https://admin.shopify.com/store/${shopHandle}/themes/current/editor?context=apps`;

  return (
    <Page fullWidth>
      <TitleBar title="CartUplift - Home" />
      <BlockStack gap="500">
        {/* Hero Section */}
        <Card>
          <BlockStack gap="500">
            <BlockStack gap="300">
              <Text as="h1" variant="headingXl">
                Cart Uplift
              </Text>
              <Text variant="headingMd" as="p">
                Increase average order value with AI recommendations and cart incentives
              </Text>
              <Text variant="bodyLg" as="p">
                Boost AOV with smart product recommendations, progress bars, and gift-with-purchase rewards in your cart.
              </Text>
              <style dangerouslySetInnerHTML={{
                __html: `
                  .feature-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 24px;
                  }
                  
                  .feature-column {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                  }
                  
                  .feature-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 8px;
                    background: #f6f6f7;
                    margin-bottom: 8px;
                  }
                  
                  .feature-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                  }
                  
                  .feature-checkmark {
                    color: #00a047;
                    font-weight: bold;
                    font-size: 16px;
                  }
                  
                  @media (max-width: 768px) {
                    .feature-grid {
                      grid-template-columns: 1fr;
                      gap: 16px;
                    }
                  }
                `
              }} />
              <div className="feature-grid">
                <div className="feature-column">
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">AI-powered product recommendations</Text>
                    </div>
                    <Button size="micro" variant="primary" onClick={() => handleNavigate("/app/settings")}>Configure</Button>
                  </div>
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Free shipping progress bars</Text>
                    </div>
                    <Button size="micro" onClick={() => handleNavigate("/app/settings")}>Setup</Button>
                  </div>
                </div>
                <div className="feature-column">
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Gift-with-purchase rewards</Text>
                    </div>
                    <Button size="micro" onClick={() => handleNavigate("/app/settings")}>Configure</Button>
                  </div>
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Privacy-first personalization</Text>
                    </div>
                    <Button size="micro" onClick={() => handleNavigate("/app/settings")}>Manage</Button>
                  </div>
                </div>
                <div className="feature-column">
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Performance analytics</Text>
                    </div>
                    <Button size="micro" variant="primary" onClick={() => handleNavigate("/app/dashboard")}>View</Button>
                  </div>
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Customizable design</Text>
                    </div>
                    <Button size="micro" onClick={() => handleNavigate("/app/settings")}>Customize</Button>
                  </div>
                </div>
              </div>
            </BlockStack>
            <InlineStack gap="300">
              <Button variant="primary" size="large" onClick={() => handleNavigate("/app/settings")}>Configure Settings</Button>
              <Button size="large" onClick={() => handleNavigate("/app/dashboard")}>View Dashboard</Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Setup Progress Section - Hide when 100% complete */}
        {progressPercentage < 100 && (
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" align="space-between">
                <Text as="h2" variant="headingMd">Setup Progress</Text>
                <Text as="p" variant="bodySm" tone="subdued">{completedSteps} of {setupSteps.length} completed</Text>
              </InlineStack>
              <ProgressBar progress={progressPercentage} tone="success" />
              <style dangerouslySetInnerHTML={{
                __html: `
                  .Polaris-ProgressBar {
                    --pc-progress-bar-color: #000 !important;
                  }
                `,
              }}
              />
              
              <style dangerouslySetInnerHTML={{
                __html: `
                  .setup-steps-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    margin-top: 16px;
                  }
                  
                  .setup-step {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px;
                    border-radius: 8px;
                    background: #f6f6f7;
                  }
                  
                  .setup-step.completed {
                    background: #e7f5e7;
                  }
                  
                  .setup-step-icon {
                    font-size: 16px;
                    font-weight: bold;
                  }
                  
                  .setup-step-icon.completed {
                    color: #00a047;
                  }
                  
                  .setup-step-icon.pending {
                    color: #8c9196;
                  }
                  
                  .spacing-gap {
                    height: 16px;
                  }
                `
              }} />
              
              <div className="setup-steps-grid">
                {setupSteps.map((step) => (
                  <div key={step.key} className={`setup-step ${step.completed ? 'completed' : ''}`}>
                    <span className={`setup-step-icon ${step.completed ? 'completed' : 'pending'}`}>
                      {step.completed ? '✓' : '○'}
                    </span>
                    <Text variant="bodyMd" as="span">
                      {step.label}
                    </Text>
                  </div>
                ))}
              </div>
              
              <InlineStack gap="300">
                <Button variant="primary" onClick={() => handleNavigate("/app/settings")}>Complete Setup</Button>
                <Button variant="secondary" onClick={() => {
                  try {
                    if (typeof window !== 'undefined' && window.top) {
                      window.top.location.href = themeEditorUrl;
                    } else {
                      window.location.href = themeEditorUrl;
                    }
                  } catch {
                    window.location.href = themeEditorUrl;
                  }
                }}>Install Theme Embed</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Main Content Grid */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Equal height card styles */
            .Polaris-Card {
              height: 100%;
            }

            .Polaris-Card__Section {
              display: flex;
              flex-direction: column;
              height: 100%;
              min-height: 450px;
            }

            .card-content-wrapper {
              flex: 1;
            }

            .card-button-wrapper {
              margin-top: auto;
              padding-top: 16px;
            }

            .cartuplift-action-buttons {
              margin-top: 16px;
              display: flex;
              justify-content: flex-end;
            }

            .cartuplift-action-buttons .Polaris-Button {
              background: #1a1a1a !important;
              border-color: #1a1a1a !important;
              color: white !important;
            }
            
            .cartuplift-action-buttons .Polaris-Button:hover {
              background: #333 !important;
              border-color: #333 !important;
            }

            @media (max-width: 768px) {
              .cartuplift-action-buttons {
                justify-content: center;
              }
            }
          `
        }} />
        
        <Grid>
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card padding="400">
              <div className="card-content-wrapper">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    🛠️ Initial Setup
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Get Cart Uplift running on your store:
                  </Text>
                  <BlockStack gap="300">
                    <Text variant="bodyMd" as="p">
                      <strong>1.</strong> Go to your Shopify theme editor
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>2.</strong> Click "App embeds" in the left sidebar
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>3.</strong> Find "CartUplift" and toggle it ON
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>4.</strong> Configure your settings in the Settings tab
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>5.</strong> Save your theme changes
                    </Text>
                  </BlockStack>
                  <Text variant="bodyMd" as="p" tone="success">
                    ✅ The app embed must be enabled first before CartUplift will work on your store.
                  </Text>
                </BlockStack>
              </div>
              <div className="card-button-wrapper">
                <div className="cartuplift-action-buttons">
                  <a href={themeEditorUrl} target="_top" rel="noopener noreferrer">
                    <Button variant="primary" size="large">Open Theme Editor</Button>
                  </a>
                </div>
              </div>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card padding="400">
              <div className="card-content-wrapper">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    📊 Dashboard
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Monitor your CartUplift performance in real-time:
                  </Text>
                  <BlockStack gap="300">
                    <Text variant="bodyMd" as="p">
                      <strong>Revenue Impact:</strong> Track additional revenue from recommendations
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Conversion Metrics:</strong> Monitor upsell success and AOV increases
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Product Performance:</strong> See which recommendations convert best
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Customer Insights:</strong> Understand shopping patterns and preferences
                    </Text>
                  </BlockStack>
                  
                  <div className="spacing-gap"></div>
                  
                  <Text variant="bodyMd" as="p" tone="subdued">
                    💡 <strong>Tip:</strong> Use insights to optimize settings and maximize ROI. Personalization increases relevance and conversion.
                  </Text>
                </BlockStack>
              </div>
              <div className="card-button-wrapper">
                <div className="cartuplift-action-buttons">
                  <Button variant="primary" size="large" onClick={() => handleNavigate("/app/dashboard")}>View Dashboard</Button>
                </div>
              </div>
            </Card>
          </Grid.Cell>
        </Grid>
      </BlockStack>
    </Page>
  );
}
