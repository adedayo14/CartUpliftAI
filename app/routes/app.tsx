import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";
import { SessionStatus } from "../components/SessionStatus";
import { AppBridgeInitializer } from "../components/AppBridgeInitializer";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Hard-code the API key to avoid hydration mismatch
  const apiKey = "ba2c932cf6717c8fb6207fcc8111fe70";
  const search = new URL(request.url).search; // keep host/shop/embedded on nav links
  
  return { apiKey, search };
};

export default function App() {
  const { apiKey, search } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey || "ba2c932cf6717c8fb6207fcc8111fe70"}>
      <AppBridgeInitializer apiKey={apiKey} />
      <SessionStatus />
      <NavMenu>
        <Link to={`/app${search}`} rel="home">
          Home
        </Link>
        <Link to={`/app/dashboard${search}`} rel="dashboard">
          Dashboard
        </Link>
        <Link to={`/app/settings${search}`} rel="settings">
          Settings
        </Link>
        <Link to={`/app/privacy${search}`} rel="privacy">
          Privacy Policy
        </Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  
  // Handle session-related errors more gracefully
  useEffect(() => {
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
      }
    }
  }, [error]);
  
  if (error && typeof error === 'object' && 'status' in error) {
    const responseError = error as { status: number; statusText?: string };
    
    if (responseError.status === 401) {
      return (
                <div>
          <h2>Cart Uplift App</h2>
          <p>Unable to load embedded app. You can access the dashboard directly:</p>
          <a href="/admin" target="_top">Open Dashboard</a>
        </div>
      );
    }
  }

  return boundary.error(error);
};

export const headers: HeadersFunction = (headersArgs) => {
  const headers = boundary.headers(headersArgs);
  
  // Allow embedding in Shopify admin via CSP (X-Frame-Options not used with modern browsers)
  headers.set("Content-Security-Policy", "frame-ancestors https://*.myshopify.com https://admin.shopify.com");
  
  return headers;
};
