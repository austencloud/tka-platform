/**
 * DI Container - Dynamic Loader
 *
 * This file provides the DI container interface for both browser and Node.js contexts.
 * - Browser: Dynamically imports the full browser-container.ts
 * - Node.js: Provides stub that throws helpful errors
 *
 * Import services via: container.items.serviceName
 */

// ============================================================================
// NODE.JS STUB
// ============================================================================

if (typeof window === 'undefined') {
  // Node.js: Export stub container that throws helpful errors
  console.warn('[DI] Node.js detected - DI container stubbed out');
  console.warn('[DI] Use manual dependency wiring for CLI scripts');

  const stubContainer = {
    items: new Proxy({}, {
      get: (_target, prop) => {
        throw new Error(
          `Cannot access DI container service '${String(prop)}' in Node.js context. ` +
          `Use manual dependency wiring (see scripts/node/create-node-pictograph-preparer.ts for example).`
        );
      }
    })
  };

  export const container = stubContainer as any;
  export type AppContainer = typeof container;
  export default container;

} else {
  // Browser: Use top-level await to dynamically import browser container
  // This prevents Node.js from ever trying to parse browser-container.ts
  const browserContainerModule = await import('./browser-container');

  export const container = browserContainerModule.container;
  export type AppContainer = browserContainerModule.AppContainer;
  export default container;
}
