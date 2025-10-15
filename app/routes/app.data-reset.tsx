import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useSubmit } from "@remix-run/react";
import { Page, Card, Button, BlockStack, Text, Banner, InlineStack, Badge } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  if (!session || !session.shop) {
    return json({ error: "No authenticated session" }, { status: 401 });
  }

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "clear_attribution") {
    try {
      // Count records before deletion
      const attributionCount = await (db as any).recommendationAttribution?.count?.({
        where: { shop: session.shop }
      }) ?? 0;

      // Delete all attribution records for this shop
      await (db as any).recommendationAttribution?.deleteMany?.({
        where: { shop: session.shop }
      });

      return json({ 
        success: true, 
        message: `Cleared ${attributionCount} attribution records`,
        count: attributionCount
      });
    } catch (e) {
      console.error("Failed to clear attribution:", e);
      return json({ error: "Failed to clear attribution data" }, { status: 500 });
    }
  }

  if (action === "clear_tracking") {
    try {
      // Count records before deletion
      const trackingCount = await (db as any).trackingEvent?.count?.({
        where: { shop: session.shop }
      }) ?? 0;

      // Delete all tracking events for this shop
      await (db as any).trackingEvent?.deleteMany?.({
        where: { shop: session.shop }
      });

      return json({ 
        success: true, 
        message: `Cleared ${trackingCount} tracking events`,
        count: trackingCount
      });
    } catch (e) {
      console.error("Failed to clear tracking:", e);
      return json({ error: "Failed to clear tracking data" }, { status: 500 });
    }
  }

  if (action === "clear_analytics") {
    try {
      // Count records before deletion
      const analyticsCount = await (db as any).analyticsEvent?.count?.({
        where: { shop: session.shop }
      }) ?? 0;

      // Delete all analytics events for this shop
      await (db as any).analyticsEvent?.deleteMany?.({
        where: { shop: session.shop }
      });

      return json({ 
        success: true, 
        message: `Cleared ${analyticsCount} analytics events`,
        count: analyticsCount
      });
    } catch (e) {
      console.error("Failed to clear analytics:", e);
      return json({ error: "Failed to clear analytics data" }, { status: 500 });
    }
  }

  if (action === "clear_all") {
    try {
      // Count all records
      const attributionCount = await (db as any).recommendationAttribution?.count?.({
        where: { shop: session.shop }
      }) ?? 0;
      
      const trackingCount = await (db as any).trackingEvent?.count?.({
        where: { shop: session.shop }
      }) ?? 0;
      
      const analyticsCount = await (db as any).analyticsEvent?.count?.({
        where: { shop: session.shop }
      }) ?? 0;

      // Delete all tracking data
      await Promise.all([
        (db as any).recommendationAttribution?.deleteMany?.({
          where: { shop: session.shop }
        }),
        (db as any).trackingEvent?.deleteMany?.({
          where: { shop: session.shop }
        }),
        (db as any).analyticsEvent?.deleteMany?.({
          where: { shop: session.shop }
        })
      ]);

      const totalCleared = attributionCount + trackingCount + analyticsCount;

      return json({ 
        success: true, 
        message: `Cleared all tracking data: ${attributionCount} attributions, ${trackingCount} tracking events, ${analyticsCount} analytics events`,
        count: totalCleared
      });
    } catch (e) {
      console.error("Failed to clear all data:", e);
      return json({ error: "Failed to clear all data" }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function DataReset() {
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const handleClear = (actionType: string) => {
    if (confirm(`Are you sure you want to clear this data? This cannot be undone.`)) {
      const formData = new FormData();
      formData.append("action", actionType);
      submit(formData, { method: "post" });
    }
  };

  return (
    <Page
      title="Reset Dashboard Data"
      subtitle="Clear tracking and attribution data to start fresh"
      backAction={{ content: "Home", url: "/app" }}
      narrowWidth
    >
      <BlockStack gap="500">
        {/* Success/Error Messages */}
        {actionData && 'success' in actionData && actionData.success && (
          <Banner tone="success" onDismiss={() => {}}>
            <Text as="p">{actionData.message}</Text>
          </Banner>
        )}
        
        {actionData && 'error' in actionData && actionData.error && (
          <Banner tone="critical" onDismiss={() => {}}>
            <Text as="p">{actionData.error}</Text>
          </Banner>
        )}

        {/* Warning */}
        <Banner tone="warning">
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              ⚠️ Careful! This will permanently delete data
            </Text>
            <Text as="p" variant="bodyMd">
              This action cannot be undone. Your settings, products, and Shopify orders will NOT be affected - only tracking and attribution data will be cleared.
            </Text>
          </BlockStack>
        </Banner>

        {/* Clear Attribution Records */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Clear Attribution Records</Text>
                <Badge tone="info">RecommendationAttribution</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                Removes all "Revenue from AI Recommendations" data. This includes the tracking of which products were recommended, clicked, and purchased.
              </Text>
            </BlockStack>
            <Button
              variant="primary"
              tone="critical"
              onClick={() => handleClear("clear_attribution")}
            >
              Clear Attribution Data
            </Button>
          </BlockStack>
        </Card>

        {/* Clear Tracking Events */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Clear Tracking Events</Text>
                <Badge tone="info">TrackingEvent</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                Removes all recommendation impressions and click tracking data. This affects future attribution but not existing attribution records.
              </Text>
            </BlockStack>
            <Button
              variant="primary"
              tone="critical"
              onClick={() => handleClear("clear_tracking")}
            >
              Clear Tracking Events
            </Button>
          </BlockStack>
        </Card>

        {/* Clear Analytics Events */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Clear Analytics Events</Text>
                <Badge tone="info">AnalyticsEvent</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                Removes cart open/close tracking and other analytics events. This affects cart conversion metrics.
              </Text>
            </BlockStack>
            <Button
              variant="primary"
              tone="critical"
              onClick={() => handleClear("clear_analytics")}
            >
              Clear Analytics Events
            </Button>
          </BlockStack>
        </Card>

        {/* Clear Everything */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">🚨 Clear ALL Tracking Data</Text>
                <Badge tone="critical">Nuclear Option</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                Removes ALL tracking, attribution, and analytics data. Dashboard will reset to zero. Your settings and configuration will remain intact.
              </Text>
            </BlockStack>
            <Button
              variant="primary"
              tone="critical"
              onClick={() => handleClear("clear_all")}
            >
              Clear Everything (Start Fresh)
            </Button>
          </BlockStack>
        </Card>

        {/* What's Safe */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">✅ What stays intact:</Text>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">• Your app settings (free shipping, bundles, etc.)</Text>
              <Text as="p" variant="bodyMd">• Product configurations</Text>
              <Text as="p" variant="bodyMd">• ML training data</Text>
              <Text as="p" variant="bodyMd">• Shopify orders (never deleted)</Text>
              <Text as="p" variant="bodyMd">• Theme extension installation</Text>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
