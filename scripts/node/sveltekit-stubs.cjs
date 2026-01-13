/**
 * SvelteKit Runtime Stubs for Node.js
 *
 * Minimal stubs for SvelteKit runtime modules that services try to import.
 * These are not used in Node.js but are needed to prevent import errors.
 */

// $app/environment
exports.browser = false;
exports.building = false;
exports.dev = false;
exports.version = 'node-cli';

// $app/stores (empty stubs)
exports.page = { subscribe: () => () => {} };
exports.navigating = { subscribe: () => () => {} };
exports.updated = { subscribe: () => () => {} };

// $app/navigation (empty stubs)
exports.goto = () => Promise.resolve();
exports.invalidate = () => Promise.resolve();
exports.invalidateAll = () => Promise.resolve();
exports.preloadData = () => Promise.resolve();
exports.preloadCode = () => Promise.resolve();
exports.beforeNavigate = () => {};
exports.afterNavigate = () => {};
