import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { NavigationMenu } from "@shopify/app-bridge/actions";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { useEffect } from "react";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "ba2c932cf6717c8fb6207fcc8111fe70" };
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();
  const app = useAppBridge() as any;

  // Manual App Bridge navigation setup
  useEffect(() => {
    console.log('🔍 Setting up navigation with useAppBridge...');
    console.log('- API Key:', apiKey ? 'Present' : 'Missing');
    console.log('- App Bridge hook:', app ? 'Available' : 'Not available');

    if (!app) return;

    try {
      const items = [
        { label: 'Home', destination: '/app' },
        { label: 'Analytics', destination: '/admin/dashboard' },
        { label: 'Settings', destination: '/app/settings' },
      ];

      // Some type defs expect AppLink instances; cast config to any for runtime success
      const nav = (NavigationMenu as any).create(app, { items } as any);
      if (nav && nav.subscribe) {
        nav.subscribe((NavigationMenu as any).Action.UPDATE, () => {
          console.log('✅ Navigation menu updated');
        });
      }
      console.log('✅ Navigation configured via actions');
    } catch (err) {
      console.error('❌ Navigation configuration failed:', err);
    }
  }, [apiKey, app]);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
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