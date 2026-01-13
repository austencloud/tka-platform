/**
 * Mock for $app/navigation (SvelteKit virtual module)
 * Provides stub implementations for Node.js CLI context
 */

export const goto = async (url: string | URL, opts?: any): Promise<void> => {
  // No-op in Node.js
};

export const invalidate = async (url: string | URL): Promise<void> => {
  // No-op in Node.js
};

export const invalidateAll = async (): Promise<void> => {
  // No-op in Node.js
};

export const preloadData = async (url: string | URL): Promise<void> => {
  // No-op in Node.js
};

export const preloadCode = async (...urls: string[]): Promise<void> => {
  // No-op in Node.js
};

export const beforeNavigate = (fn: (navigation: any) => void): void => {
  // No-op in Node.js
};

export const afterNavigate = (fn: (navigation: any) => void): void => {
  // No-op in Node.js
};

export const disableScrollHandling = (): void => {
  // No-op in Node.js
};

export const pushState = (url: string | URL, state: any): void => {
  // No-op in Node.js
};

export const replaceState = (url: string | URL, state: any): void => {
  // No-op in Node.js
};
