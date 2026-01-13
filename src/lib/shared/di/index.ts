/**
 * DI Container - Dynamic Loader
 *
 * This file provides the DI container interface for both browser and Node.js contexts.
 * - Browser: Dynamically imports the full browser-container.ts
 * - Node.js: Provides stub that throws helpful errors
 *
 * Import services via: container.items.serviceName
 */

// Create stub for Node.js
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

// Conditional container creation with single export
let containerInstance: any;

if (typeof window === 'undefined') {
  // Node.js: Use stub
  console.warn('[DI] Node.js detected - DI container stubbed out');
  console.warn('[DI] Use manual dependency wiring for CLI scripts');
  containerInstance = stubContainer;
} else {
  // Browser: Dynamically import browser container using top-level await
  // This prevents Node.js from ever parsing browser-container.ts
  const browserContainerModule = await import('./browser-container');
  containerInstance = browserContainerModule.container;
}

// Single export point (works in both environments)
export const container = containerInstance;
export type AppContainer = typeof container;
export default container;
