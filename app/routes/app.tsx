import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
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

  // Manual App Bridge navigation setup
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).shopify) {
      const app = (window as any).shopify.app;
      
      console.log('🔍 Setting up navigation...');
      console.log('- API Key:', apiKey ? 'Present' : 'Missing');
      console.log('- App Bridge:', app ? 'Loaded' : 'Not loaded');
      
      // Create navigation menu programmatically
      if (app) {
        try {
          app.dispatch({
            type: 'Navigation/Update',
            payload: {
              items: [
                {
                  id: 'home',
                  label: 'Home',
                  destination: '/app',
                },
                {
                  id: 'analytics',
                  label: 'Analytics',
                  destination: '/admin/dashboard',
                },
                {
                  id: 'settings',
                  label: 'Settings',
                  destination: '/app/settings',
                },
              ],
            },
          });
          console.log('✅ Navigation configured successfully');
        } catch (error) {
          console.error('❌ Navigation setup failed:', error);
        }
      } else {
        console.warn('⚠️ App Bridge not available yet, retrying...');
        // Retry after a short delay
        setTimeout(() => {
          if ((window as any).shopify?.app) {
            try {
              (window as any).shopify.app.dispatch({
                type: 'Navigation/Update',
                payload: {
                  items: [
                    { id: 'home', label: 'Home', destination: '/app' },
                    { id: 'analytics', label: 'Analytics', destination: '/admin/dashboard' },
                    { id: 'settings', label: 'Settings', destination: '/app/settings' },
                  ],
                },
              });
              console.log('✅ Navigation configured (delayed)');
            } catch (error) {
              console.error('❌ Delayed navigation setup failed:', error);
            }
          }
        }, 1000);
      }
    }
  }, [apiKey]);

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