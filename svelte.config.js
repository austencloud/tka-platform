import adapter from "@sveltejs/adapter-netlify";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // ============================================================================
  // PREPROCESSING (Vite handles TypeScript, styles, etc.)
  // ============================================================================
  // 2026: Enable script preprocessing for TypeScript features that emit code
  // (enums, decorators, class visibility modifiers, etc.)
  preprocess: vitePreprocess({ script: true }),

  kit: {
    // ============================================================================
    // ADAPTER (Netlify with serverless functions for API routes)
    // ============================================================================
    // Using adapter-netlify to enable server-side API routes (+server.ts files).
    // Pages are still client-rendered (SSR disabled in +layout.ts) but API
    // endpoints like /api/tika/* are deployed as Netlify Functions.
    adapter: adapter({
      // Use Node.js serverless functions (not edge)
      edge: false,
      // Single function handles all server routes (simpler deployment)
      split: false,
    }),

    // ============================================================================
    // PATH ALIASES (Clean domain-bounded architecture)
    // ============================================================================
    alias: {
      // Core aliases
      $lib: "./src/lib",
      "$lib/*": "./src/lib/*",
    },

    // ============================================================================
    // 2026: SECURITY & PERFORMANCE
    // ============================================================================
    // CSRF protection with origin checking is enabled by default
    // Use csrf.trustedOrigins to whitelist additional origins if needed

    // 2026: Preload critical modules for better performance
    prerender: {
      // Configure if you want static prerendering
      crawl: true,
    },
  },

  // ============================================================================
  // SVELTE 5 COMPILER OPTIONS
  // ============================================================================
  compilerOptions: {
    // Svelte 5 runes mode is enabled by default
    // 2026: Runes provide better reactivity and performance
  },

  // ============================================================================
  // WARNING FILTER (Suppress intentional patterns)
  // ============================================================================
  // These warnings are for patterns we use intentionally:
  // - state_referenced_locally: Capturing initial prop values for one-time init
  onwarn: (warning, handler) => {
    // Intentional pattern: initializing state/const from props for one-time capture
    if (warning.code === "state_referenced_locally") return;

    // Let all other warnings through
    handler(warning);
  },
};

export default config;
