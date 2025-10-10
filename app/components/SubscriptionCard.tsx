/**
 * Subscription Card Component
 * Displays current subscription plan and usage
 */

import { Card, BlockStack, InlineStack, Text, ProgressBar, Button, Badge } from "@shopify/polaris";
import { useEffect, useState } from "react";

interface OrderUsageStats {
  plan: string;
  currentCount: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  periodStart: string;
  periodEnd: string | null;
  limitReached: boolean;
}

export default function SubscriptionCard() {
  const [stats, setStats] = useState<OrderUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageStats();
  }, []);

  const fetchUsageStats = async () => {
    try {
      const response = await fetch('/api/order-usage');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            Subscription & Usage
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Loading...
          </Text>
        </BlockStack>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const planNames: Record<string, string> = {
    starter: 'Starter Plan',
    growth: 'Growth Plan',
    pro: 'Pro Plan'
  };

  const isApproachingLimit = stats.percentUsed >= 80 && stats.limit !== Infinity;
  const isUnlimited = stats.limit === Infinity;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Subscription & Usage
          </Text>
          {stats.plan === 'starter' && (
            <Badge tone="info">Starter</Badge>
          )}
          {stats.plan === 'growth' && (
            <Badge tone="success">Growth</Badge>
          )}
          {stats.plan === 'pro' && (
            <Badge tone="attention">Pro</Badge>
          )}
        </InlineStack>

        <BlockStack gap="300">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Current Plan: {planNames[stats.plan] || stats.plan}
          </Text>

          {!isUnlimited && (
            <>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="p" variant="bodyMd">
                    Orders this month
                  </Text>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {stats.currentCount.toLocaleString()} / {stats.limit.toLocaleString()}
                  </Text>
                </InlineStack>
                <ProgressBar 
                  progress={stats.percentUsed} 
                  tone={stats.limitReached ? 'critical' : isApproachingLimit ? 'primary' : 'success'}
                />
              </BlockStack>

              {stats.limitReached && (
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#FFF4E5', 
                  borderRadius: '8px',
                  border: '1px solid #FFA500'
                }}>
                  <Text as="p" variant="bodyMd" fontWeight="semibold" tone="critical">
                    ⚠️ Order limit reached
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Upgrade your plan to continue processing orders
                  </Text>
                </div>
              )}

              {isApproachingLimit && !stats.limitReached && (
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#FFF9E6', 
                  borderRadius: '8px',
                  border: '1px solid #FFD700'
                }}>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    📊 Approaching limit
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {stats.remaining.toLocaleString()} orders remaining this month
                  </Text>
                </div>
              )}

              {stats.plan !== 'pro' && (
                <Button fullWidth onClick={() => window.location.href = '/app'}>
                  Upgrade Plan
                </Button>
              )}
            </>
          )}

          {isUnlimited && (
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#F0F9FF', 
              borderRadius: '8px',
              border: '1px solid #3B82F6'
            }}>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                🎉 Unlimited Orders
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                You're on the Pro plan with no order limits
              </Text>
            </div>
          )}

          {stats.periodEnd && (
            <Text as="p" variant="bodySm" tone="subdued">
              Billing period: {new Date(stats.periodStart).toLocaleDateString()} - {new Date(stats.periodEnd).toLocaleDateString()}
            </Text>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
