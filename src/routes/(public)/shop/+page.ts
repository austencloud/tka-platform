// SSR renders the head + ComingSoon shell (both static-safe) so crawlers and
// unfurl bots get real HTML. The admin gate + StorePage stay client-only:
// the gate runs in onMount and StorePage loads via browser-gated dynamic
// import, so no auth/Firestore code enters the SSR module graph.
export const prerender = false;
export const ssr = true;
