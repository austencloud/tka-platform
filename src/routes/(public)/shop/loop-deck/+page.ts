// The <svelte:head> (title/desc/canonical/OG/Product schema) + a crawlable SEO
// shell render server-side so bots get real HTML. The configurator itself is
// browser-only (real ChoreoCards via the canvas + firebase thumbnail
// orchestrator), so it mounts behind {#if browser} + a dynamic import — no
// browser-only code enters the SSR graph. Same pattern as /shop.
export const ssr = true;
export const prerender = false;
