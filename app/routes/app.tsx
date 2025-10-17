import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";
import { AppBridgeInitializer } from "../components/AppBridgeInitializer";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return { 
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <AppBridgeInitializer apiKey={apiKey} />
      <NavMenu>
        <a href="/app" rel="home">Home</a>
        <a href="/admin/dashboard">Analytics</a>
        <a href="/app/settings">Settings</a>
        <a href="https://support.yoursite.com" target="_blank" rel="noopener noreferrer">
          Help & Support
        </a>
      </NavMenu>
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
