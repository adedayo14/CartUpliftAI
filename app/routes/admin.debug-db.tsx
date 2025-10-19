/**
 * Debug: View raw bundle data from database
 */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { Page, Card, BlockStack, Text, Badge } from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const bundles = await prisma.bundle.findMany({
    where: { shop },
    orderBy: { createdAt: 'desc' }
  });

  return json({ bundles });
};

export default function DebugDb() {
  const { bundles } = useLoaderData<typeof loader>();

  return (
    <Page title="Database Debug" backAction={{ url: "/admin/bundles" }}>
      <BlockStack gap="400">
        {bundles.map((bundle: any) => (
          <Card key={bundle.id}>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">{bundle.name}</Text>
              <Badge tone={bundle.status === 'active' ? 'success' : 'info'}>{bundle.status}</Badge>
              <Text as="p"><strong>Type:</strong> {bundle.type}</Text>
              <Text as="p"><strong>Bundle Style:</strong> {bundle.bundleStyle || 'Not set'}</Text>
              <Text as="p"><strong>Assigned Products (raw):</strong></Text>
              <Card background="bg-surface-secondary">
                <code>{bundle.assignedProducts || 'null'}</code>
              </Card>
              <Text as="p"><strong>Product IDs (raw):</strong></Text>
              <Card background="bg-surface-secondary">
                <code>{bundle.productIds || 'null'}</code>
              </Card>
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </Page>
  );
}
