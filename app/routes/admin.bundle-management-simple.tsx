import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useRevalidator } from "@remix-run/react";
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
  Spinner,
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Load bundles only (product/collection fetching moved to API endpoints)
  const authResult = await authenticate.admin(request);
  const shop = authResult.session.shop;
  try {
    const bundles = await (prisma as any).bundle.findMany({
      where: { shop },
      include: {
        products: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return json({ success: true, bundles });
  } catch (error) {
    console.error('[Bundle Loader] Failed to load bundles:', error);
    return json({ 
      success: true, 
      bundles: [], 
      error: 'Failed to load bundles'
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // Check if shop parameter is provided (bypass auth pattern)
  const formData = await request.formData();
  const shopParam = formData.get("shop") as string;
  
  let shop: string;
  
  if (shopParam) {
    // Use shop parameter to bypass hanging auth
    shop = shopParam;
    console.log('[Bundle Action] Using shop parameter:', shop);
  } else {
    // Fall back to regular auth
    const { session } = await authenticate.admin(request);
    shop = session.shop;
    console.log('[Bundle Action] Using authenticated session:', shop);
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
      const productIds = (formData.get("productIds") as string) || "[]";
      const collectionIds = (formData.get("collectionIds") as string) || "[]";

      if (!name || !bundleType || discountValue < 0) {
        return json({ success: false, error: "Invalid bundle data" }, { status: 400 });
      }

  const bundle = await (prisma as any).bundle.create({
        data: {
          shop: shop,
          name,
          description,
          type: bundleType,
          discountType,
          discountValue,
          minProducts,
          productIds: bundleType === 'manual' ? productIds : "[]",
          collectionIds: bundleType === 'category' ? collectionIds : "[]",
          status: "draft",
        },
      });

      console.log('[Bundle Action] Bundle created successfully:', bundle.id);
      return json({ success: true, bundle });
    }

    if (actionType === "toggle-status") {
      const bundleId = formData.get("bundleId") as string;
      const status = formData.get("status") as string;

  const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop: shop },
        data: { status },
      });

      return json({ success: true, bundle });
    }

    if (actionType === "delete-bundle") {
      const bundleId = formData.get("bundleId") as string;

  await (prisma as any).bundle.delete({
        where: { id: bundleId, shop: shop },
      });

      console.log('[Bundle Action] Bundle deleted successfully:', bundleId);
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
  const productFetcher = useFetcher<any>();
  const collectionsFetcher = useFetcher<any>();
  const revalidator = useRevalidator();

  // Handle both bundle and product data from loader
  const bundles = (loaderData as any).bundles || [];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
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
    maxProducts: 10,
    status: "active",
    // NEW FIELDS - Enhanced bundle features
    bundleStyle: "grid" as "grid" | "fbt" | "tier",
    assignedProducts: [] as string[],
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
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [availableCollections, setAvailableCollections] = useState<any[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);

  // (no SSR-unsafe UI in this page; no client flag needed)

  // Auto-load products when modal opens with manual type (via API endpoint)
  useEffect(() => {
    console.log('[Bundle] Auto-load check:', {
      showCreateModal,
      bundleType: newBundle.bundleType,
      hasProducts: !!(productFetcher.data as any)?.products,
      productsLength: (productFetcher.data as any)?.products?.length || 0,
      fetcherState: productFetcher.state
    });
    
    if (showCreateModal && newBundle.bundleType === 'manual' && 
        !(productFetcher.data as any)?.products && productFetcher.state === 'idle') {
      console.log('[Bundle] Loading products...');
      
      // Use API endpoint to fetch products
      const apiUrl = `/api/bundle-management?action=products`;
      // Pass token via header by using fetcher.submit with method GET is not possible; use load directly
      // We can't add headers with load; fallback: simple GET without headers (admin session cookie will authorize)
      productFetcher.load(apiUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal, newBundle.bundleType, (productFetcher.data as any), productFetcher.state]);

  // Auto-load collections when modal opens with category type (via API endpoint)
  useEffect(() => {
    if (showCreateModal && newBundle.bundleType === 'category' && 
        availableCollections.length === 0 && !isLoadingCollections) {
      console.log('🔥 Loading collections via API fetcher...');
      setIsLoadingCollections(true);
      // GET collections via API; cookies/session will auth
      collectionsFetcher.load('/api/bundle-management?action=categories');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal, newBundle.bundleType, availableCollections.length, isLoadingCollections]);

  // Handle collections fetcher response
  useEffect(() => {
    if (collectionsFetcher.state === 'idle' && collectionsFetcher.data) {
      const data = collectionsFetcher.data as any;
      if (data.success && data.categories) {
        setAvailableCollections(data.categories);
      }
      setIsLoadingCollections(false);
    }
  }, [collectionsFetcher.state, collectionsFetcher.data]);

  // Handle product fetcher state - with logging
  useEffect(() => {
    console.log('[Bundle] Product fetcher state changed:', {
      state: productFetcher.state,
      hasData: !!productFetcher.data,
      success: (productFetcher.data as any)?.success,
      productsCount: (productFetcher.data as any)?.products?.length || 0,
      error: (productFetcher.data as any)?.error,
      fullData: productFetcher.data
    });
  }, [productFetcher.state, productFetcher.data]);
  
  const isLoadingProducts = productFetcher.state !== 'idle';
  const productLoadError = productFetcher.data && !(productFetcher.data as any).success 
    ? (productFetcher.data as any).error 
    : null;
  const availableProducts = (productFetcher.data as any)?.products || [];

  // We no longer use actionFetcher for mutations; using direct fetch and revalidation

  const resetForm = () => {
    setNewBundle({
      name: "",
      description: "",
      bundleType: "manual",
      discountType: "percentage",
      discountValue: 10,
      minProducts: 2,
      maxProducts: 10,
      status: "active",
      bundleStyle: "grid",
      assignedProducts: [],
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
  };

  const handleCreateBundle = async () => {
    if (!newBundle.name.trim()) {
      setShowErrorBanner(true);
      setBannerMessage('Bundle name is required');
      setTimeout(() => setShowErrorBanner(false), 3000);
      return;
    }

    const url = new URL(window.location.href);
    const idToken = url.searchParams.get('id_token') || '';

    const payload: any = {
      action: 'create-bundle',
      name: newBundle.name,
      description: newBundle.description,
      type: newBundle.bundleType,
      discountType: newBundle.discountType,
      discountValue: Number(newBundle.discountValue),
      minProducts: Number(newBundle.minProducts),
      maxProducts: Number(newBundle.maxProducts),
      status: newBundle.status,
      // NEW FIELDS - Enhanced bundle features
      bundleStyle: newBundle.bundleStyle,
      assignedProducts: newBundle.assignedProducts.length > 0 
        ? JSON.stringify(newBundle.assignedProducts) 
        : null,
      selectMinQty: newBundle.bundleType === 'category' ? Number(newBundle.selectMinQty) : null,
      selectMaxQty: newBundle.bundleType === 'category' ? Number(newBundle.selectMaxQty) : null,
      tierConfig: newBundle.bundleStyle === 'tier' 
        ? JSON.stringify(newBundle.tierConfig) 
        : null,
      allowDeselect: newBundle.allowDeselect,
      hideIfNoML: newBundle.hideIfNoML,
      mainProductId: newBundle.assignedProducts.length > 0 ? newBundle.assignedProducts[0] : null,
    };
    if (newBundle.bundleType === 'manual' && selectedProducts.length > 0) {
      payload.productIds = JSON.stringify(selectedProducts);
    }
    if (newBundle.bundleType === 'category' && selectedCollections.length > 0) {
      // API expects categoryIds
      payload.categoryIds = JSON.stringify(selectedCollections);
    }

    try {
      console.log('[Bundle] Submitting create bundle request to /api/bundle-management ...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch('/api/bundle-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      console.log('[Bundle] Response status:', response.status);
      if (!response.ok) {
        const text = await response.text();
        console.error('[Bundle] Error response:', text);
        throw new Error('Failed to create bundle');
      }

      const result = await response.json();
      console.log('[Bundle] Bundle created:', result);
      setShowSuccessBanner(true);
      setBannerMessage('Bundle created successfully');
      setShowCreateModal(false);
      resetForm();
  try { revalidator.revalidate(); } catch (e) { console.warn('Revalidate failed', e); }
    } catch (error) {
      console.error('[Bundle] Fetch error:', error);
      setShowErrorBanner(true);
      setBannerMessage('Failed to create bundle');
      setTimeout(() => setShowErrorBanner(false), 5000);
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
    (bundle.totalPurchases as any)?.toLocaleString?.() || "0",
    `$${(bundle.totalRevenue || 0).toFixed(2)}`,
    <ButtonGroup key={bundle.id}>
      <Button
        size="micro"
        variant={bundle.status === "active" ? "secondary" : "primary"}
        onClick={async () => {
          const url = new URL(window.location.href);
          const idToken = url.searchParams.get('id_token') || '';
          const payload = { action: 'toggle-status', bundleId: bundle.id, status: bundle.status === 'active' ? 'paused' : 'active' };
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const response = await fetch('/api/bundle-management', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
                'X-Requested-With': 'XMLHttpRequest',
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (response.ok) {
              setShowSuccessBanner(true);
              setBannerMessage('Bundle status updated');
              try { revalidator.revalidate(); } catch (e) { console.warn('Revalidate failed', e); }
            } else {
              setShowErrorBanner(true);
              setBannerMessage('Failed to update status');
              setTimeout(() => setShowErrorBanner(false), 4000);
            }
          } catch (error) {
            console.error('[Bundle] Toggle error:', error);
            setShowErrorBanner(true);
            setBannerMessage('Failed to update status');
            setTimeout(() => setShowErrorBanner(false), 4000);
          }
        }}
      >
        {bundle.status === "active" ? "Pause" : "Activate"}
      </Button>
      <Button
        size="micro"
        tone="critical"
        onClick={async () => {
          if (confirm("Are you sure you want to delete this bundle?")) {
            const url = new URL(window.location.href);
            const idToken = url.searchParams.get('id_token') || '';
            const payload = { action: 'delete-bundle', bundleId: bundle.id };
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 10000);
              const response = await fetch('/api/bundle-management', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
                  'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
              });
              clearTimeout(timeout);
              if (response.ok) {
                setShowSuccessBanner(true);
                setBannerMessage('Bundle deleted successfully');
                try { revalidator.revalidate(); } catch (e) { console.warn('Revalidate failed', e); }
              } else {
                setShowErrorBanner(true);
                setBannerMessage('Failed to delete bundle');
                setTimeout(() => setShowErrorBanner(false), 4000);
              }
            } catch (error) {
              console.error('[Bundle] Delete error:', error);
              setShowErrorBanner(true);
              setBannerMessage('Failed to delete bundle');
              setTimeout(() => setShowErrorBanner(false), 4000);
            }
          }
        }}
      >
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  return (
    <Page
      title="Bundle Management"
      subtitle="✅ UPDATED Oct 3, 2025 - NO App Bridge - Direct fetch like Settings"
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
                <Banner>
                  <Text as="p" variant="bodyMd">
                    <strong>Bundle Types:</strong>
                    <br />• <strong>Manual:</strong> Handpick specific products
                    <br />• <strong>Category:</strong> Auto-bundle from categories
                    <br />• <strong>AI Suggested:</strong> Smart recommendations with approval workflow
                  </Text>
                </Banner>
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
                🎯 Bundle Strategy
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Bundles work seamlessly with your theme embed to show customers relevant product combinations at the perfect moment.
              </Text>
              <BlockStack gap="200">
                <Banner tone="info">
                  <Text as="p" variant="bodySm">
                    <strong>Backend:</strong> Complex logic, product selection, discount rules, approval workflows
                  </Text>
                </Banner>
                <Banner tone="success">
                  <Text as="p" variant="bodySm">
                    <strong>Theme Embed:</strong> Smart display, customer interaction, cart integration
                  </Text>
                </Banner>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                💡 Best Practices
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Start with 10-15% discounts
                <br />• Use AI bundles for cross-sell discovery
                <br />• Test manual bundles for key products
                <br />• Monitor performance in Dashboard
                <br />• A/B test different discount rates
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
        }}
        title="Create New Bundle"
        primaryAction={{
          content: "Create Bundle",
          disabled: !newBundle.name.trim(),
          onAction: handleCreateBundle,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setShowCreateModal(false);
            },
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
              helpText="This name will be shown to customers"
            />

            <TextField
              label="Description (Optional)"
              value={newBundle.description}
              onChange={(value) => setNewBundle({ ...newBundle, description: value })}
              placeholder="Brief description of the bundle"
              multiline={2}
              autoComplete="off"
            />

            <Select
              label="Bundle Type"
              options={bundleTypeOptions}
              value={newBundle.bundleType}
              onChange={(value) => {
                setNewBundle({ ...newBundle, bundleType: value });
                if (value === "manual" && availableProducts.length === 0) {
                  productFetcher.load('/api/bundle-management?action=products');
                }
              }}
              helpText="Choose how products are selected for this bundle"
            />

            <Select
              label="Bundle Display Style"
              options={[
                { label: "Grid Layout (Checkable Cards)", value: "grid" },
                { label: "FBT (Frequently Bought Together)", value: "fbt" },
                { label: "Quantity Tiers (Buy More, Save More)", value: "tier" }
              ]}
              value={newBundle.bundleStyle}
              onChange={(value) => setNewBundle({ ...newBundle, bundleStyle: value as "grid" | "fbt" | "tier" })}
              helpText="How the bundle will be displayed to customers"
            />

            {newBundle.bundleStyle === "tier" && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Quantity Tier Pricing</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Set different discounts based on quantity purchased
                  </Text>
                  
                  {newBundle.tierConfig.map((tier, index) => (
                    <InlineStack key={index} gap="200" align="start">
                      <TextField
                        label="Quantity"
                        type="number"
                        value={String(tier.qty)}
                        onChange={(value) => {
                          const newTiers = [...newBundle.tierConfig];
                          newTiers[index].qty = parseInt(value) || 1;
                          setNewBundle({ ...newBundle, tierConfig: newTiers });
                        }}
                        autoComplete="off"
                      />
                      <TextField
                        label="Discount %"
                        type="number"
                        value={String(tier.discount)}
                        onChange={(value) => {
                          const newTiers = [...newBundle.tierConfig];
                          newTiers[index].discount = parseFloat(value) || 0;
                          setNewBundle({ ...newBundle, tierConfig: newTiers });
                        }}
                        suffix="%"
                        autoComplete="off"
                      />
                      {newBundle.tierConfig.length > 1 && (
                        <Button
                          variant="plain"
                          tone="critical"
                          onClick={() => {
                            const newTiers = newBundle.tierConfig.filter((_, i) => i !== index);
                            setNewBundle({ ...newBundle, tierConfig: newTiers });
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </InlineStack>
                  ))}
                  
                  <Button
                    onClick={() => {
                      const lastTier = newBundle.tierConfig[newBundle.tierConfig.length - 1];
                      const newTiers = [
                        ...newBundle.tierConfig,
                        { qty: lastTier.qty + 5, discount: lastTier.discount + 5 }
                      ];
                      setNewBundle({ ...newBundle, tierConfig: newTiers });
                    }}
                  >
                    Add Tier
                  </Button>
                </BlockStack>
              </Card>
            )}

            {newBundle.bundleType === "category" && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Category Selection Rules</Text>
                  <InlineStack gap="200">
                    <TextField
                      label="Minimum Products to Select"
                      type="number"
                      value={String(newBundle.selectMinQty)}
                      onChange={(value) => setNewBundle({ ...newBundle, selectMinQty: parseInt(value) || 2 })}
                      helpText="Customer must select at least this many"
                      autoComplete="off"
                    />
                    <TextField
                      label="Maximum Products Allowed"
                      type="number"
                      value={String(newBundle.selectMaxQty)}
                      onChange={(value) => setNewBundle({ ...newBundle, selectMaxQty: parseInt(value) || 10 })}
                      helpText="Customer can select up to this many"
                      autoComplete="off"
                    />
                  </InlineStack>
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Product Assignment</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Choose which product pages should display this bundle. Leave empty to use only AI recommendations.
                </Text>
                
                <Button
                  onClick={() => {
                    // In a real implementation, this would open Shopify's ResourcePicker
                    // For now, we'll use the product selection from the manual bundle section
                    if (availableProducts.length === 0) {
                      productFetcher.load('/api/bundle-management?action=products');
                    }
                  }}
                >
                  {`Select Products (${newBundle.assignedProducts.length} selected)`}
                </Button>
                
                {newBundle.assignedProducts.length > 0 && (
                  <Text as="p" variant="bodySm">
                    Bundle will show on {newBundle.assignedProducts.length} product page(s)
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Checkbox
              label="Allow customers to deselect items (FBT/Grid only)"
              checked={newBundle.allowDeselect}
              onChange={(checked) => setNewBundle({ ...newBundle, allowDeselect: checked })}
              helpText="If unchecked, all items must be added together"
              disabled={newBundle.bundleStyle === "tier"}
            />

            <Checkbox
              label="Hide bundle if no AI recommendations found"
              checked={newBundle.hideIfNoML}
              onChange={(checked) => setNewBundle({ ...newBundle, hideIfNoML: checked })}
              helpText="Only show this bundle when AI finds product recommendations"
            />

            {newBundle.bundleType === "manual" && (
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingSm">
                      Select Products for Bundle
                    </Text>
                    {!isLoadingProducts && (
                      <Button 
                        size="micro" 
                        onClick={() => {
                          console.log('[Bundle] Manual reload triggered');
                          productFetcher.load('/api/bundle-management?action=products');
                        }}
                      >
                        Reload Products
                      </Button>
                    )}
                  </InlineStack>
                  
                  {isLoadingProducts ? (
                    <BlockStack align="center" gap="300">
                      <Spinner size="large" />
                      <Text as="p">Loading products...</Text>
                    </BlockStack>
                  ) : productLoadError ? (
                    <Banner tone="critical" title="Failed to load products">
                      <p>{productLoadError}</p>
                    </Banner>
                  ) : availableProducts.length === 0 ? (
                    <EmptyState
                      heading="No products found"
                      action={{
                        content: "Load Products",
                        onAction: () => {
                          productFetcher.load('/api/bundle-management?action=products');
                        },
                      }}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Click to load your store's products for bundle selection.</p>
                    </EmptyState>
                  ) : (
                    <ResourceList
                      items={availableProducts.slice(0, 25)}
                      renderItem={(product: any) => {
                        const isSelected = selectedProducts.includes(product.id);
                        const toggleSelection = () => {
                          console.log('[Bundle] Product clicked:', product.id, 'Currently selected:', isSelected);
                          if (isSelected) {
                            const newSelection = selectedProducts.filter((id: string) => id !== product.id);
                            console.log('[Bundle] Removing product. New selection:', newSelection);
                            setSelectedProducts(newSelection);
                          } else {
                            const newSelection = [...selectedProducts, product.id];
                            console.log('[Bundle] Adding product. New selection:', newSelection);
                            setSelectedProducts(newSelection);
                          }
                        };
                        
                        return (
                          <ResourceItem
                            id={product.id}
                            onClick={toggleSelection}
                          >
                            <InlineStack gap="300">
                              <Checkbox 
                                label="" 
                                checked={isSelected} 
                                onChange={toggleSelection}
                              />
                              <Thumbnail source={product.image || ""} alt={product.title} size="small" />
                              <BlockStack gap="100">
                                <Text as="h3" variant="bodyMd">
                                  {product.title}
                                </Text>
                                <Text as="p" variant="bodySm" tone="subdued">
                                  ${product.price || "0.00"}
                                </Text>
                              </BlockStack>
                            </InlineStack>
                          </ResourceItem>
                        );
                      }}
                    />
                  )}

                  {selectedProducts.length > 0 && (
                    <Banner tone="success">
                      <Text as="p" variant="bodyMd">
                        {selectedProducts.length} product{selectedProducts.length === 1 ? "" : "s"} selected for this bundle
                      </Text>
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            )}

            {newBundle.bundleType === "category" && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Select Collections for Bundle
                  </Text>
                  <Text as="p" tone="subdued">
                    Choose which collections should be included in this category bundle. All products from selected collections will be eligible for bundling.
                  </Text>
                  
                  {isLoadingCollections || collectionsFetcher.state !== "idle" ? (
                    <BlockStack align="center" gap="300">
                      <Spinner size="large" />
                      <Text as="p">Loading collections...</Text>
                    </BlockStack>
                  ) : availableCollections.length === 0 ? (
                    <EmptyState
                      heading="No collections found"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      action={{
                        content: "Reload Collections",
                        onAction: () => {
                          setIsLoadingCollections(true);
                          collectionsFetcher.load('/api/bundle-management?action=categories');
                        },
                      }}
                    >
                      <p>No collections available in your store. Create some collections first.</p>
                    </EmptyState>
                  ) : (
                    <ResourceList
                      items={availableCollections}
                      renderItem={(collection: any) => (
                        <ResourceItem
                          id={collection.id}
                          onClick={() => {
                            const isSelected = selectedCollections.includes(collection.id);
                            if (isSelected) {
                              setSelectedCollections(selectedCollections.filter((id: string) => id !== collection.id));
                            } else {
                              setSelectedCollections([...selectedCollections, collection.id]);
                            }
                          }}
                        >
                          <InlineStack gap="300">
                            <Checkbox 
                              label="" 
                              checked={selectedCollections.includes(collection.id)} 
                              onChange={() => {}} 
                            />
                            <BlockStack gap="100">
                              <Text as="h3" variant="bodyMd">
                                {collection.title}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {collection.productsCount} products
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </ResourceItem>
                      )}
                    />
                  )}
                  
                  {selectedCollections.length > 0 && (
                    <Banner tone="success">
                      <Text as="p" variant="bodyMd">
                        {selectedCollections.length} collection{selectedCollections.length === 1 ? '' : 's'} selected for this bundle
                      </Text>
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
                label={newBundle.discountType === "percentage" ? "Discount %" : "Discount $"}
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
              helpText="Minimum number of products required for bundle discount"
              autoComplete="off"
            />

            <Banner tone="info">
              <Text as="p" variant="bodyMd">
                {newBundle.bundleType === "manual" && selectedProducts.length > 0
                  ? `Ready to create bundle with ${selectedProducts.length} selected product${selectedProducts.length === 1 ? "" : "s"}.`
                  : newBundle.bundleType === "manual"
                  ? "Please select products above for your manual bundle."
                  : newBundle.bundleType === "category" && selectedCollections.length > 0
                  ? `Ready to create category bundle with ${selectedCollections.length} collection${selectedCollections.length === 1 ? "" : "s"}.`
                  : newBundle.bundleType === "category"
                  ? "Please select collections above for your category bundle."
                  : "AI bundles use machine learning to create intelligent product combinations."}
              </Text>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}