import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { useEffect } from "react";
import { AppBridgeInitializer } from "../components/AppBridgeInitializer";
import { SessionStatus } from "../components/SessionStatus";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "ba2c932cf6717c8fb6207fcc8111fe70" };
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  useEffect(() => {
    // Ensure App Bridge is ready before rendering nav
    if (window.shopify?.environment) {
      console.log('✅ App Bridge ready, nav should be visible');
    }
  }, [apiKey]);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <AppBridgeInitializer apiKey={apiKey} />
      <SessionStatus />
      {/* Shopify App Design System: App Nav - wrapped in conditional to prevent premature render */}
      {apiKey && (
        <s-app-nav>
          <s-link href="/app" rel="home">Home</s-link>
          <s-link href="/admin/dashboard">Analytics</s-link>
          <s-link href="/app/settings">Settings</s-link>
          <s-link href="/admin/bundle-management-simple">Bundles</s-link>
          <s-link href="/app/ab-testing">A/B Testing</s-link>
        </s-app-nav>
      )}
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};