import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { useEffect, useState } from "react";
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
  const authResult = await authenticate.admin(request);
  const shop = authResult.session.shop;
  
  try {
    // Load bundles
    const bundles = await (prisma as any).bundle.findMany({
      where: { shop },
      include: { products: true },
      orderBy: { createdAt: 'desc' }
    });
    
    // Load products directly from Shopify
    let products: Product[] = [];
    let collections: Collection[] = [];
    
    try {
      console.log('[Loader] Fetching products from Shopify...');
      const productsResponse = await authResult.admin.graphql(`
        query getProducts {
          products(first: 50) {
            edges {
              node {
                id
                title
                priceRangeV2 {
                  minVariantPrice {
                    amount
                  }
                }
                featuredImage {
                  url
                }
              }
            }
          }
        }
      `);
      
      const productsData = await productsResponse.json();
      console.log('[Loader] Products response:', JSON.stringify(productsData, null, 2));
      
      if (productsData.data?.products?.edges) {
        products = productsData.data.products.edges.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          price: edge.node.priceRangeV2.minVariantPrice.amount,
          image: edge.node.featuredImage?.url || ""
        }));
        console.log(`[Loader] Successfully loaded ${products.length} products`);
      } else {
        console.warn('[Loader] No products found in response');
      }
    } catch (error) {
      console.error('[Loader] Failed to load products:', error);
    }
    
    try {
      console.log('[Loader] Fetching collections from Shopify...');
      const collectionsResponse = await authResult.admin.graphql(`
        query getCollections {
          collections(first: 50) {
            edges {
              node {
                id
                title
                productsCount
              }
            }
          }
        }
      `);
      
      const collectionsData = await collectionsResponse.json();
      console.log('[Loader] Collections response:', JSON.stringify(collectionsData, null, 2));
      
      if (collectionsData.data?.collections?.edges) {
        collections = collectionsData.data.collections.edges.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          productsCount: edge.node.productsCount
        }));
        console.log(`[Loader] Successfully loaded ${collections.length} collections`);
      } else {
        console.warn('[Loader] No collections found in response');
      }
    } catch (error) {
      console.error('[Loader] Failed to load collections:', error);
    }
    
    return json({ 
      success: true, 
      bundles, 
      products,
      collections,
      shop 
    });
  } catch (error) {
    console.error('[Bundle Loader] Failed to load data:', error);
    return json({ 
      success: false, 
      bundles: [],
      products: [],
      collections: [],
      error: 'Failed to load data'
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const shopParam = formData.get("shop") as string;
  
  let shop: string;
  
  if (shopParam) {
    shop = shopParam;
  } else {
    const { session } = await authenticate.admin(request);
    shop = session.shop;
  }
  
  const actionType = formData.get("action");

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

      return json({ success: true, bundle, message: "Bundle created successfully" });
    }

    if (actionType === "toggle-status") {
      const bundleId = formData.get("bundleId") as string;
      const status = formData.get("status") as string;

      const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop },
        data: { status },
      });

      return json({ success: true, bundle, message: "Status updated" });
    }

    if (actionType === "delete-bundle") {
      const bundleId = formData.get("bundleId") as string;

      await (prisma as any).bundle.delete({
        where: { id: bundleId, shop },
      });

      return json({ success: true, message: "Bundle deleted successfully" });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Bundle action error:", error);
    return json({ success: false, error: "Failed to perform action" }, { status: 500 });
  }
};

export default function SimpleBundleManagement() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  console.log('[Frontend] Loader data received:', {
    bundlesCount: loaderData.bundles?.length || 0,
    productsCount: loaderData.products?.length || 0,
    collectionsCount: loaderData.collections?.length || 0,
    hasProducts: !!loaderData.products,
    products: loaderData.products
  });
  
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

  // Handle action data responses
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        setShowSuccessBanner(true);
        const message = 'message' in actionData ? actionData.message : "Action completed successfully";
        setBannerMessage(message || "Action completed successfully");
        if (message?.includes("created")) {
          setShowCreateModal(false);
          resetForm();
        }
      } else {
        setShowErrorBanner(true);
        const error = 'error' in actionData ? actionData.error : "Action failed";
        setBannerMessage(error || "Action failed");
      }
      
      setTimeout(() => {
        setShowSuccessBanner(false);
        setShowErrorBanner(false);
      }, 3000);
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

  const handleCreateBundle = async () => {
    if (!newBundle.name.trim()) {
      setShowErrorBanner(true);
      setBannerMessage('Bundle name is required');
      setTimeout(() => setShowErrorBanner(false), 3000);
      return;
    }

    const formData = new FormData();
    formData.append("action", "create-bundle");
    formData.append("name", newBundle.name);
    formData.append("description", newBundle.description);
    formData.append("bundleType", newBundle.bundleType);
    formData.append("discountType", newBundle.discountType);
    formData.append("discountValue", newBundle.discountValue.toString());
    formData.append("minProducts", newBundle.minProducts.toString());
    formData.append("bundleStyle", newBundle.bundleStyle);
    formData.append("selectMinQty", newBundle.selectMinQty.toString());
    formData.append("selectMaxQty", newBundle.selectMaxQty.toString());
    formData.append("allowDeselect", newBundle.allowDeselect.toString());
    formData.append("hideIfNoML", newBundle.hideIfNoML.toString());
    
    if (assignedProducts.length > 0) {
      formData.append("assignedProducts", JSON.stringify(assignedProducts));
    }
    
    if (newBundle.bundleType === 'manual' && selectedProducts.length > 0) {
      formData.append("productIds", JSON.stringify(selectedProducts));
    }
    
    if (newBundle.bundleType === 'category' && selectedCollections.length > 0) {
      formData.append("collectionIds", JSON.stringify(selectedCollections));
    }
    
    if (newBundle.bundleStyle === 'tier') {
      formData.append("tierConfig", JSON.stringify(newBundle.tierConfig));
    }

    // Submit using native form submission (triggers Remix action)
    const form = document.createElement('form');
    form.method = 'POST';
    form.style.display = 'none';
    
    for (const [key, value] of formData.entries()) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value.toString();
      form.appendChild(input);
    }
    
    document.body.appendChild(form);
    form.submit();
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

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page
      title="Bundle Management"
      subtitle="🚀 v1.2 - FIXED: Products load from loader, working product picker"
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
                <Text as="h2" variant="headingMd">
                  Get Started with Bundles
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Create your first bundle to start increasing average order value through strategic product combinations.
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
                ✅ Status
              </Text>
              <Text as="p" variant="bodyMd">
                • Products: {availableProducts.length} loaded
                <br />• Collections: {availableCollections.length} loaded
                <br />• Bundles: {bundles.length} total
              </Text>
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

            {/* Product Assignment Section - FIXED */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Product Assignment</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Choose which product pages should display this bundle
                </Text>
                
                <Button onClick={() => setShowProductPicker(true)}>
                  {`Select Products (${assignedProducts.length} selected)`}
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
                      <p>Add products to your store first</p>
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
                      <p>Create collections in your store first</p>
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

      {/* Product Picker Modal for Assignment - FIXED */}
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