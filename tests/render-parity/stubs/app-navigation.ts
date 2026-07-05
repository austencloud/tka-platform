// $app/navigation stub for the render-parity project. Superset of the shared
// tests/setup/stubs stub — the render pipeline's import graph reaches modules
// (scan-attribution, module-state) that also import `replaceState`/`pushState`.
export const goto = () => Promise.resolve();
export const invalidate = () => Promise.resolve();
export const invalidateAll = () => Promise.resolve();
export const prefetchRoutes = () => Promise.resolve();
export const beforeNavigate = () => {};
export const afterNavigate = () => {};
export const onNavigate = () => {};
export const pushState = () => {};
export const replaceState = () => {};
export const disableScrollHandling = () => {};
export const preloadData = () =>
  Promise.resolve({ type: "loaded" as const, status: 200, data: {} });
export const preloadCode = () => Promise.resolve();
