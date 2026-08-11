// This route resets to the root layout (`+layout@.svelte`), which takes it out
// from under `src/routes/test/+layout.ts` — so it does not inherit that file's
// `ssr = false`. Without this the grotto is server-rendered on every load: a
// full SSR pass through the dev process for a page whose entire content is a
// WebGL canvas that only exists client-side.
export const ssr = false;
export const prerender = false;
