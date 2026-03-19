// The root +layout.ts sets ssr=false, but the @ reset escapes it.
// Re-declare here so the viewer route doesn't attempt SSR
// (the DI container and browser APIs don't work server-side).
export const ssr = false;
export const prerender = false;
