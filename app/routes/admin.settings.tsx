import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

// Redirect /admin/settings to /app/settings with preserved query params
export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const search = url.search;
  return redirect(`/app/settings${search}`);
};
