// Disable SSR to avoid Type1 module loading issues during server-side rendering
// The InversifyJS container and Type1 generators have dependencies that don't work well with SSR
export const ssr = false;
export const prerender = false;
