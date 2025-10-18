import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
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
  console.log('[Loader] Starting bundle management loader...');
  
  const authResult = await authenticate.admin(request);
  const shop = authResult.session.shop;
  
  console.log('[Loader] Authenticated for shop:', shop);
  
  try {
    // Load bundles
    const bundles = await (prisma as any).bundle.findMany({
      where: { shop },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`[Loader] Loaded ${bundles.length} bundles`);
    
    // Load products and collections
    let products: Product[] = [];
    let collections: Collection[] = [];
    
    try {
      console.log('[Loader] Fetching products from Shopify GraphQL...');
      
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
        
        console.log(`[Loader] Successfully loaded ${products.length} products`);
      }
    } catch (error: any) {
      console.error('[Loader] Failed to load products:', error);
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
        
        console.log(`[Loader] Successfully loaded ${collections.length} collections`);
      }
    } catch (error: any) {
      console.error('[Loader] Failed to load collections:', error);
    }
    
    return json({ 
      success: true, 
      bundles, 
      products,
      collections,
      shop
    });
  } catch (error: any) {
    console.error('[Bundle Loader] Critical error:', error);
    
    return json({ 
      success: false, 
      bundles: [],
      products: [],
      collections: [],
      error: error.message || 'Failed to load data'
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('[Action] Received request, method:', request.method);
  console.log('[Action] Content-Type:', request.headers.get('content-type'));
  
  const authResult = await authenticate.admin(request);
  const shop = authResult.session.shop;
  
  console.log('[Action] Authenticated shop:', shop);

  const formData = await request.formData();
  const actionType = formData.get("action") as string;
  
  console.log('[Action] Action type:', actionType);
  console.log('[Action] FormData keys:', Array.from(formData.keys()));

  try {
    if (actionType === "create-bundle") {
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const bundleType = formData.get("bundleType") as string;
      const discountType = formData.get("discountType") as string;
      const discountValue = parseFloat(formData.get("discountValue") as string);
      const minProducts = parseInt(formData.get("minProducts") as string) || 2;
      const productIds = formData.get("productIds") as string;
      const collectionIds = formData.get("collectionIds") as string;
      const assignedProducts = formData.get("assignedProducts") as string;
      const bundleStyle = formData.get("bundleStyle") as string || "grid";
      const selectMinQty = formData.get("selectMinQty");
      const selectMaxQty = formData.get("selectMaxQty");
      const tierConfig = formData.get("tierConfig") as string;
      const allowDeselect = formData.get("allowDeselect") === "true";
      const hideIfNoML = formData.get("hideIfNoML") === "true";

      console.log('[Action] Bundle data:', { name, bundleType, discountType, discountValue });

      if (!name || !bundleType || discountValue < 0) {
        console.error('[Action] Validation failed');
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

      console.log('[Action] Bundle created successfully:', bundle.id);
      return json({ success: true, bundle, message: "Bundle created successfully!" });
    }

    if (actionType === "toggle-status") {
      const bundleId = formData.get("bundleId") as string;
      const status = formData.get("status") as string;

      const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop },
        data: { status },
      });

      return json({ success: true, bundle, message: "Status updated successfully!" });
    }

    if (actionType === "delete-bundle") {
      const bundleId = formData.get("bundleId") as string;

      await (prisma as any).bundle.delete({
        where: { id: bundleId, shop },
      });

      return json({ success: true, message: "Bundle deleted successfully!" });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[Action] Error:", error);
    return json({ success: false, error: error.message || "Failed to perform action" }, { status: 500 });
  }
};

export default function SimpleBundleManagement() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  
  console.log('[Frontend] Loader data:', loaderData);
  console.log('[Frontend] Action data:', actionData);
  console.log('[Frontend] Navigation state:', navigation.state);
  
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

  // Handle action responses
  useEffect(() => {
    if (actionData) {
      console.log('[Frontend] Processing action data:', actionData);
      if (actionData.success) {
        setShowSuccessBanner(true);
        setBannerMessage(actionData.message || "Action completed successfully");
        setShowCreateModal(false);
        resetForm();
        
        setTimeout(() => setShowSuccessBanner(false), 3000);
      } else {
        setShowErrorBanner(true);
        setBannerMessage(actionData.error || "Action failed");
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

  const handleCreateBundle = () => {
    console.log('[handleCreateBundle] Starting...');
    
    if (!newBundle.name.trim()) {
      setShowErrorBanner(true);
      setBannerMessage('Bundle name is required');
      setTimeout(() => setShowErrorBanner(false), 3000);
      return;
    }

    // Populate hidden form fields
    if (formRef.current) {
      const form = formRef.current;
      
      // Set all form values
      (form.elements.namedItem('name') as HTMLInputElement).value = newBundle.name;
      (form.elements.namedItem('description') as HTMLInputElement).value = newBundle.description;
      (form.elements.namedItem('bundleType') as HTMLInputElement).value = newBundle.bundleType;
      (form.elements.namedItem('discountType') as HTMLInputElement).value = newBundle.discountType;
      (form.elements.namedItem('discountValue') as HTMLInputElement).value = newBundle.discountValue.toString();
      (form.elements.namedItem('minProducts') as HTMLInputElement).value = newBundle.minProducts.toString();
      (form.elements.namedItem('bundleStyle') as HTMLInputElement).value = newBundle.bundleStyle;
      (form.elements.namedItem('selectMinQty') as HTMLInputElement).value = newBundle.selectMinQty.toString();
      (form.elements.namedItem('selectMaxQty') as HTMLInputElement).value = newBundle.selectMaxQty.toString();
      (form.elements.namedItem('allowDeselect') as HTMLInputElement).value = newBundle.allowDeselect.toString();
      (form.elements.namedItem('hideIfNoML') as HTMLInputElement).value = newBundle.hideIfNoML.toString();
      
      if (assignedProducts.length > 0) {
        (form.elements.namedItem('assignedProducts') as HTMLInputElement).value = JSON.stringify(assignedProducts);
      }
      
      if (newBundle.bundleType === 'manual' && selectedProducts.length > 0) {
        (form.elements.namedItem('productIds') as HTMLInputElement).value = JSON.stringify(selectedProducts);
      }
      
      if (newBundle.bundleType === 'category' && selectedCollections.length > 0) {
        (form.elements.namedItem('collectionIds') as HTMLInputElement).value = JSON.stringify(selectedCollections);
      }
      
      if (newBundle.bundleStyle === 'tier') {
        (form.elements.namedItem('tierConfig') as HTMLInputElement).value = JSON.stringify(newBundle.tierConfig);
      }

      console.log('[handleCreateBundle] Submitting hidden form...');
      
      // Click the hidden submit button to trigger Remix form submission
      const submitButton = document.getElementById('hidden-submit-button') as HTMLButtonElement;
      if (submitButton) {
        submitButton.click();
      }
    }
  };

  const handleToggleStatus = (bundleId: string, currentStatus: string) => {
    // Find the toggle form and submit it
    const toggleForm = document.getElementById(`toggle-${bundleId}`) as HTMLFormElement;
    if (toggleForm) {
      (toggleForm.elements.namedItem('status') as HTMLInputElement).value = currentStatus === 'active' ? 'paused' : 'active';
      toggleForm.requestSubmit();
    }
  };

  const handleDeleteBundle = (bundleId: string) => {
    if (confirm("Are you sure you want to delete this bundle?")) {
      const deleteForm = document.getElementById(`delete-${bundleId}`) as HTMLFormElement;
      if (deleteForm) {
        deleteForm.requestSubmit();
      }
    }
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
        onClick={() => handleToggleStatus(bundle.id, bundle.status)}
        loading={navigation.state === "submitting"}
      >
        {bundle.status === "active" ? "Pause" : "Activate"}
      </Button>
      <Button
        size="micro"
        tone="critical"
        onClick={() => handleDeleteBundle(bundle.id)}
        loading={navigation.state === "submitting"}
      >
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page
      title="Bundle Management"
      subtitle="🚀 v1.4 - FIXED: Proper Remix form submission"
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
                  <Badge tone="info">{bundles.length} Bundle{bundles.length === 1 ? "" : "s"}</Badge>
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
                ✅ Status
              </Text>
              <Text as="p" variant="bodyMd">
                • Products: {availableProducts.length}
                <br />• Collections: {availableCollections.length}
                <br />• Bundles: {bundles.length}
                <br />• Submitting: {isSubmitting ? 'Yes' : 'No'}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Create Bundle Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => !isSubmitting && setShowCreateModal(false)}
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
            disabled: isSubmitting,
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
              disabled={isSubmitting}
            />

            <TextField
              label="Description (Optional)"
              value={newBundle.description}
              onChange={(value) => setNewBundle({ ...newBundle, description: value })}
              placeholder="Brief description"
              multiline={2}
              autoComplete="off"
              disabled={isSubmitting}
            />

            <Select
              label="Bundle Type"
              options={bundleTypeOptions}
              value={newBundle.bundleType}
              onChange={(value) => setNewBundle({ ...newBundle, bundleType: value })}
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />

            {/* Product Assignment */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Product Assignment</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Choose which product pages should display this bundle
                </Text>
                
                <Button 
                  onClick={() => setShowProductPicker(true)}
                  disabled={availableProducts.length === 0 || isSubmitting}
                >
                  {availableProducts.length === 0 
                    ? "No products available" 
                    : `Select Products (${assignedProducts.length} selected)`
                  }
                </Button>
                
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
                            disabled={isSubmitting}
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
              disabled={isSubmitting}
            />

            <Checkbox
              label="Hide if no AI recommendations"
              checked={newBundle.hideIfNoML}
              onChange={(checked) => setNewBundle({ ...newBundle, hideIfNoML: checked })}
              disabled={isSubmitting}
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
                      <p>Add products to your store first</p>
                    </EmptyState>
                  ) : (
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
                              <Checkbox 
                                label="" 
                                checked={isSelected} 
                                onChange={() => {}}
                                disabled={isSubmitting}
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

            {/* Category Bundle */}
            {newBundle.bundleType === "category" && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Select Collections</Text>
                  
                  {availableCollections.length === 0 ? (
                    <EmptyState
                      heading="No collections available"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Create collections in your store first</p>
                    </EmptyState>
                  ) : (
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
                disabled={isSubmitting}
              />
              <TextField
                label="Discount Value"
                type="number"
                value={newBundle.discountValue.toString()}
                onChange={(value) => setNewBundle({ ...newBundle, discountValue: parseFloat(value) || 0 })}
                suffix={newBundle.discountType === "percentage" ? "%" : "$"}
                autoComplete="off"
                disabled={isSubmitting}
              />
            </InlineStack>

            <TextField
              label="Minimum Products"
              type="number"
              value={newBundle.minProducts.toString()}
              onChange={(value) => setNewBundle({ ...newBundle, minProducts: parseInt(value) || 2 })}
              autoComplete="off"
              disabled={isSubmitting}
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
                <p>Add products to your store first</p>
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

      {/* Hidden form for create bundle */}
      <Form method="post" ref={formRef} style={{ display: 'none' }}>
        <input type="hidden" name="action" value="create-bundle" />
        <input type="hidden" name="name" />
        <input type="hidden" name="description" />
        <input type="hidden" name="bundleType" />
        <input type="hidden" name="discountType" />
        <input type="hidden" name="discountValue" />
        <input type="hidden" name="minProducts" />
        <input type="hidden" name="bundleStyle" />
        <input type="hidden" name="selectMinQty" />
        <input type="hidden" name="selectMaxQty" />
        <input type="hidden" name="allowDeselect" />
        <input type="hidden" name="hideIfNoML" />
        <input type="hidden" name="assignedProducts" />
        <input type="hidden" name="productIds" />
        <input type="hidden" name="collectionIds" />
        <input type="hidden" name="tierConfig" />
        <button type="submit" id="hidden-submit-button" style={{ display: 'none' }}>Submit</button>
      </Form>

      {/* Hidden forms for toggle/delete actions for each bundle */}
      {bundles.map((bundle: Bundle) => (
        <div key={bundle.id} style={{ display: 'none' }}>
          <Form method="post" id={`toggle-${bundle.id}`}>
            <input type="hidden" name="action" value="toggle-status" />
            <input type="hidden" name="bundleId" value={bundle.id} />
            <input type="hidden" name="status" />
          </Form>
          <Form method="post" id={`delete-${bundle.id}`}>
            <input type="hidden" name="action" value="delete-bundle" />
            <input type="hidden" name="bundleId" value={bundle.id} />
          </Form>
        </div>
      ))}
    </Page>
  );
}