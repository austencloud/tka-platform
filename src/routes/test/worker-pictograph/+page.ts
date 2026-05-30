// Client-only test route — it spins up a Web Worker and touches browser-only
// render singletons; SSR would crash on `self`/`window` at import.
export const ssr = false;
export const prerender = false;
