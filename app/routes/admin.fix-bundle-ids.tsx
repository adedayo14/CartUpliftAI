/**
 * One-time fix: Strip gid://shopify/Product/ prefix from assignedProducts
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, Form } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { Page, Card, Button, Text, BlockStack, InlineStack, Badge } from "@shopify/polaris";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    // Get all bundles with assignedProducts
    const bundles = await prisma.bundle.findMany({
      where: {
        shop,
        assignedProducts: { not: null }
      }
    });

    const updates = [];

    for (const bundle of bundles) {
      if (!bundle.assignedProducts) continue;

      // Parse the JSON
      const productIds = JSON.parse(bundle.assignedProducts);
      
      // Check if any IDs have the gid:// prefix
      const hasPrefix = productIds.some((id: string) => id.startsWith('gid://'));
      
      if (hasPrefix) {
        // Strip the prefix from all IDs
        const cleanedIds = productIds.map((id: string) => 
          id.replace('gid://shopify/Product/', '')
        );

        // Update the bundle
        await prisma.bundle.update({
          where: { id: bundle.id },
          data: {
            assignedProducts: JSON.stringify(cleanedIds)
          }
        });

        updates.push({
          bundleName: bundle.name,
          before: productIds,
          after: cleanedIds
        });
      }
    }

    return json({ success: true, updates });
  } catch (error) {
    console.error('[Fix Bundle IDs] Error:', error);
    return json({ success: false, error: String(error) }, { status: 500 });
  }
};

export default function FixBundleIds() {
  const actionData = useActionData<typeof action>();

  return (
    <Page title="Fix Bundle Product IDs" backAction={{ url: "/admin/bundles" }}>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <Text as="p">
              This tool strips the <code>gid://shopify/Product/</code> prefix from bundle assigned products.
            </Text>
            <Text as="p" tone="subdued">
              Run this once to fix bundles created before the ID format fix.
            </Text>
            <Form method="post">
              <Button submit variant="primary">Fix Bundle IDs</Button>
            </Form>
          </BlockStack>
        </Card>

        {actionData?.success && 'updates' in actionData && (
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="success">Success</Badge>
                <Text as="h2" variant="headingMd">
                  Updated {actionData.updates.length} bundle(s)
                </Text>
              </InlineStack>
              {actionData.updates.map((update: any, idx: number) => (
                <Card key={idx}>
                  <BlockStack gap="200">
                    <Text as="p" fontWeight="semibold">{update.bundleName}</Text>
                    <Text as="p" tone="subdued">Before: {JSON.stringify(update.before)}</Text>
                    <Text as="p">After: {JSON.stringify(update.after)}</Text>
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          </Card>
        )}

        {actionData?.success === false && 'error' in actionData && (
          <Card>
            <BlockStack gap="200">
              <Badge tone="critical">Error</Badge>
              <Text as="p">{actionData.error}</Text>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
