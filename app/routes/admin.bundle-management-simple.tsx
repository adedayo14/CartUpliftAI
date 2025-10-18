import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
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

export default function SimpleBundleManagement() {
  const loaderData = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bundles = loaderData.bundles || [];
  const availableProducts = (loaderData.products ?? []) as Product[];
  const availableCollections = (loaderData.collections ?? []) as Collection[];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [assignedProducts, setAssignedProducts] = useState<string[]>([]);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [pendingBundleId, setPendingBundleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const resetForm = useCallback(() => {
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
  }, []);

  useEffect(() => () => {
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
  }, []);

  const triggerBanner = useCallback((type: "success" | "error", message: string) => {
    setBannerMessage(message);
    setShowSuccessBanner(type === "success");
    setShowErrorBanner(type === "error");

    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }

    bannerTimeoutRef.current = setTimeout(() => {
      setShowSuccessBanner(false);
      setShowErrorBanner(false);
      bannerTimeoutRef.current = null;
    }, 3000);
  }, []);

  const handleCreateBundle = useCallback(async () => {
    if (!newBundle.name.trim()) {
      triggerBanner("error", "Bundle name is required");
      return;
    }

    setIsSaving(true);
    setShowSuccessBanner(false);
    setShowErrorBanner(false);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('id_token') || '';

      const payload = {
        action: "create-bundle",
        name: newBundle.name,
        description: newBundle.description,
        type: newBundle.bundleType,
        discountType: newBundle.discountType,
        discountValue: newBundle.discountValue,
        minProducts: newBundle.minProducts,
        productIds: JSON.stringify(selectedProducts),
        collectionIds: JSON.stringify(selectedCollections),
        assignedProducts: JSON.stringify(assignedProducts),
        bundleStyle: newBundle.bundleStyle,
        selectMinQty: newBundle.selectMinQty,
        selectMaxQty: newBundle.selectMaxQty,
        tierConfig: JSON.stringify(newBundle.tierConfig),
        allowDeselect: newBundle.allowDeselect,
        hideIfNoML: newBundle.hideIfNoML,
      };

      console.log('[Bundle Create] Sending to /api/bundle-management:', payload);

      const response = await fetch('/api/bundle-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('[Bundle Create] API Response:', data);

      if (data.success) {
        triggerBanner("success", "Bundle created successfully!");
        setShowCreateModal(false);
        resetForm();
        revalidator.revalidate();
      } else {
        triggerBanner("error", data.error || "Failed to create bundle");
      }
    } catch (error: any) {
      console.error('[Bundle Create] Error:', error);
      triggerBanner("error", error.message || "Failed to create bundle");
    } finally {
      setIsSaving(false);
    }
  }, [newBundle, selectedProducts, selectedCollections, assignedProducts, triggerBanner, resetForm, revalidator]);

  const bundleTypeOptions = [
    { label: "Manual Bundle", value: "manual" },
    { label: "Category Bundle", value: "category" },
    { label: "AI Suggested", value: "ai_suggested" },
  ];

  const discountTypeOptions = [
    { label: "Percentage Off", value: "percentage" },
    { label: "Fixed Amount Off", value: "fixed" },
  ];

  const handleToggleStatus = async (bundleId: string, currentStatus: string) => {
    if (isSaving || pendingBundleId) {
      return;
    }

    setPendingBundleId(bundleId);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('id_token') || '';

      const payload = {
        action: "toggle-status",
        bundleId,
        status: currentStatus === 'active' ? 'paused' : 'active'
      };

      const response = await fetch('/api/bundle-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        triggerBanner("success", "Status updated!");
        revalidator.revalidate();
      } else {
        triggerBanner("error", data.error || "Failed to update status");
      }
    } catch (error: any) {
      triggerBanner("error", error.message || "Failed to update status");
    } finally {
      setPendingBundleId(null);
    }
  };

  const handleDelete = async (bundleId: string) => {
    if (!confirm("Delete this bundle?")) {
      return;
    }

    if (isSaving || pendingBundleId) {
      return;
    }

    setPendingBundleId(bundleId);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('id_token') || '';

      const payload = {
        action: "delete-bundle",
        bundleId
      };

      const response = await fetch('/api/bundle-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        triggerBanner("success", "Bundle deleted!");
        revalidator.revalidate();
      } else {
        triggerBanner("error", data.error || "Failed to delete bundle");
      }
    } catch (error: any) {
      triggerBanner("error", error.message || "Failed to delete bundle");
    } finally {
      setPendingBundleId(null);
    }
  };

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
      <Button
        size="micro"
        variant={bundle.status === "active" ? "secondary" : "primary"}
        onClick={() => handleToggleStatus(bundle.id, bundle.status)}
        loading={isSaving && pendingBundleId === bundle.id}
      >
        {bundle.status === "active" ? "Pause" : "Activate"}
      </Button>
      <Button
        size="micro"
        tone="critical"
        onClick={() => handleDelete(bundle.id)}
        loading={isSaving && pendingBundleId === bundle.id}
      >
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  return (
    <Page
      title="Bundle Management"
      subtitle="🚀 v2.2 - Fixed API payload structure"
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
                  <Badge tone="info">{`${bundles.length} Bundle${bundles.length === 1 ? "" : "s"}`}</Badge>
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
        onClose={() => !isSaving && setShowCreateModal(false)}
        title="Create New Bundle"
        primaryAction={{
          content: "Create Bundle",
          disabled: !newBundle.name.trim() || isSaving,
          loading: isSaving,
          onAction: handleCreateBundle,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            disabled: isSaving,
            onAction: () => setShowCreateModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <FormLayout>
              <TextField
                label="Bundle Name"
                name="name"
                value={newBundle.name}
                onChange={(value) => setNewBundle({ ...newBundle, name: value })}
                placeholder="e.g., Summer Essentials"
                autoComplete="off"
                disabled={isSaving}
              />

              <TextField
                label="Description"
                name="description"
                value={newBundle.description}
                onChange={(value) => setNewBundle({ ...newBundle, description: value })}
                multiline={2}
                autoComplete="off"
                disabled={isSaving}
              />

              <Select
                label="Bundle Type"
                name="bundleType"
                options={bundleTypeOptions}
                value={newBundle.bundleType}
                onChange={(value) => setNewBundle({ ...newBundle, bundleType: value })}
                disabled={isSaving}
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
                onChange={(value) => setNewBundle({ ...newBundle, bundleStyle: value as "grid" | "fbt" | "tier" })}
                disabled={isSaving}
              />

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Product Assignment</Text>
                  <Button
                    onClick={() => setShowProductPicker(true)}
                    disabled={availableProducts.length === 0 || isSaving}
                  >
                    {`Select Products (${assignedProducts.length})`}
                  </Button>
                </BlockStack>
              </Card>

              <Checkbox
                label="Allow deselect"
                checked={newBundle.allowDeselect}
                onChange={(checked) => setNewBundle({ ...newBundle, allowDeselect: checked })}
                disabled={isSaving}
              />

              <Checkbox
                label="Hide if no AI recs"
                checked={newBundle.hideIfNoML}
                onChange={(checked) => setNewBundle({ ...newBundle, hideIfNoML: checked })}
                disabled={isSaving}
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
                              if (!isSaving) {
                                setSelectedProducts(
                                  isSelected
                                    ? selectedProducts.filter(id => id !== product.id)
                                    : [...selectedProducts, product.id]
                                );
                              }
                            }}
                          >
                            <InlineStack gap="300">
                              <Checkbox label="" checked={isSelected} onChange={() => {}} disabled={isSaving} />
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
                              if (!isSaving) {
                                setSelectedCollections(
                                  isSelected
                                    ? selectedCollections.filter(id => id !== collection.id)
                                    : [...selectedCollections, collection.id]
                                );
                              }
                            }}
                          >
                            <InlineStack gap="300">
                              <Checkbox label="" checked={isSelected} onChange={() => {}} disabled={isSaving} />
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
                  disabled={isSaving}
                />
                <TextField
                  label="Value"
                  name="discountValue"
                  type="number"
                  value={newBundle.discountValue.toString()}
                  onChange={(value) => setNewBundle({ ...newBundle, discountValue: parseFloat(value) || 0 })}
                  suffix={newBundle.discountType === "percentage" ? "%" : "$"}
                  autoComplete="off"
                  disabled={isSaving}
                />
              </InlineStack>

              <TextField
                label="Min Products"
                name="minProducts"
                type="number"
                value={newBundle.minProducts.toString()}
                onChange={(value) => setNewBundle({ ...newBundle, minProducts: parseInt(value) || 2 })}
                autoComplete="off"
                disabled={isSaving}
              />
            </FormLayout>
          </BlockStack>
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