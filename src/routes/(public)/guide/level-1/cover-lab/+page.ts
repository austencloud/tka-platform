// Browser-only work (mandala render, catalog load) is guarded in onMount.
// Match the print route (SSR-on, no prerender) so the (public) layout reset
// resolves correctly.
export const prerender = false;
