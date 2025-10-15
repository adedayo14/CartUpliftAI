import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, DataTable, Text, BlockStack, InlineStack, Badge } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  if (!session || !session.shop) {
    throw new Error('No authenticated session');
  }

  // Get ALL attribution records
  const allAttributions = await (db as any).recommendationAttribution?.findMany?.({
    where: { shop: session.shop },
    orderBy: { createdAt: 'desc' }
  }) ?? [];

  // Group by order
  const orderMap = new Map();
  allAttributions.forEach((attr: any) => {
    const orderKey = attr.orderNumber || attr.orderId;
    if (!orderMap.has(orderKey)) {
      orderMap.set(orderKey, {
        orderNumber: orderKey,
        orderValue: attr.orderValue,
        createdAt: attr.createdAt,
        products: [],
        totalAttributed: 0
      });
    }
    const order = orderMap.get(orderKey);
    order.products.push({
      productId: attr.productId,
      revenue: attr.attributedRevenue,
      id: attr.id
    });
    order.totalAttributed += (attr.attributedRevenue || 0);
  });

  const orders = Array.from(orderMap.values());

  // Check for duplicates
  const duplicateCheck = new Map();
  allAttributions.forEach((attr: any) => {
    const key = `${attr.orderId}-${attr.productId}`;
    if (!duplicateCheck.has(key)) {
      duplicateCheck.set(key, []);
    }
    duplicateCheck.get(key).push(attr.id);
  });

  const duplicates = Array.from(duplicateCheck.entries())
    .filter(([_, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, count: ids.length, ids }));

  // Calculate totals
  const totalRevenue = allAttributions.reduce((sum: any, a: any) => sum + (a.attributedRevenue || 0), 0);
  const totalRecords = allAttributions.length;
  const uniqueOrders = orderMap.size;

  return json({
    orders,
    duplicates,
    stats: {
      totalRevenue,
      totalRecords,
      uniqueOrders
    }
  });
};

export default function AttributionDebug() {
  const { orders, duplicates, stats } = useLoaderData<typeof loader>();

  const orderRows = orders.map((order: any) => [
    order.orderNumber,
    order.products.length.toString(),
    `£${order.totalAttributed.toFixed(2)}`,
    `£${order.orderValue?.toFixed(2) || '0.00'}`,
    new Date(order.createdAt).toLocaleDateString(),
    order.products.map((p: any) => `${p.productId}: £${p.revenue.toFixed(2)}`).join(', ')
  ]);

  return (
    <Page title="Attribution Debug" narrowWidth>
      <BlockStack gap="500">
        {/* Summary Stats */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Summary Statistics</Text>
            <InlineStack gap="400">
              <BlockStack gap="200">
                <Text as="p" variant="bodyLg" fontWeight="semibold">
                  Total Attributed Revenue
                </Text>
                <Text as="p" variant="heading2xl" tone="success">
                  £{stats.totalRevenue.toFixed(2)}
                </Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="p" variant="bodyLg" fontWeight="semibold">
                  Total Records
                </Text>
                <Text as="p" variant="heading2xl">
                  {stats.totalRecords}
                </Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="p" variant="bodyLg" fontWeight="semibold">
                  Unique Orders
                </Text>
                <Text as="p" variant="heading2xl">
                  {stats.uniqueOrders}
                </Text>
              </BlockStack>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Duplicates Warning */}
        {duplicates.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">⚠️ Duplicate Records Found</Text>
                <Badge tone="critical">{`${duplicates.length} duplicates`}</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="caution">
                Some order+product combinations have multiple attribution records. This inflates your revenue numbers.
              </Text>
              <BlockStack gap="200">
                {duplicates.slice(0, 5).map((dup: any) => (
                  <Text key={dup.key} as="p" variant="bodySm">
                    {dup.key}: {dup.count} records (IDs: {dup.ids.join(', ')})
                  </Text>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        {/* Orders Table */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">All Attribution Records by Order</Text>
            <DataTable
              columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'text', 'text']}
              headings={['Order', 'Products', 'Attributed', 'Order Total', 'Date', 'Product Breakdown']}
              rows={orderRows}
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
