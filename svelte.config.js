import adapter from "@sveltejs/adapter-static";
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
    // ADAPTER (Static SPA for Netlify - no SSR needed)
    // ============================================================================
    // Using adapter-static with fallback for true SPA mode.
    // This generates a 200.html fallback page that handles all client-side routes.
    // SSR is disabled in +layout.ts due to InversifyJS compatibility issues.
    adapter: adapter({
      // Generate 200.html fallback for SPA routing (Netlify uses this for client-side routes)
      fallback: "200.html",
      // Output to build directory (Netlify default)
      pages: "build",
      assets: "build",
      // Don't require all routes to be prerendered (we're an SPA)
      strict: false,
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
