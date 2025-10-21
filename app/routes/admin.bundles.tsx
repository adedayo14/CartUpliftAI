import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useRevalidator, useSubmit } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Box,
  Divider,
  Icon,
} from "@shopify/polaris";
import { 
  PlusIcon, 
  PackageIcon,
  CollectionIcon,
  MagicIcon,
  CheckIcon,
  XIcon,
  EditIcon,
  DeleteIcon,
  InfoIcon,
} from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
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
  console.log('[Loader] Bundles - Starting...');
  const authResult = await authenticate.admin(request);
  const shop = authResult.session.shop;

  try {
    const bundles = await (prisma as any).bundle.findMany({
      where: { shop },
      orderBy: { createdAt: 'desc' }
    });

    let products: Product[] = [];
    let collections: Collection[] = [];
    let currencyCode: string | undefined = undefined;

    try {
      const shopRes = await authResult.admin.graphql(
        `#graphql
        query shopInfo { 
          shop { 
            currencyCode
            currencyFormats {
              moneyFormat
            }
          } 
        }
        `
      );
      const shopJson = await shopRes.json();
      currencyCode = shopJson?.data?.shop?.currencyCode;
      console.log('[Loader] Shop currency:', currencyCode);
      if (!currencyCode) {
        console.warn('[Loader] Currency code not found, GraphQL response:', JSON.stringify(shopJson));
      }
    } catch (err) {
      console.error('[Loader] Currency fetch error:', err);
    }

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
                  edges { node { price } }
                }
                featuredMedia { preview { image { url } } }
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
      }
    } catch (error) {
      console.error('[Loader] Products error:', error);
    }

    try {
      const collectionsResponse = await authResult.admin.graphql(
        `#graphql
        query getCollections {
          collections(first: 50) {
            edges { node { id title productsCount { count } } }
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
      }
    } catch (error) {
      console.error('[Loader] Collections error:', error);
    }

    return json({ success: true, bundles, products, collections, shop, currencyCode } as const);
  } catch (error: any) {
    console.error('[Loader] Error:', error);
    return json({ success: false, bundles: [], products: [], collections: [], error: error.message } as const);
  }
};

export default function BundlesAdmin() {
  const loaderData = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shopify = useAppBridge();
  const [retryCount, setRetryCount] = useState(0);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);

  const loaderBundles = useMemo(() => (loaderData as any).bundles || [], [loaderData]);
  const currencyCode = (loaderData as any).currencyCode;
  
  // Auto-retry logic for session/auth errors
  useEffect(() => {
    const hasError = !(loaderData as any).success;
    const errorMessage = (loaderData as any).error;
    
    if (hasError && retryCount < 3 && !isAutoRetrying) {
      console.log(`[BundlesAdmin] Error detected: ${errorMessage}. Auto-retry attempt ${retryCount + 1}/3`);
      setIsAutoRetrying(true);
      
      // Exponential backoff: 500ms, 1s, 2s
      const retryDelay = Math.min(500 * Math.pow(2, retryCount), 2000);
      
      setTimeout(() => {
        console.log('[BundlesAdmin] Retrying...');
        setRetryCount(prev => prev + 1);
        revalidator.revalidate();
        setIsAutoRetrying(false);
      }, retryDelay);
    } else if (!hasError && retryCount > 0) {
      // Success after retry - reset counter
      console.log('[BundlesAdmin] Successfully recovered after retry');
      setRetryCount(0);
      setIsAutoRetrying(false);
    }
  }, [loaderData, retryCount, revalidator, isAutoRetrying]);
  
  // Log if currency code is missing to help debug
  useEffect(() => {
    if (!currencyCode) {
      console.warn('[BundlesAdmin] No currency code available from loader. Check Shopify API permissions.');
    } else {
      console.log('[BundlesAdmin] Using currency:', currencyCode);
    }
  }, [currencyCode]);
  const availableProducts = (loaderData.products ?? []) as Product[];
  const availableCollections = (loaderData.collections ?? []) as Collection[];
  const [bundleList, setBundleList] = useState<Bundle[]>(loaderBundles);
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

  const currencySymbol = useMemo(() => {
    if (!currencyCode) {
      console.warn('[currencySymbol] No currency code provided, using default symbol');
      return '$';
    }
    try {
      const parts = new Intl.NumberFormat(undefined, { 
        style: 'currency', 
        currency: currencyCode 
      }).formatToParts(0);
      const symbol = parts.find(p => p.type === 'currency')?.value || currencyCode;
      console.log('[currencySymbol] Currency:', currencyCode, 'Symbol:', symbol);
      return symbol;
    } catch (error) {
      console.error('[currencySymbol] Error formatting currency:', error);
      return currencyCode || '$';
    }
  }, [currencyCode]);

  const formatMoney = useCallback((amount: number) => {
    if (!currencyCode) {
      console.warn('[formatMoney] No currency code, using simple format');
      return `$${(amount || 0).toFixed(2)}`;
    }
    try {
      return new Intl.NumberFormat(undefined, { 
        style: 'currency', 
        currency: currencyCode 
      }).format(amount || 0);
    } catch (error) {
      console.error('[formatMoney] Error formatting amount:', error);
      return `${currencyCode} ${(amount || 0).toFixed(2)}`;
    }
  }, [currencyCode]);

  const [newBundle, setNewBundle] = useState({
    name: "",
    description: "",
    bundleType: "manual",
    discountType: "percentage",
    discountValue: 10,
    minProducts: 2,
    bundleStyle: "grid" as "fbt" | "grid" | "list" | "carousel" | "tier",
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

  useEffect(() => { setBundleList(loaderBundles); }, [loaderBundles]);
  useEffect(() => () => { if (bannerTimeoutRef.current) { clearTimeout(bannerTimeoutRef.current); } }, []);

  const triggerBanner = useCallback((type: "success" | "error", message: string) => {
    setBannerMessage(message);
    setShowSuccessBanner(type === "success");
    setShowErrorBanner(type === "error");
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => {
      setShowSuccessBanner(false);
      setShowErrorBanner(false);
      bannerTimeoutRef.current = null;
    }, 3000);
  }, []);

  const handleFixBundleIds = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/admin/api/bundle-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "fix-bundle-ids" }),
      });
      
      if (response.status === 401) {
        window.location.reload();
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        triggerBanner("success", `Fixed ${data.updatedCount} bundle(s)`);
        revalidator.revalidate();
      } else {
        triggerBanner("error", data.error || "Failed to fix bundle IDs");
      }
    } catch (error: any) {
      console.error('[handleFixBundleIds] Error:', error);
      triggerBanner("error", error.message);
    } finally {
      setIsSaving(false);
    }
  }, [revalidator, triggerBanner]);

  const handleCreateBundle = useCallback(async () => {
    if (!newBundle.name.trim()) {
      triggerBanner("error", "Bundle name is required");
      return;
    }
    setIsSaving(true);
    setShowSuccessBanner(false);
    setShowErrorBanner(false);
    try {
      // Get fresh session token from URL or session
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('id_token') || urlParams.get('session') || '';
      
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
      
      // Make request - if 401, reload page to get fresh session
      const response = await fetch('/admin/api/bundle-management', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(payload),
      });
      
      // If unauthorized, reload page to refresh session
      if (response.status === 401) {
        console.log('[handleCreateBundle] Session expired, reloading page...');
        window.location.reload();
        return;
      }
      
      // Check if response is ok and has JSON content
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[handleCreateBundle] Server error:', response.status, errorText);
        throw new Error(`Server error: ${response.status}. ${errorText.substring(0, 100)}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('[handleCreateBundle] JSON parse error:', jsonError);
        throw new Error('Invalid response from server. Please check your connection and try again.');
      }

      if (data.success) {
        // Success - close modal and refresh page for clean state
        setShowCreateModal(false);
        resetForm();
        if (data.bundle) setBundleList((prev) => [data.bundle as Bundle, ...prev]);
        
        // Auto-refresh page after creation to ensure clean state and avoid blank page
        setTimeout(() => {
          window.location.reload();
        }, 300); // Small delay to show creation animation
      } else {
        triggerBanner("error", data.error || "Failed to create bundle");
      }
    } catch (error: any) {
      triggerBanner("error", error.message || "Failed to create bundle");
    } finally {
      setIsSaving(false);
    }
  }, [newBundle, selectedProducts, selectedCollections, assignedProducts, triggerBanner, resetForm]);

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
    if (isSaving || pendingBundleId) return;
    setPendingBundleId(bundleId);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('id_token') || urlParams.get('session') || '';
      const payload = { action: "toggle-status", bundleId, status: currentStatus === 'active' ? 'paused' : 'active' };
      const response = await fetch('/admin/api/bundle-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify(payload),
      });
      
      // If unauthorized, reload page to refresh session
      if (response.status === 401) {
        console.log('[handleToggleStatus] Session expired, reloading page...');
        window.location.reload();
        return;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[handleToggleStatus] Server error:', response.status, errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('[handleToggleStatus] JSON parse error:', jsonError);
        throw new Error('Invalid response from server');
      }

      if (data.success) {
        const nextStatus = payload.status;
        const updatedBundle = data.bundle as Bundle | undefined;
        setBundleList((prev) => prev.map((b) => b.id === bundleId ? { ...b, status: updatedBundle?.status ?? nextStatus } : b));
        
        // Auto-refresh for clean state
        setTimeout(() => {
          window.location.reload();
        }, 300);
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
    // Silent delete - no confirmation prompt
    if (isSaving || pendingBundleId) return;
    setPendingBundleId(bundleId);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('id_token') || urlParams.get('session') || '';
      const payload = { action: "delete-bundle", bundleId };
      const response = await fetch('/admin/api/bundle-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify(payload),
      });
      
      // If unauthorized, reload page to refresh session
      if (response.status === 401) {
        console.log('[handleDelete] Session expired, reloading page...');
        window.location.reload();
        return;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[handleDelete] Server error:', response.status, errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('[handleDelete] JSON parse error:', jsonError);
        throw new Error('Invalid response from server');
      }

      if (data.success) {
        // Silent success - update UI and reload for better UX
        setBundleList((prev) => prev.filter((b) => b.id !== bundleId));
        // Auto-refresh page after deletion to ensure clean state
        setTimeout(() => {
          window.location.reload();
        }, 300); // Small delay to show deletion animation
      } else {
        triggerBanner("error", data.error || "Failed to delete bundle");
      }
    } catch (error: any) {
      triggerBanner("error", error.message || "Failed to delete bundle");
    } finally {
      setPendingBundleId(null);
    }
  };

  const totalRevenue = useMemo(() => bundleList.reduce((sum, b) => sum + (b.totalRevenue || 0), 0), [bundleList]);
  const totalPurchases = useMemo(() => bundleList.reduce((sum, b) => sum + (b.totalPurchases || 0), 0), [bundleList]);
  const activeBundles = useMemo(() => bundleList.filter(b => b.status === 'active').length, [bundleList]);

  const bundleTableRows = bundleList.map((bundle: Bundle) => [
    <InlineStack gap="300" blockAlign="center" key={`name-${bundle.id}`}>
      <Box>
        <Icon source={bundle.type === 'manual' ? PackageIcon : bundle.type === 'category' ? CollectionIcon : MagicIcon} tone="base" />
      </Box>
      <BlockStack gap="100">
        <Text as="span" variant="bodyMd" fontWeight="semibold">{bundle.name}</Text>
        {bundle.description && <Text as="span" variant="bodySm" tone="subdued">{bundle.description}</Text>}
      </BlockStack>
    </InlineStack>,
    <Text as="span" variant="bodySm">{bundle.type === "manual" ? "Manual" : bundle.type === "category" ? "Category" : "AI Suggested"}</Text>,
    <Badge tone={bundle.status === "active" ? "success" : "info"} key={`badge-${bundle.id}`}>
      {bundle.status === "active" ? "Active" : bundle.status === "paused" ? "Paused" : "Draft"}
    </Badge>,
    <Text as="span" variant="bodySm" fontWeight="medium">{bundle.discountType === "percentage" ? `${bundle.discountValue}%` : formatMoney(bundle.discountValue)}</Text>,
    <Text as="span" variant="bodySm">{bundle.totalPurchases?.toLocaleString?.() || "0"}</Text>,
    <Text as="span" variant="bodySm" fontWeight="medium">{formatMoney(bundle.totalRevenue || 0)}</Text>,
    <ButtonGroup key={`actions-${bundle.id}`}>
      <Button
        size="micro"
        variant={bundle.status === "active" ? "secondary" : "primary"}
        onClick={() => handleToggleStatus(bundle.id, bundle.status)}
        loading={pendingBundleId === bundle.id}
      >
        {bundle.status === "active" ? "Pause" : "Activate"}
      </Button>
      <Button size="micro" tone="critical" onClick={() => handleDelete(bundle.id)} loading={pendingBundleId === bundle.id}>
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  return (
    <Page
      title="Product Bundles"
      primaryAction={{
        content: "Create bundle",
        onAction: () => { resetForm(); setShowCreateModal(true); },
        icon: PlusIcon,
      }}
      secondaryActions={[
        {
          content: "Fix product IDs",
          onAction: handleFixBundleIds,
          helpText: "One-time fix for existing bundles",
        }
      ]}
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

        {bundleList.length > 0 && (
          <Layout.Section>
            <Card>
              <InlineStack gap="800" align="space-between">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">Total revenue</Text>
                  <Text as="p" variant="heading2xl">{formatMoney(totalRevenue)}</Text>
                </BlockStack>
                <Box borderInlineStartWidth="025" borderColor="border" paddingInlineStart="800">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">Total purchases</Text>
                    <Text as="p" variant="heading2xl">{totalPurchases.toLocaleString()}</Text>
                  </BlockStack>
                </Box>
                <Box borderInlineStartWidth="025" borderColor="border" paddingInlineStart="800">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">Active bundles</Text>
                    <Text as="p" variant="heading2xl">{activeBundles} / {bundleList.length}</Text>
                  </BlockStack>
                </Box>
                <Box borderInlineStartWidth="025" borderColor="border" paddingInlineStart="800">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">Avg. bundle value</Text>
                    <Text as="p" variant="heading2xl">
                      {totalPurchases > 0 ? formatMoney(totalRevenue / totalPurchases) : formatMoney(0)}
                    </Text>
                  </BlockStack>
                </Box>
              </InlineStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          {bundleList.length === 0 ? (
            <Card>
              <EmptyState
                heading="Create your first product bundle"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={{
                  content: "Create bundle",
                  onAction: () => { resetForm(); setShowCreateModal(true); },
                  icon: PlusIcon,
                }}
              >
                <p>Increase your average order value by bundling products together with special discounts.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "numeric", "numeric", "text"]}
                headings={["Bundle", "Type", "Status", "Discount", "Purchases", "Revenue", "Actions"]}
                rows={bundleTableRows}
              />
            </Card>
          )}
        </Layout.Section>

        {bundleList.length > 0 && (
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Quick stats</Text>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Products available</Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">{availableProducts.length}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Collections</Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">{availableCollections.length}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd" tone="subdued">Total bundles</Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">{bundleList.length}</Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Bundle types</Text>
                  <BlockStack gap="300">
                    <InlineStack gap="300" blockAlign="start">
                      <Box>
                        <Icon source={PackageIcon} tone="base" />
                      </Box>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">Manual</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Hand-pick specific products
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <InlineStack gap="300" blockAlign="start">
                      <Box>
                        <Icon source={CollectionIcon} tone="base" />
                      </Box>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">Category</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Auto-bundle from collections
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <InlineStack gap="300" blockAlign="start">
                      <Box>
                        <Icon source={MagicIcon} tone="base" />
                      </Box>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">AI Suggested</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          AI-powered recommendations
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        )}
      </Layout>

      {/* Create Bundle Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => !isSaving && setShowCreateModal(false)}
        title="Create bundle"
        primaryAction={{ 
          content: "Create bundle", 
          disabled: !newBundle.name.trim() || isSaving, 
          loading: isSaving, 
          onAction: handleCreateBundle 
        }}
        secondaryActions={[{ 
          content: "Cancel", 
          disabled: isSaving, 
          onAction: () => setShowCreateModal(false) 
        }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <FormLayout>
              <TextField 
                label="Bundle name" 
                value={newBundle.name} 
                onChange={(v) => setNewBundle({ ...newBundle, name: v })} 
                placeholder="e.g., Summer Essentials Bundle" 
                autoComplete="off" 
                disabled={isSaving}
                helpText="This will be displayed to customers"
              />
              
              <TextField 
                label="Description" 
                value={newBundle.description} 
                onChange={(v) => setNewBundle({ ...newBundle, description: v })} 
                placeholder="Describe what's included in this bundle"
                multiline={2} 
                autoComplete="off" 
                disabled={isSaving}
                helpText="Optional internal description"
              />

              <Select 
                label="Bundle type" 
                options={bundleTypeOptions} 
                value={newBundle.bundleType} 
                onChange={(v) => setNewBundle({ ...newBundle, bundleType: v })} 
                disabled={isSaving}
                helpText="Choose how products are selected for this bundle"
              />

                <Banner tone="info">
                <Text as="p" variant="bodySm">
                  💡 <strong>Display style moved to theme editor:</strong> Configure how bundles appear by editing the Smart Bundles block in your theme customizer (Online Store → Themes → Customize).
                </Text>
              </Banner>

              {newBundle.bundleType === "manual" && availableProducts.length > 0 && (
                <Card background="bg-surface-secondary">
                  <BlockStack gap="400">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={PackageIcon} />
                        <Text as="h3" variant="headingMd">Select products</Text>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Choose which products to include in this bundle
                      </Text>
                    </BlockStack>
                    <Box paddingBlockStart="200">
                      <ResourceList
                        items={availableProducts.slice(0, 25)}
                        renderItem={(product: Product) => {
                          // Strip gid://shopify/Product/ prefix for consistency
                          const numericId = product.id.replace('gid://shopify/Product/', '');
                          const isSelected = selectedProducts.includes(numericId);
                          return (
                            <ResourceItem 
                              id={product.id} 
                              onClick={() => {
                                if (!isSaving) {
                                  setSelectedProducts(
                                    isSelected 
                                      ? selectedProducts.filter(id => id !== numericId) 
                                      : [...selectedProducts, numericId]
                                  );
                                }
                              }}
                            >
                              <InlineStack gap="300" blockAlign="center">
                                <Checkbox label="" checked={isSelected} onChange={() => {}} disabled={isSaving} />
                                <Thumbnail source={product.image} alt={product.title} size="small" />
                                <BlockStack gap="050">
                                  <Text as="span" variant="bodyMd">{product.title}</Text>
                                  <Text as="span" variant="bodySm" tone="subdued">{formatMoney(parseFloat(product.price))}</Text>
                                </BlockStack>
                              </InlineStack>
                            </ResourceItem>
                          );
                        }}
                      />
                    </Box>
                    {selectedProducts.length > 0 && (
                      <Banner tone="success">
                        <Text as="p" variant="bodySm">
                          {selectedProducts.length} product{selectedProducts.length === 1 ? '' : 's'} selected
                        </Text>
                      </Banner>
                    )}
                  </BlockStack>
                </Card>
              )}

              {newBundle.bundleType === "category" && availableCollections.length > 0 && (
                <Card background="bg-surface-secondary">
                  <BlockStack gap="400">
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={CollectionIcon} />
                        <Text as="h3" variant="headingMd">Select collections</Text>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        All products from selected collections will be eligible for bundling
                      </Text>
                    </BlockStack>
                    <Box paddingBlockStart="200">
                      <ResourceList
                        items={availableCollections}
                        renderItem={(collection: Collection) => {
                          const isSelected = selectedCollections.includes(collection.id);
                          return (
                            <ResourceItem 
                              id={collection.id} 
                              onClick={() => {
                                if (!isSaving) {
                                  setSelectedCollections(isSelected ? selectedCollections.filter(id => id !== collection.id) : [...selectedCollections, collection.id]);
                                }
                              }}
                            >
                              <InlineStack gap="300" blockAlign="center">
                                <Checkbox label="" checked={isSelected} onChange={() => {}} disabled={isSaving} />
                                <BlockStack gap="050">
                                  <Text as="span" variant="bodyMd">{collection.title}</Text>
                                  <Text as="span" variant="bodySm" tone="subdued">{collection.productsCount} products</Text>
                                </BlockStack>
                              </InlineStack>
                            </ResourceItem>
                          );
                        }}
                      />
                    </Box>
                    {selectedCollections.length > 0 && (
                      <Banner tone="success">
                        <Text as="p" variant="bodySm">
                          {selectedCollections.length} collection{selectedCollections.length === 1 ? '' : 's'} selected
                        </Text>
                      </Banner>
                    )}
                  </BlockStack>
                </Card>
              )}

              <FormLayout.Group>
                <Select 
                  label="Discount type" 
                  options={discountTypeOptions} 
                  value={newBundle.discountType} 
                  onChange={(v) => setNewBundle({ ...newBundle, discountType: v })} 
                  disabled={isSaving} 
                />
                <TextField
                  label="Discount value"
                  type="number"
                  value={newBundle.discountValue.toString()}
                  onChange={(v) => setNewBundle({ ...newBundle, discountValue: parseFloat(v) || 0 })}
                  suffix={newBundle.discountType === "percentage" ? "%" : currencySymbol}
                  autoComplete="off"
                  disabled={isSaving}
                />
              </FormLayout.Group>

              <TextField 
                label="Minimum products" 
                type="number" 
                value={newBundle.minProducts.toString()} 
                onChange={(v) => setNewBundle({ ...newBundle, minProducts: parseInt(v) || 2 })} 
                autoComplete="off" 
                disabled={isSaving}
                helpText="Minimum number of products required to apply the bundle discount"
              />

              <BlockStack gap="300">
                <Checkbox 
                  label="Allow customers to deselect bundle items" 
                  checked={newBundle.allowDeselect} 
                  onChange={(checked) => setNewBundle({ ...newBundle, allowDeselect: checked })} 
                  disabled={isSaving}
                  helpText="Let customers customize which products they want from the bundle"
                />
                <Checkbox 
                  label="Hide bundle if no AI recommendations available" 
                  checked={newBundle.hideIfNoML} 
                  onChange={(checked) => setNewBundle({ ...newBundle, hideIfNoML: checked })} 
                  disabled={isSaving}
                  helpText="Only show this bundle when AI can find suitable product recommendations"
                />
              </BlockStack>

              {assignedProducts.length === 0 && (
                <Card background="bg-surface-secondary">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">Product assignment</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Choose which product pages should display this bundle
                    </Text>
                    <Button 
                      onClick={() => setShowProductPicker(true)} 
                      disabled={availableProducts.length === 0 || isSaving}
                    >
                      Select product pages
                    </Button>
                  </BlockStack>
                </Card>
              )}

              {assignedProducts.length > 0 && (
                <Card background="bg-surface-success">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={CheckIcon} tone="success" />
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          Assigned to {assignedProducts.length} product page{assignedProducts.length === 1 ? '' : 's'}
                        </Text>
                      </InlineStack>
                      <Button 
                        size="micro"
                        onClick={() => setShowProductPicker(true)}
                        disabled={isSaving}
                      >
                        Change
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              )}
            </FormLayout>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Product Picker Modal */}
      <Modal 
        open={showProductPicker} 
        onClose={() => setShowProductPicker(false)} 
        title="Select product pages" 
        primaryAction={{ 
          content: "Done", 
          onAction: () => setShowProductPicker(false) 
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              Choose which product pages will display this bundle
            </Text>
            {availableProducts.length === 0 ? (
              <EmptyState 
                heading="No products available" 
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add products to your store to assign them to bundles</p>
              </EmptyState>
            ) : (
              <ResourceList
                items={availableProducts.slice(0, 50)}
                renderItem={(product: Product) => {
                  // Strip gid://shopify/Product/ prefix for comparison
                  const numericId = product.id.replace('gid://shopify/Product/', '');
                  const isSelected = assignedProducts.includes(numericId);
                  return (
                    <ResourceItem 
                      id={product.id} 
                      onClick={() => {
                        setAssignedProducts(
                          isSelected 
                            ? assignedProducts.filter(id => id !== numericId) 
                            : [...assignedProducts, numericId]
                        );
                      }}
                    >
                      <InlineStack gap="300" blockAlign="center">
                        <Checkbox label="" checked={isSelected} onChange={() => {}} />
                        <Thumbnail source={product.image} alt={product.title} size="small" />
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyMd">{product.title}</Text>
                          <Text as="span" variant="bodySm" tone="subdued">{formatMoney(parseFloat(product.price))}</Text>
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

// Error Boundary with Auto-Recovery
export function ErrorBoundary() {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Auto-retry after 3 seconds
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleManualRetry = () => {
    window.location.reload();
  };

  return (
    <Page title="Oops! Something went wrong">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box padding="800">
                <BlockStack gap="400" align="center">
                  <Text as="p" variant="headingXl">⚠️</Text>
                  <Text as="h2" variant="headingLg" alignment="center">
                    Something went wrong
                  </Text>
                  <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                    Don't worry - we're automatically recovering...
                  </Text>
                  <Text as="p" variant="bodyLg" alignment="center" fontWeight="semibold">
                    Auto-refreshing in {countdown} seconds
                  </Text>
                  <Button onClick={handleManualRetry} variant="primary">
                    Refresh Now
                  </Button>
                </BlockStack>
              </Box>
              <Divider />
              <Box padding="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued" fontWeight="semibold">
                    Why did this happen?
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    This is usually a temporary session issue. The page will refresh automatically to restore your session.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued" fontWeight="semibold">
                    If this keeps happening, try:
                  </Text>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">• Clearing your browser cache</Text>
                    <Text as="p" variant="bodySm" tone="subdued">• Logging out and back in to Shopify</Text>
                    <Text as="p" variant="bodySm" tone="subdued">• Using a different browser</Text>
                  </BlockStack>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}