/**
 * DI Container - Browser Only
 *
 * This file provides the DI container for browser contexts.
 * Server-side code (API routes, CLI scripts) should use manual dependency wiring.
 *
 * Import services via: container.items.serviceName
 */

// Re-export browser container directly
// Vite/SvelteKit handles browser/server code splitting
export { container, type AppContainer } from './browser-container';
export { container as default } from './browser-container';
