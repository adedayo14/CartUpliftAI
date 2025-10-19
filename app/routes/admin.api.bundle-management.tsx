import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('🔥 Bundle Management API: Request received');
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  
  console.log('🔥 Bundle Management API called:', { action, shop: session.shop });

  try {
    if (action === "bundles") {
      // Get all bundles for the shop
      const bundles = await (prisma as any).bundle.findMany({
        where: { shop: session.shop },
        include: {
          bundles: true  // Include BundleProduct relations
        },
        orderBy: { createdAt: 'desc' }
      });

      return json({ success: true, bundles });
    }

    if (action === "categories") {
      // Get shop categories via GraphQL (use already authenticated admin client)
      console.log('🔥 Fetching collections for shop:', session.shop);
      
      // Add timeout protection
      const graphqlPromise = admin.graphql(`
        #graphql
        query getCollections {
          collections(first: 100) {
            edges {
              node {
                id
                title
                handle
                productsCount
              }
            }
          }
        }
      `);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Collections request timed out')), 10000)
      );

      const response = await Promise.race([graphqlPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        console.error('🔥 Collections GraphQL request failed:', response.status);
        return json({ 
          success: false, 
          error: 'Failed to fetch collections from Shopify',
          categories: []
        }, { status: 500 });
      }

      const responseJson = await response.json();
      
      if ((responseJson as any).errors) {
        console.error('🔥 Collections GraphQL errors:', (responseJson as any).errors);
        return json({ 
          success: false, 
          error: 'Failed to fetch collections from Shopify',
          categories: []
        }, { status: 500 });
      }
      
      const collections = responseJson.data?.collections?.edges || [];
      console.log(`🔥 Successfully fetched ${collections.length} collections`);
      
      return json({ 
        success: true, 
        categories: collections.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          productsCount: edge.node.productsCount
        }))
      });
    }

    if (action === "products") {
      const categoryId = url.searchParams.get("categoryId");
      const query = url.searchParams.get("query") || "";
      // Use already authenticated admin client

      let graphqlQuery = `
        #graphql
        query getProducts($query: String!) {
          products(first: 100, query: $query) {
            edges {
              node {
                id
                title
                handle
                status
                totalInventory
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                      inventoryQuantity
                    }
                  }
                }
                featuredImage {
                  url
                  altText
                }
              }
            }
          }
        }
      `;

      if (categoryId) {
        graphqlQuery = `
          #graphql
          query getProductsByCollection($id: ID!, $query: String!) {
            collection(id: $id) {
              products(first: 100, query: $query) {
                edges {
                  node {
                    id
                    title
                    handle
                    status
                    totalInventory
                    variants(first: 10) {
                      edges {
                        node {
                          id
                          title
                          price
                          inventoryQuantity
                        }
                      }
                    }
                    featuredImage {
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
        `;
      }

      const variables = categoryId 
        ? { id: categoryId, query: query || "status:active" } 
        : { query: query || "status:active" };

      console.log('🔥 Fetching products for shop:', session.shop, 'with query:', variables.query);

      // Add timeout protection
      const graphqlPromise = admin.graphql(graphqlQuery, { variables });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Products request timed out')), 10000)
      );

      const response = await Promise.race([graphqlPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        console.error('🔥 Products GraphQL request failed:', response.status);
        return json({ 
          success: false, 
          error: 'Failed to fetch products from Shopify',
          products: []
        }, { status: 500 });
      }

      const responseJson = await response.json();
      
      if ((responseJson as any).errors) {
        console.error('🔥 Products GraphQL errors:', (responseJson as any).errors);
        return json({ 
          success: false, 
          error: 'GraphQL query failed',
          products: []
        }, { status: 500 });
      }

      let products = [];
      if (categoryId) {
        products = responseJson.data?.collection?.products?.edges || [];
      } else {
        products = responseJson.data?.products?.edges || [];
      }
      
      console.log(`🔥 Successfully fetched ${products.length} products`);

      return json({
        success: true,
        products: products.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          status: edge.node.status,
          totalInventory: edge.node.totalInventory,
          variants: edge.node.variants.edges.map((v: any) => ({
            id: v.node.id,
            title: v.node.title,
            price: parseFloat(v.node.price),
            inventoryQuantity: v.node.inventoryQuantity
          })),
          price: edge.node.variants.edges[0]?.node?.price || "0.00",
          image: edge.node.featuredImage?.url
        }))
      });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("🔥 Bundle management loader error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to load data";
    return json({ 
      success: false, 
      error: errorMessage,
      products: action === "products" ? [] : undefined,
      categories: action === "categories" ? [] : undefined
    }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('[Bundle API Action] Request received');
  
  let session;
  try {
    const auth = await authenticate.admin(request);
    session = auth.session;
    console.log('[Bundle API Action] Authenticated shop:', session.shop);
  } catch (authError) {
    console.error('[Bundle API Action] Authentication failed:', authError);
    return json({ success: false, error: 'Authentication failed' }, { status: 401 });
  }

  // Support both JSON and FormData bodies
  let actionType: any;
  let body: any = {};
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = await request.json();
      actionType = body.action;
      console.log('[Bundle API Action] Action type:', actionType);
    } catch (e) {
      console.error('[Bundle API Action] JSON parse error:', e);
      return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }
  } else {
    const formData = await request.formData();
    actionType = formData.get('action');
    formData.forEach((v, k) => { (body as any)[k] = v; });
  }

  try {
    if (actionType === 'fix-bundle-ids') {
      // Fix existing bundles with gid:// prefixes
      const bundles = await prisma.bundle.findMany({
        where: {
          shop: session.shop,
          assignedProducts: { not: null }
        }
      });

      let updatedCount = 0;
      for (const bundle of bundles) {
        if (!bundle.assignedProducts) continue;

        const productIds = JSON.parse(bundle.assignedProducts);
        const hasPrefix = productIds.some((id: string) => id.startsWith('gid://'));
        
        if (hasPrefix) {
          const cleanedIds = productIds.map((id: string) => 
            id.replace('gid://shopify/Product/', '')
          );

          await prisma.bundle.update({
            where: { id: bundle.id },
            data: { assignedProducts: JSON.stringify(cleanedIds) }
          });
          updatedCount++;
        }
      }

      console.log(`[Bundle API] Fixed ${updatedCount} bundles`);
      return json({ success: true, updatedCount });
    }
    
    if (actionType === 'create-bundle') {
      const name = (body.name as string) || '';
      const description = (body.description as string) || '';
      const type = (body.type as string) || (body.bundleType as string);
      const discountType = (body.discountType as string) || 'percentage';
      const discountValue = parseFloat(String(body.discountValue));
      const collectionIds = (body.categoryIds as string) || (body.collectionIds as string);
      const productIds = (body.productIds as string);
      const minProducts = body.minProducts ? parseInt(String(body.minProducts)) : 2;
      
      // NEW FIELDS - Enhanced bundle features
      const assignedProducts = (body.assignedProducts as string) || null;
      const bundleStyle = (body.bundleStyle as string) || 'grid';
      const selectMinQty = body.selectMinQty ? parseInt(String(body.selectMinQty)) : null;
      const selectMaxQty = body.selectMaxQty ? parseInt(String(body.selectMaxQty)) : null;
      const tierConfig = (body.tierConfig as string) || null;
      const allowDeselect = body.allowDeselect !== undefined ? String(body.allowDeselect) === 'true' : true;
      const hideIfNoML = body.hideIfNoML !== undefined ? String(body.hideIfNoML) === 'true' : false;

      if (!name || !type || discountValue < 0) {
        return json({ success: false, error: "Invalid bundle data" }, { status: 400 });
      }

      // Create the bundle
  const bundle = await (prisma as any).bundle.create({
        data: {
          shop: session.shop,
          name,
          description,
          type,
          discountType,
          discountValue,
          collectionIds,
          productIds,
          minProducts,
          // NEW FIELDS
          assignedProducts,
          bundleStyle,
          selectMinQty,
          selectMaxQty,
          tierConfig,
          allowDeselect,
          hideIfNoML,
          status: 'active'  // Start as active so it shows immediately
        }
      });

      // Add products to bundle if provided
      if (productIds) {
        try {
          const productIdArray = JSON.parse(productIds);
          if (Array.isArray(productIdArray) && productIdArray.length > 0) {
            const bundleProducts = productIdArray.map((productId: string, index: number) => ({
              bundleId: bundle.id,
              productId,
              position: index,
              required: index === 0 // First product is required by default
            }));

            await (prisma as any).bundleProduct.createMany({
              data: bundleProducts
            });
          }
        } catch (e) {
          console.warn("Failed to parse product IDs:", e);
        }
      }

      return json({ success: true, bundle });
    }

    if (actionType === 'update-bundle') {
      const bundleId = (body.bundleId as string);
      const name = (body.name as string);
      const description = (body.description as string);
      const status = (body.status as string);
      const discountValue = parseFloat(String(body.discountValue));

  const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop: session.shop },
        data: {
          name,
          description,
          status,
          discountValue
        }
      });

      return json({ success: true, bundle });
    }

    if (actionType === 'delete-bundle') {
      const bundleId = (body.bundleId as string);

  await (prisma as any).bundle.delete({
        where: { id: bundleId, shop: session.shop }
      });

      return json({ success: true, message: "Bundle deleted successfully" });
    }

    if (actionType === 'toggle-status') {
      const bundleId = (body.bundleId as string);
      const status = (body.status as string);

  const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop: session.shop },
        data: { status }
      });

      return json({ success: true, bundle });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Bundle API Action] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to perform action";
    return json({ success: false, error: errorMessage }, { status: 500 });
  }
};