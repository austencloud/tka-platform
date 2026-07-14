// The <svelte:head> (title/desc/canonical/OG/Product schema) + a crawlable SEO
// shell render server-side so bots get real HTML. The trilogy widget renders
// real printed card fronts via the browser-only print pipeline (canvas + workers
// + firebase), so it mounts behind {#if browser} + a dynamic import — no
// browser-only code enters the SSR graph. Same pattern as /shop.
export const ssr = true;
export const prerender = false;
