// Branded support page (donation methods). Reachable at tkaflowarts.com/support
// — the single destination the printed guide's support-page QR points at, so
// payment methods can change without a reprint.
//
// NOT prerendered: Stripe Checkout redirects back here with ?donated=1 / ?canceled=1
// and the page reads page.url.searchParams to show the return banner. Prerendered
// pages have no request query string, so accessing searchParams at build time throws
// ("Cannot access url.searchParams on a page with prerendering enabled"). SSR stays
// on so it still renders server-side per request; the page is noindex regardless.
export const prerender = false;
export const ssr = true;
