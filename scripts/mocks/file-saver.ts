/**
 * Mock for file-saver (handles CommonJS/ESM interop)
 * Provides stub implementation for Node.js CLI context
 */

// Stub saveAs function for Node.js
export const saveAs = (blob: Blob, filename: string): void => {
  // No-op in Node.js CLI - we're saving files differently
};

export default { saveAs };
