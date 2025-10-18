import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, unauthenticated } from "../shopify.server";

/**
 * Admin API endpoint to fetch products for bundle creation
 * GET /admin/api/bundle-products?query=search
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('🔥 Bundle Products API: Request received');
  
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") || "";
    const shopParam = url.searchParams.get("shop");

    let adminClient: any;
    let shopDomain: string | undefined;

    if (shopParam) {
      console.log('🔥 Using unauthenticated admin client for shop param:', shopParam);
      const { admin } = await unauthenticated.admin(shopParam);
      adminClient = admin;
      shopDomain = shopParam;
    } else {
      const { admin, session } = await authenticate.admin(request);
      adminClient = admin;
      shopDomain = session.shop;
      console.log('🔥 Authenticated admin session for shop:', shopDomain);
    }

    const graphqlQuery = `
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

    // Race the GraphQL call against a timeout to prevent hanging UI
    const respPromise = (async () => {
      const resp = await adminClient.graphql(graphqlQuery, { 
        variables: { query: query || "status:active" } 
      });
      return resp;
    })();

    const timeoutMs = 12000; // 12s safety timeout
    const raced: any = await Promise.race([
      respPromise,
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), timeoutMs))
    ]);

    if (raced && raced.__timeout) {
      console.error(`⏳ GraphQL products request timed out after ${timeoutMs}ms for shop ${shopDomain}`);
      return json({ 
        success: false, 
        error: `Timed out loading products after ${Math.round(timeoutMs/1000)}s. Please Retry.`,
        products: []
      }, { status: 504, headers: { 'Cache-Control': 'no-store' } });
    }

    const response = raced as Response;
    if (!response.ok) {
      console.error('🔥 GraphQL request failed:', response.status);
      return json({ 
        success: false, 
        error: 'Failed to fetch products from Shopify',
        products: []
      }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const responseJson = await response.json();
    
    if ((responseJson as any).errors) {
      console.error('🔥 GraphQL errors:', (responseJson as any).errors);
      return json({ 
        success: false, 
        error: 'GraphQL query failed',
        products: []
  }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const products = responseJson.data?.products?.edges || [];
    
  console.log(`🔥 Successfully fetched ${products.length} products for ${shopDomain}`);

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
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error("🔥 Bundle products API error:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to load products",
      products: []
    }, { status: 500 });
  }
};
