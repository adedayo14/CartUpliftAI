import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
import { useEffect, useState, useRef } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  DataTable,
  Modal,
  TextField,
  Select,
  FormLayout,
  ButtonGroup,
  Banner,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Checkbox,
  EmptyState,
} from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

interface Bundle {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  discountType: string;
  discountValue: number;
  minProducts: number;
  totalPurchases: number;
  totalRevenue: number;
  createdAt: string;
}

interface Product {
  id: string;
  title: string;
  price: string;
  image: string;
}

interface Collection {
  id: string;
  title: string;
  productsCount: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('[Loader] Starting...');
  
  const authResult = await authenticate.admin(request);
  const shop = authResult.session.shop;
  
  try {
    const bundles = await (prisma as any).bundle.findMany({
      where: { shop },
      orderBy: { createdAt: 'desc' }
    });
    
    let products: Product[] = [];
    let collections: Collection[] = [];
    
    try {
      const productsResponse = await authResult.admin.graphql(
        `#graphql
        query getProducts {
          products(first: 50) {
            edges {
              node {
                id
                title
                variants(first: 1) {
                  edges {
                    node {
                      price
                    }
                  }
                }
                featuredMedia {
                  preview {
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }`
      );
      
      const productsData = await productsResponse.json();
      
      if (productsData.data?.products?.edges) {
        products = productsData.data.products.edges
          .filter((edge: any) => edge?.node)
          .map((edge: any) => {
            const node = edge.node;
            const variant = node.variants?.edges?.[0]?.node;
            const mediaImage = node.featuredMedia?.preview?.image;
            
            return {
              id: node.id,
              title: node.title || 'Untitled Product',
              price: variant?.price || '0.00',
              image: mediaImage?.url || 'https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png'
            };
          });
        
        console.log(`[Loader] Loaded ${products.length} products`);
      }
    } catch (error) {
      console.error('[Loader] Products error:', error);
    }
    
    try {
      const collectionsResponse = await authResult.admin.graphql(
        `#graphql
        query getCollections {
          collections(first: 50) {
            edges {
              node {
                id
                title
                productsCount {
                  count
                }
              }
            }
          }
        }`
      );
      
      const collectionsData = await collectionsResponse.json();
      
      if (collectionsData.data?.collections?.edges) {
        collections = collectionsData.data.collections.edges
          .filter((edge: any) => edge?.node)
          .map((edge: any) => ({
            id: edge.node.id,
            title: edge.node.title || 'Untitled Collection',
            productsCount: edge.node.productsCount?.count || 0
          }));
        
        console.log(`[Loader] Loaded ${collections.length} collections`);
      }
    } catch (error) {
      console.error('[Loader] Collections error:', error);
    }
    
    return json({ 
      success: true, 
      bundles, 
      products,
      collections,
      shop
    });
  } catch (error: any) {
    console.error('[Loader] Error:', error);
    return json({ 
      success: false, 
      bundles: [],
      products: [],
      collections: [],
      error: error.message
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('[Action] ========== ACTION CALLED ==========');
  console.log('[Action] Method:', request.method);
  console.log('[Action] URL:', request.url);
  
  const authResult = await authenticate.admin(request);
  const shop = authResult.session.shop;

  const formData = await request.formData();
  const actionType = formData.get("action") as string;
  
  console.log('[Action] Type:', actionType);
  console.log('[Action] All form keys:', Array.from(formData.keys()));

  try {
    if (actionType === "create-bundle") {
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const bundleType = formData.get("bundleType") as string;
      const discountType = formData.get("discountType") as string;
      const discountValue = parseFloat(formData.get("discountValue") as string);
      const minProducts = parseInt(formData.get("minProducts") as string) || 2;
      const productIds = formData.get("productIds") as string || "[]";
      const collectionIds = formData.get("collectionIds") as string || "[]";
      const assignedProducts = formData.get("assignedProducts") as string || "[]";
      const bundleStyle = formData.get("bundleStyle") as string || "grid";
      const selectMinQty = formData.get("selectMinQty");
      const selectMaxQty = formData.get("selectMaxQty");
      const tierConfig = formData.get("tierConfig") as string;
      const allowDeselect = formData.get("allowDeselect") === "true";
      const hideIfNoML = formData.get("hideIfNoML") === "true";

      console.log('[Action] Creating bundle:', name);

      if (!name || !bundleType) {
        return json({ success: false, error: "Name and type required" }, { status: 400 });
      }

      const bundle = await (prisma as any).bundle.create({
        data: {
          shop,
          name,
          description: description || "",
          type: bundleType,
          discountType,
          discountValue: discountValue || 0,
          minProducts,
          productIds,
          collectionIds,
          assignedProducts,
          bundleStyle,
          selectMinQty: selectMinQty ? parseInt(selectMinQty as string) : null,
          selectMaxQty: selectMaxQty ? parseInt(selectMaxQty as string) : null,
          tierConfig,
          allowDeselect,
          hideIfNoML,
          status: "draft",
        },
      });

      console.log('[Action] ✅ Bundle created:', bundle.id);
      return json({ success: true, bundle, message: "Bundle created!" });
    }

    if (actionType === "toggle-status") {
      const bundleId = formData.get("bundleId") as string;
      const status = formData.get("status") as string;

      const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop },
        data: { status },
      });

      console.log('[Action] ✅ Status toggled');
      return json({ success: true, bundle, message: "Status updated!" });
    }

    if (actionType === "delete-bundle") {
      const bundleId = formData.get("bundleId") as string;

      await (prisma as any).bundle.delete({
        where: { id: bundleId, shop },
      });

      console.log('[Action] ✅ Bundle deleted');
      return json({ success: true, message: "Bundle deleted!" });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[Action] ❌ Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

export default function SimpleBundleManagement() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  const bundles = loaderData.bundles || [];
  const availableProducts = loaderData.products || [];
  const availableCollections = loaderData.collections || [];
  
  const formRef = useRef<HTMLFormElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [assignedProducts, setAssignedProducts] = useState<string[]>([]);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");

  const [newBundle, setNewBundle] = useState({
    name: "",
    description: "",
    bundleType: "manual",
    discountType: "percentage",
    discountValue: 10,
    minProducts: 2,
    bundleStyle: "grid" as "grid" | "fbt" | "tier",
    selectMinQty: 2,
    selectMaxQty: 10,
    allowDeselect: true,
    hideIfNoML: false,
    tierConfig: [
      { qty: 1, discount: 0 },
      { qty: 2, discount: 10 },
      { qty: 5, discount: 20 }
    ]
  });

  // Handle action responses
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        setShowSuccessBanner(true);
        setBannerMessage(actionData.message || "Success!");
        setShowCreateModal(false);
        resetForm();
        setTimeout(() => setShowSuccessBanner(false), 3000);
      } else {
        setShowErrorBanner(true);
        setBannerMessage(actionData.error || "Failed");
        setTimeout(() => setShowErrorBanner(false), 3000);
      }
    }
  }, [actionData]);

  const resetForm = () => {
    setNewBundle({
      name: "",
      description: "",
      bundleType: "manual",
      discountType: "percentage",
      discountValue: 10,
      minProducts: 2,
      bundleStyle: "grid",
      selectMinQty: 2,
      selectMaxQty: 10,
      allowDeselect: true,
      hideIfNoML: false,
      tierConfig: [
        { qty: 1, discount: 0 },
        { qty: 2, discount: 10 },
        { qty: 5, discount: 20 }
      ]
    });
    setSelectedProducts([]);
    setSelectedCollections([]);
    setAssignedProducts([]);
  };

  const handleSubmitForm = () => {
    console.log('[Frontend] Submitting form...');
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  const bundleTypeOptions = [
    { label: "Manual Bundle", value: "manual" },
    { label: "Category Bundle", value: "category" },
    { label: "AI Suggested", value: "ai_suggested" },
  ];

  const discountTypeOptions = [
    { label: "Percentage Off", value: "percentage" },
    { label: "Fixed Amount Off", value: "fixed" },
  ];

  const bundleTableRows = bundles.map((bundle: Bundle) => [
    bundle.name,
    bundle.type === "manual" ? "Manual" : bundle.type === "category" ? "Category" : "AI",
    <Badge tone={bundle.status === "active" ? "success" : bundle.status === "paused" ? "warning" : "info"} key={bundle.id}>
      {bundle.status}
    </Badge>,
    bundle.discountType === "percentage" ? `${bundle.discountValue}% off` : `$${bundle.discountValue} off`,
    bundle.totalPurchases?.toLocaleString?.() || "0",
    `$${(bundle.totalRevenue || 0).toFixed(2)}`,
    <ButtonGroup key={bundle.id}>
      <Form method="post" style={{ display: 'inline' }}>
        <input type="hidden" name="action" value="toggle-status" />
        <input type="hidden" name="bundleId" value={bundle.id} />
        <input type="hidden" name="status" value={bundle.status === 'active' ? 'paused' : 'active'} />
        <Button
          size="micro"
          variant={bundle.status === "active" ? "secondary" : "primary"}
          submit
          loading={navigation.state === "submitting"}
        >
          {bundle.status === "active" ? "Pause" : "Activate"}
        </Button>
      </Form>
      <Form method="post" style={{ display: 'inline' }} onSubmit={(e) => {
        if (!confirm("Delete this bundle?")) e.preventDefault();
      }}>
        <input type="hidden" name="action" value="delete-bundle" />
        <input type="hidden" name="bundleId" value={bundle.id} />
        <Button
          size="micro"
          tone="critical"
          submit
          loading={navigation.state === "submitting"}
        >
          Delete
        </Button>
      </Form>
    </ButtonGroup>,
  ]);

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page
      title="Bundle Management"
      subtitle="🚀 v1.5 - FIXED: Real HTML Form submission"
      primaryAction={
        <Button
          variant="primary"
          icon={PlusIcon}
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          Create Bundle
        </Button>
      }
    >
      <Layout>
        {showSuccessBanner && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setShowSuccessBanner(false)}>
              {bannerMessage}
            </Banner>
          </Layout.Section>
        )}
        {showErrorBanner && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setShowErrorBanner(false)}>
              {bannerMessage}
            </Banner>
          </Layout.Section>
        )}
        
        <Layout.Section>
          {bundles.length === 0 ? (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Get Started</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Create your first bundle
                </Text>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">All Bundles</Text>
                  <Badge tone="info">{bundles.length} Bundle{bundles.length === 1 ? "" : "s"}</Badge>
                </InlineStack>

                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "numeric", "numeric", "text"]}
                  headings={["Name", "Type", "Status", "Discount", "Purchases", "Revenue", "Actions"]}
                  rows={bundleTableRows}
                />
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Status</Text>
              <Text as="p" variant="bodyMd">
                • Products: {availableProducts.length}
                <br />• Collections: {availableCollections.length}
                <br />• Bundles: {bundles.length}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Modal with real Form */}
      <Modal
        open={showCreateModal}
        onClose={() => !isSubmitting && setShowCreateModal(false)}
        title="Create New Bundle"
        primaryAction={{
          content: "Create Bundle",
          disabled: !newBundle.name.trim() || isSubmitting,
          loading: isSubmitting,
          onAction: handleSubmitForm,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            disabled: isSubmitting,
            onAction: () => setShowCreateModal(false),
          },
        ]}
      >
        <Modal.Section>
          <Form method="post" ref={formRef}>
            <input type="hidden" name="action" value="create-bundle" />
            <input type="hidden" name="productIds" value={JSON.stringify(selectedProducts)} />
            <input type="hidden" name="collectionIds" value={JSON.stringify(selectedCollections)} />
            <input type="hidden" name="assignedProducts" value={JSON.stringify(assignedProducts)} />
            <input type="hidden" name="tierConfig" value={JSON.stringify(newBundle.tierConfig)} />
            
            <FormLayout>
              <TextField
                label="Bundle Name"
                name="name"
                value={newBundle.name}
                onChange={(value) => setNewBundle({ ...newBundle, name: value })}
                placeholder="e.g., Summer Essentials"
                autoComplete="off"
                disabled={isSubmitting}
              />

              <TextField
                label="Description"
                name="description"
                value={newBundle.description}
                onChange={(value) => setNewBundle({ ...newBundle, description: value })}
                multiline={2}
                autoComplete="off"
                disabled={isSubmitting}
              />

              <Select
                label="Bundle Type"
                name="bundleType"
                options={bundleTypeOptions}
                value={newBundle.bundleType}
                onChange={(value) => setNewBundle({ ...newBundle, bundleType: value })}
                disabled={isSubmitting}
              />

              <Select
                label="Display Style"
                name="bundleStyle"
                options={[
                  { label: "Grid", value: "grid" },
                  { label: "FBT", value: "fbt" },
                  { label: "Tiers", value: "tier" }
                ]}
                value={newBundle.bundleStyle}
                onChange={(value) => setNewBundle({ ...newBundle, bundleStyle: value as any })}
                disabled={isSubmitting}
              />

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Product Assignment</Text>
                  <Button 
                    onClick={() => setShowProductPicker(true)}
                    disabled={availableProducts.length === 0 || isSubmitting}
                  >
                    {`Select Products (${assignedProducts.length})`}
                  </Button>
                </BlockStack>
              </Card>

              <Checkbox
                label="Allow deselect"
                name="allowDeselect"
                checked={newBundle.allowDeselect}
                onChange={(checked) => setNewBundle({ ...newBundle, allowDeselect: checked })}
                disabled={isSubmitting}
              />

              <Checkbox
                label="Hide if no AI recs"
                name="hideIfNoML"
                checked={newBundle.hideIfNoML}
                onChange={(checked) => setNewBundle({ ...newBundle, hideIfNoML: checked })}
                disabled={isSubmitting}
              />

              {newBundle.bundleType === "manual" && availableProducts.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">Select Products</Text>
                    <ResourceList
                      items={availableProducts.slice(0, 25)}
                      renderItem={(product: Product) => {
                        const isSelected = selectedProducts.includes(product.id);
                        return (
                          <ResourceItem
                            id={product.id}
                            onClick={() => {
                              if (!isSubmitting) {
                                setSelectedProducts(
                                  isSelected
                                    ? selectedProducts.filter(id => id !== product.id)
                                    : [...selectedProducts, product.id]
                                );
                              }
                            }}
                          >
                            <InlineStack gap="300">
                              <Checkbox label="" checked={isSelected} onChange={() => {}} disabled={isSubmitting} />
                              <Thumbnail source={product.image} alt={product.title} size="small" />
                              <Text as="span">{product.title}</Text>
                            </InlineStack>
                          </ResourceItem>
                        );
                      }}
                    />
                    {selectedProducts.length > 0 && (
                      <Banner tone="success">{selectedProducts.length} selected</Banner>
                    )}
                  </BlockStack>
                </Card>
              )}

              {newBundle.bundleType === "category" && availableCollections.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">Select Collections</Text>
                    <ResourceList
                      items={availableCollections}
                      renderItem={(collection: Collection) => {
                        const isSelected = selectedCollections.includes(collection.id);
                        return (
                          <ResourceItem
                            id={collection.id}
                            onClick={() => {
                              if (!isSubmitting) {
                                setSelectedCollections(
                                  isSelected
                                    ? selectedCollections.filter(id => id !== collection.id)
                                    : [...selectedCollections, collection.id]
                                );
                              }
                            }}
                          >
                            <InlineStack gap="300">
                              <Checkbox label="" checked={isSelected} onChange={() => {}} disabled={isSubmitting} />
                              <Text as="span">{collection.title}</Text>
                            </InlineStack>
                          </ResourceItem>
                        );
                      }}
                    />
                    {selectedCollections.length > 0 && (
                      <Banner tone="success">{selectedCollections.length} selected</Banner>
                    )}
                  </BlockStack>
                </Card>
              )}

              <InlineStack gap="400">
                <Select
                  label="Discount Type"
                  name="discountType"
                  options={discountTypeOptions}
                  value={newBundle.discountType}
                  onChange={(value) => setNewBundle({ ...newBundle, discountType: value })}
                  disabled={isSubmitting}
                />
                <TextField
                  label="Value"
                  name="discountValue"
                  type="number"
                  value={newBundle.discountValue.toString()}
                  onChange={(value) => setNewBundle({ ...newBundle, discountValue: parseFloat(value) || 0 })}
                  suffix={newBundle.discountType === "percentage" ? "%" : "$"}
                  autoComplete="off"
                  disabled={isSubmitting}
                />
              </InlineStack>

              <TextField
                label="Min Products"
                name="minProducts"
                type="number"
                value={newBundle.minProducts.toString()}
                onChange={(value) => setNewBundle({ ...newBundle, minProducts: parseInt(value) || 2 })}
                autoComplete="off"
                disabled={isSubmitting}
              />

              <input type="hidden" name="selectMinQty" value={newBundle.selectMinQty} />
              <input type="hidden" name="selectMaxQty" value={newBundle.selectMaxQty} />
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>

      {/* Product Picker Modal */}
      <Modal
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        title="Select Products"
        primaryAction={{
          content: "Done",
          onAction: () => setShowProductPicker(false),
        }}
      >
        <Modal.Section>
          <BlockStack gap="300">
            {availableProducts.length === 0 ? (
              <EmptyState heading="No products" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
                <p>Add products to your store</p>
              </EmptyState>
            ) : (
              <ResourceList
                items={availableProducts.slice(0, 50)}
                renderItem={(product: Product) => {
                  const isSelected = assignedProducts.includes(product.id);
                  return (
                    <ResourceItem
                      id={product.id}
                      onClick={() => {
                        setAssignedProducts(
                          isSelected
                            ? assignedProducts.filter(id => id !== product.id)
                            : [...assignedProducts, product.id]
                        );
                      }}
                    >
                      <InlineStack gap="300">
                        <Checkbox label="" checked={isSelected} onChange={() => {}} />
                        <Thumbnail source={product.image} alt={product.title} size="small" />
                        <Text as="span">{product.title}</Text>
                      </InlineStack>
                    </ResourceItem>
                  );
                }}
              />
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}