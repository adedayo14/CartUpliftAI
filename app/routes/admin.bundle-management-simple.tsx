import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
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
  console.log('[Loader] Starting bundle management loader...');
  
  const authResult = await authenticate.admin(request);
  const shop = authResult.session.shop;
  
  console.log('[Loader] Authenticated for shop:', shop);
  
  try {
    // Load bundles with correct relation name
    const bundles = await (prisma as any).bundle.findMany({
      where: { shop },
      include: { bundles: true },  // Correct relation name from schema
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`[Loader] Loaded ${bundles.length} bundles`);
    
    // Load products directly from Shopify with enhanced error handling
    let products: Product[] = [];
    let collections: Collection[] = [];
    
    try {
      console.log('[Loader] Fetching products from Shopify GraphQL...');
      
      // Use media instead of deprecated images field
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
      
      console.log('[Loader] GraphQL Response Status:', productsResponse.status);
      console.log('[Loader] GraphQL Response:', JSON.stringify(productsData, null, 2));
      
      // Check for GraphQL errors (with proper type checking)
      const responseData = productsData as any;
      if (responseData.errors) {
        console.error('[Loader] GraphQL errors:', responseData.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
      }
      
      if (productsData.data?.products?.edges) {
        products = productsData.data.products.edges
          .filter((edge: any) => edge?.node) // Filter out null nodes
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
        
        console.log(`[Loader] Successfully mapped ${products.length} products`);
        console.log('[Loader] First product sample:', products[0]);
      } else {
        console.warn('[Loader] No products found in response structure');
        console.warn('[Loader] Response structure:', Object.keys(productsData));
      }
    } catch (error: any) {
      console.error('[Loader] Failed to load products:', error);
      console.error('[Loader] Error stack:', error.stack);
      // Don't throw - continue with empty products
    }
    
    try {
      console.log('[Loader] Fetching collections from Shopify GraphQL...');
      
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
      
      console.log('[Loader] Collections Response:', JSON.stringify(collectionsData, null, 2));
      
      const collectionsResponseData = collectionsData as any;
      if (collectionsResponseData.errors) {
        console.error('[Loader] Collections GraphQL errors:', collectionsResponseData.errors);
      } else if (collectionsData.data?.collections?.edges) {
        collections = collectionsData.data.collections.edges
          .filter((edge: any) => edge?.node)
          .map((edge: any) => ({
            id: edge.node.id,
            title: edge.node.title || 'Untitled Collection',
            productsCount: edge.node.productsCount?.count || 0
          }));
        
        console.log(`[Loader] Successfully loaded ${collections.length} collections`);
      }
    } catch (error: any) {
      console.error('[Loader] Failed to load collections:', error);
      console.error('[Loader] Error stack:', error.stack);
    }
    
    console.log('[Loader] Final counts - Products:', products.length, 'Collections:', collections.length);
    
    return json({ 
      success: true, 
      bundles, 
      products,
      collections,
      shop,
      debug: {
        productsCount: products.length,
        collectionsCount: collections.length,
        bundlesCount: bundles.length
      }
    });
  } catch (error: any) {
    console.error('[Bundle Loader] Critical error:', error);
    console.error('[Bundle Loader] Error stack:', error.stack);
    
    return json({ 
      success: false, 
      bundles: [],
      products: [],
      collections: [],
      error: error.message || 'Failed to load data',
      errorDetails: error.stack
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const contentType = request.headers.get("content-type");
  let actionType, name, description, bundleType, discountType, discountValue, minProducts;
  let productIds, collectionIds, assignedProducts, bundleStyle, selectMinQty, selectMaxQty;
  let tierConfig, allowDeselect, hideIfNoML, shop, bundleId, status;

  // Handle both JSON and FormData
  if (contentType?.includes("application/json")) {
    const body = await request.json();
    actionType = body.action;
    name = body.name;
    description = body.description;
    bundleType = body.bundleType;
    discountType = body.discountType;
    discountValue = parseFloat(body.discountValue);
    minProducts = parseInt(body.minProducts) || 2;
    productIds = body.productIds;
    collectionIds = body.collectionIds;
    assignedProducts = body.assignedProducts;
    bundleStyle = body.bundleStyle || "grid";
    selectMinQty = body.selectMinQty;
    selectMaxQty = body.selectMaxQty;
    tierConfig = body.tierConfig;
    allowDeselect = body.allowDeselect;
    hideIfNoML = body.hideIfNoML;
    bundleId = body.bundleId;
    status = body.status;
    shop = body.shop;
  } else {
    const formData = await request.formData();
    actionType = formData.get("action");
    name = formData.get("name") as string;
    description = formData.get("description") as string;
    bundleType = formData.get("bundleType") as string;
    discountType = formData.get("discountType") as string;
    discountValue = parseFloat(formData.get("discountValue") as string);
    minProducts = parseInt(formData.get("minProducts") as string) || 2;
    productIds = formData.get("productIds") as string;
    collectionIds = formData.get("collectionIds") as string;
    assignedProducts = formData.get("assignedProducts") as string;
    bundleStyle = formData.get("bundleStyle") as string || "grid";
    selectMinQty = formData.get("selectMinQty");
    selectMaxQty = formData.get("selectMaxQty");
    tierConfig = formData.get("tierConfig") as string;
    allowDeselect = formData.get("allowDeselect") === "true";
    hideIfNoML = formData.get("hideIfNoML") === "true";
    bundleId = formData.get("bundleId") as string;
    status = formData.get("status") as string;
    shop = formData.get("shop") as string;
  }

  // Get shop from session if not provided
  if (!shop) {
    const { session } = await authenticate.admin(request);
    shop = session.shop;
  }

  try {
    if (actionType === "create-bundle") {
      if (!name || !bundleType || discountValue < 0) {
        return json({ success: false, error: "Invalid bundle data" }, { status: 400 });
      }

      const bundle = await (prisma as any).bundle.create({
        data: {
          shop,
          name,
          description,
          type: bundleType,
          discountType,
          discountValue,
          minProducts,
          productIds: bundleType === 'manual' ? productIds : "[]",
          collectionIds: bundleType === 'category' ? collectionIds : "[]",
          assignedProducts: assignedProducts || "[]",
          bundleStyle,
          selectMinQty: selectMinQty ? parseInt(selectMinQty as string) : null,
          selectMaxQty: selectMaxQty ? parseInt(selectMaxQty as string) : null,
          tierConfig: tierConfig || null,
          allowDeselect,
          hideIfNoML,
          status: "draft",
        },
      });

      console.log('[Action] Bundle created:', bundle.id);
      return json({ success: true, bundle, message: "Bundle created successfully" });
    }

    if (actionType === "toggle-status") {
      const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop },
        data: { status },
      });

      return json({ success: true, bundle, message: "Status updated" });
    }

    if (actionType === "delete-bundle") {
      await (prisma as any).bundle.delete({
        where: { id: bundleId, shop },
      });

      return json({ success: true, message: "Bundle deleted successfully" });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Bundle action error:", error);
    return json({ success: false, error: error.message || "Failed to perform action" }, { status: 500 });
  }
};

export default function SimpleBundleManagement() {
  const loaderData = useLoaderData<typeof loader>();
  
  console.log('[Frontend] Loader data received:', loaderData);
  
  const bundles = loaderData.bundles || [];
  const availableProducts = loaderData.products || [];
  const availableCollections = loaderData.collections || [];
  
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

  const handleCreateBundle = async () => {
    if (!newBundle.name.trim()) {
      setShowErrorBanner(true);
      setBannerMessage('Bundle name is required');
      setTimeout(() => setShowErrorBanner(false), 3000);
      return;
    }

    setIsSubmitting(true);
    setShowSuccessBanner(false);
    setShowErrorBanner(false);

    try {
      const payload = {
        action: "create-bundle",
        name: newBundle.name,
        description: newBundle.description,
        bundleType: newBundle.bundleType,
        discountType: newBundle.discountType,
        discountValue: newBundle.discountValue,
        minProducts: newBundle.minProducts,
        bundleStyle: newBundle.bundleStyle,
        selectMinQty: newBundle.selectMinQty,
        selectMaxQty: newBundle.selectMaxQty,
        allowDeselect: newBundle.allowDeselect,
        hideIfNoML: newBundle.hideIfNoML,
        assignedProducts: assignedProducts.length > 0 ? JSON.stringify(assignedProducts) : "[]",
        productIds: newBundle.bundleType === 'manual' && selectedProducts.length > 0 ? JSON.stringify(selectedProducts) : "[]",
        collectionIds: newBundle.bundleType === 'category' && selectedCollections.length > 0 ? JSON.stringify(selectedCollections) : "[]",
        tierConfig: newBundle.bundleStyle === 'tier' ? JSON.stringify(newBundle.tierConfig) : null
      };

      const response = await fetch(window.location.pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (data.success) {
        setShowSuccessBanner(true);
        setBannerMessage(data.message || "Bundle created successfully");
        setShowCreateModal(false);
        resetForm();
        // Reload the page to show the new bundle
        window.location.reload();
      } else {
        setShowErrorBanner(true);
        setBannerMessage(data.error || "Failed to create bundle");
      }
    } catch (error: any) {
      console.error('[Create Bundle] Error:', error);
      setShowErrorBanner(true);
      setBannerMessage(error.message || "Failed to create bundle");
    } finally {
      setIsSubmitting(false);
    }

    setTimeout(() => {
      setShowSuccessBanner(false);
      setShowErrorBanner(false);
    }, 3000);
  };

  const bundleTypeOptions = [
    { label: "Manual Bundle (Select specific products)", value: "manual" },
    { label: "Category Bundle (All products from categories)", value: "category" },
    { label: "AI Suggested Bundle (Smart recommendations)", value: "ai_suggested" },
  ];

  const discountTypeOptions = [
    { label: "Percentage Off", value: "percentage" },
    { label: "Fixed Amount Off", value: "fixed" },
  ];

  const bundleTableRows = bundles.map((bundle: Bundle) => [
    bundle.name,
    bundle.type === "manual" ? "Manual" : bundle.type === "category" ? "Category" : "AI Suggested",
    <Badge tone={bundle.status === "active" ? "success" : bundle.status === "paused" ? "warning" : "info"} key={bundle.id}>
      {bundle.status === "active" ? "Active" : bundle.status === "paused" ? "Paused" : "Draft"}
    </Badge>,
    bundle.discountType === "percentage" ? `${bundle.discountValue}% off` : `$${bundle.discountValue} off`,
    bundle.totalPurchases?.toLocaleString?.() || "0",
    `$${(bundle.totalRevenue || 0).toFixed(2)}`,
    <ButtonGroup key={bundle.id}>
      <Button
        size="micro"
        variant={bundle.status === "active" ? "secondary" : "primary"}
        onClick={() => {
          const formData = new FormData();
          formData.append("action", "toggle-status");
          formData.append("bundleId", bundle.id);
          formData.append("status", bundle.status === 'active' ? 'paused' : 'active');
          
          const form = document.createElement('form');
          form.method = 'POST';
          for (const [key, value] of formData.entries()) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value.toString();
            form.appendChild(input);
          }
          document.body.appendChild(form);
          form.submit();
        }}
      >
        {bundle.status === "active" ? "Pause" : "Activate"}
      </Button>
      <Button
        size="micro"
        tone="critical"
        onClick={() => {
          if (confirm("Are you sure you want to delete this bundle?")) {
            const formData = new FormData();
            formData.append("action", "delete-bundle");
            formData.append("bundleId", bundle.id);
            
            const form = document.createElement('form');
            form.method = 'POST';
            for (const [key, value] of formData.entries()) {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = value.toString();
              form.appendChild(input);
            }
            document.body.appendChild(form);
            form.submit();
          }
        }}
      >
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Page
      title="Bundle Management"
      subtitle="🚀 v1.3 - FIXED: Enhanced GraphQL query + detailed logging"
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
        
        {!loaderData.success && 'error' in loaderData && (
          <Layout.Section>
            <Banner tone="critical" title="Failed to load data">
              <p>{loaderData.error}</p>
              {loaderData.errorDetails && (
                <details>
                  <summary>Error details</summary>
                  <BlockStack>
                    <Text as="p" variant="bodySm">{loaderData.errorDetails}</Text>
                  </BlockStack>
                </details>
              )}
            </Banner>
          </Layout.Section>
        )}
        
        <Layout.Section>
          {bundles.length === 0 ? (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Get Started with Bundles
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Create your first bundle to start increasing average order value.
                </Text>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    All Bundles
                  </Text>
                  <Badge tone="info">{`${bundles.length} Bundle${bundles.length === 1 ? "" : "s"}`}</Badge>
                </InlineStack>

                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "numeric", "numeric", "text"]}
                  headings={["Bundle Name", "Type", "Status", "Discount", "Purchases", "Revenue", "Actions"]}
                  rows={bundleTableRows}
                />
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                ✅ Debug Info
              </Text>
              <Text as="p" variant="bodyMd">
                • Products: {availableProducts.length} loaded
                <br />• Collections: {availableCollections.length} loaded
                <br />• Bundles: {bundles.length} total
                <br />• Success: {loaderData.success ? 'Yes' : 'No'}
              </Text>
              {availableProducts.length === 0 && (
                <Banner tone="warning">
                  <p><strong>No products found!</strong></p>
                  <p>Check your browser console and server logs for details.</p>
                  <p>Make sure you have products in your Shopify store.</p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Create Bundle Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Bundle"
        primaryAction={{
          content: "Create Bundle",
          disabled: !newBundle.name.trim() || isSubmitting,
          loading: isSubmitting,
          onAction: handleCreateBundle,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowCreateModal(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Bundle Name"
              value={newBundle.name}
              onChange={(value) => setNewBundle({ ...newBundle, name: value })}
              placeholder="e.g., Summer Beach Essentials"
              autoComplete="off"
            />

            <TextField
              label="Description (Optional)"
              value={newBundle.description}
              onChange={(value) => setNewBundle({ ...newBundle, description: value })}
              placeholder="Brief description"
              multiline={2}
              autoComplete="off"
            />

            <Select
              label="Bundle Type"
              options={bundleTypeOptions}
              value={newBundle.bundleType}
              onChange={(value) => setNewBundle({ ...newBundle, bundleType: value })}
            />

            <Select
              label="Bundle Display Style"
              options={[
                { label: "Grid Layout", value: "grid" },
                { label: "FBT (Frequently Bought Together)", value: "fbt" },
                { label: "Quantity Tiers", value: "tier" }
              ]}
              value={newBundle.bundleStyle}
              onChange={(value) => setNewBundle({ ...newBundle, bundleStyle: value as any })}
            />

            {/* Product Assignment Section */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Product Assignment</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Choose which product pages should display this bundle
                </Text>
                
                <Button 
                  onClick={() => setShowProductPicker(true)}
                  disabled={availableProducts.length === 0}
                >
                  {availableProducts.length === 0 
                    ? "No products available" 
                    : `Select Products (${assignedProducts.length} selected)`
                  }
                </Button>
                
                {availableProducts.length === 0 && (
                  <Text as="p" variant="bodySm" tone="critical">
                    Add products to your Shopify store first, then refresh this page.
                  </Text>
                )}
                
                {assignedProducts.length > 0 && (
                  <BlockStack gap="200">
                    {assignedProducts.map(id => {
                      const product = availableProducts.find((p) => p && p.id === id);
                      return product ? (
                        <InlineStack key={id} gap="200" blockAlign="center">
                          <Thumbnail source={product.image} alt={product.title} size="small" />
                          <Text as="span">{product.title}</Text>
                          <Button
                            size="micro"
                            onClick={() => setAssignedProducts(assignedProducts.filter(pid => pid !== id))}
                          >
                            Remove
                          </Button>
                        </InlineStack>
                      ) : null;
                    })}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <Checkbox
              label="Allow customers to deselect items"
              checked={newBundle.allowDeselect}
              onChange={(checked) => setNewBundle({ ...newBundle, allowDeselect: checked })}
            />

            <Checkbox
              label="Hide if no AI recommendations"
              checked={newBundle.hideIfNoML}
              onChange={(checked) => setNewBundle({ ...newBundle, hideIfNoML: checked })}
            />

            {/* Manual Bundle Product Selection */}
            {newBundle.bundleType === "manual" && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Select Products for Bundle
                  </Text>
                  
                  {availableProducts.length === 0 ? (
                    <EmptyState
                      heading="No products available"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Add products to your Shopify store first, then reload this page.</p>
                    </EmptyState>
                  ) : (
                    <ResourceList
                      items={availableProducts.filter((p): p is NonNullable<typeof p> => p !== null).slice(0, 25) as any}
                      renderItem={(product: any) => {
                        const isSelected = selectedProducts.includes(product.id);
                        return (
                          <ResourceItem
                            id={product.id}
                            onClick={() => {
                              setSelectedProducts(
                                isSelected
                                  ? selectedProducts.filter(id => id !== product.id)
                                  : [...selectedProducts, product.id]
                              );
                            }}
                          >
                            <InlineStack gap="300">
                              <Checkbox 
                                label="" 
                                checked={isSelected} 
                                onChange={() => {}}
                              />
                              <Thumbnail source={product.image} alt={product.title} size="small" />
                              <BlockStack gap="100">
                                <Text as="h3" variant="bodyMd">{product.title}</Text>
                                <Text as="p" variant="bodySm" tone="subdued">${product.price}</Text>
                              </BlockStack>
                            </InlineStack>
                          </ResourceItem>
                        );
                      }}
                    />
                  )}

                  {selectedProducts.length > 0 && (
                    <Banner tone="success">
                      {selectedProducts.length} product{selectedProducts.length === 1 ? "" : "s"} selected
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            )}

            {/* Category Bundle Collection Selection */}
            {newBundle.bundleType === "category" && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Select Collections
                  </Text>
                  
                  {availableCollections.length === 0 ? (
                    <EmptyState
                      heading="No collections available"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Create collections in your Shopify store first</p>
                    </EmptyState>
                  ) : (
                    <ResourceList
                      items={availableCollections.filter((c): c is NonNullable<typeof c> => c !== null) as any}
                      renderItem={(collection: any) => {
                        const isSelected = selectedCollections.includes(collection.id);
                        return (
                          <ResourceItem
                            id={collection.id}
                            onClick={() => {
                              setSelectedCollections(
                                isSelected
                                  ? selectedCollections.filter(id => id !== collection.id)
                                  : [...selectedCollections, collection.id]
                              );
                            }}
                          >
                            <InlineStack gap="300">
                              <Checkbox label="" checked={isSelected} onChange={() => {}} />
                              <BlockStack gap="100">
                                <Text as="h3" variant="bodyMd">{collection.title}</Text>
                                <Text as="p" variant="bodySm" tone="subdued">
                                  {collection.productsCount} products
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </ResourceItem>
                        );
                      }}
                    />
                  )}

                  {selectedCollections.length > 0 && (
                    <Banner tone="success">
                      {selectedCollections.length} collection{selectedCollections.length === 1 ? "" : "s"} selected
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            )}

            <InlineStack gap="400">
              <Select
                label="Discount Type"
                options={discountTypeOptions}
                value={newBundle.discountType}
                onChange={(value) => setNewBundle({ ...newBundle, discountType: value })}
              />
              <TextField
                label="Discount Value"
                type="number"
                value={newBundle.discountValue.toString()}
                onChange={(value) => setNewBundle({ ...newBundle, discountValue: parseFloat(value) || 0 })}
                suffix={newBundle.discountType === "percentage" ? "%" : "$"}
                autoComplete="off"
              />
            </InlineStack>

            <TextField
              label="Minimum Products"
              type="number"
              value={newBundle.minProducts.toString()}
              onChange={(value) => setNewBundle({ ...newBundle, minProducts: parseInt(value) || 2 })}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Product Picker Modal */}
      <Modal
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        title="Select Products to Show Bundle On"
        primaryAction={{
          content: "Done",
          onAction: () => setShowProductPicker(false),
        }}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">
              Select which product pages should display this bundle
            </Text>
            
            {availableProducts.length === 0 ? (
              <EmptyState
                heading="No products available"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add products to your Shopify store, then reload this page.</p>
              </EmptyState>
            ) : (
              <ResourceList
                items={availableProducts.filter((p): p is NonNullable<typeof p> => p !== null).slice(0, 50) as any}
                renderItem={(product: any) => {
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
                        <BlockStack gap="100">
                          <Text as="h3" variant="bodyMd">{product.title}</Text>
                          <Text as="p" variant="bodySm" tone="subdued">${product.price}</Text>
                        </BlockStack>
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