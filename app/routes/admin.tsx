import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";
import { SessionStatus } from "../components/SessionStatus";
import { AppBridgeInitializer } from "../components/AppBridgeInitializer";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Hard-code the API key to avoid hydration mismatch
  const apiKey = "ba2c932cf6717c8fb6207fcc8111fe70";
  
  return { apiKey };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey || "ba2c932cf6717c8fb6207fcc8111fe70"}>
      <AppBridgeInitializer apiKey={apiKey} />
      <SessionStatus />
      {/* Navigation now handled by parent app.tsx layout with s-app-nav */}
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  
  // Handle session-related errors more gracefully
  if (error && typeof error === 'object' && 'status' in error) {
    const responseError = error as { status: number; statusText?: string };
    
    if (responseError.status === 401) {
      // For embedded apps, use App Bridge for re-authentication
      if (typeof window !== 'undefined') {
        if (window.top !== window.self) {
          // In iframe - use App Bridge reauth
          window.parent.postMessage({ 
            message: 'Shopify.API.reauthorizeApplication' 
          }, '*');
        } else {
          // Not in iframe - redirect to auth
          window.location.href = '/auth';
        }
      }
      
      return (
        <div>
          <h3>Session Expired</h3>
          <p>Re-authenticating with Shopify...</p>
        </div>
      );
    }
  }

  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  const headers = boundary.headers(headersArgs);
  
  // Allow embedding in Shopify admin via CSP only
  headers.set("Content-Security-Policy", "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://*.shopify.com");
  
  return headers;
};
