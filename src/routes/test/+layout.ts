import { dev } from "$app/environment";
import { redirect } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";

// /test/* are dev-only scratch harnesses with no SEO or server load.
// Inheriting the root ssr=true means every navigation triggers a full SvelteKit
// SSR render in the dev process; when several agents are pegging CPU with
// check/build, that render queues behind them and the document hangs blank on
// "Loading..." forever. ssr=false returns the shell instantly and renders
// client-side instead. Verified: no /test route has a +page.server.* load.
export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = () => {
  if (!dev) redirect(307, "/browse/gallery");
  return {};
};
