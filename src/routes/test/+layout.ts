// /test/* are dev-only scratch harnesses (53 routes) — no SEO, no server load.
// Inheriting the root ssr=true means every navigation triggers a full SvelteKit
// SSR render in the dev process; when several agents are pegging CPU with
// check/build, that render queues behind them and the document hangs blank on
// "Loading..." forever. ssr=false returns the shell instantly and renders
// client-side instead. Verified: no /test route has a +page.server.* load.
export const ssr = false;
export const prerender = false;
