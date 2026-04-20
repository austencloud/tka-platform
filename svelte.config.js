import staticAdapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess({ script: true }),

  kit: {
    adapter: staticAdapter({
      fallback: "index.html",
    }),

    // ============================================================================
    // PATH ALIASES (Clean domain-bounded architecture)
    // ============================================================================
    alias: {
      // Core aliases
      $lib: "./src/lib",
      "$lib/*": "./src/lib/*",
      // Guide editor library utilities. Aliased because TypeScript's bundler
      // module resolution mishandles parens in paths like "(public)" when
      // imported across the src/lib <-> src/routes boundary.
      "$guide-level-1": "./src/routes/(public)/guide/level-1",
      "$guide-level-1/*": "./src/routes/(public)/guide/level-1/*",
    },

    // ============================================================================
    // POSTHOG SESSION REPLAY FIX
    // ============================================================================
    // PostHog session replay requires absolute paths to properly record assets.
    // By default, Svelte uses relative paths during SSR which breaks replay.
    paths: {
      relative: false,
    },

    // ============================================================================
    // 2026: SECURITY & PERFORMANCE
    // ============================================================================
    // CSRF protection with origin checking is enabled by default
    // Use csrf.trustedOrigins to whitelist additional origins if needed

    // 2026: Preload critical modules for better performance
    prerender: {
      crawl: true,
      handleHttpError: ({ path, message }) => {
        // PWA splash screens and icons may not exist yet — ignore 404s for static assets
        if (path.startsWith("/pwa/")) return;
        throw new Error(message);
      },
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
  // onwarn suppresses state_referenced_locally during builds (Vite plugin).
  // For svelte-check, these are either fixed with $derived/$effect or are
  // genuinely intentional one-time prop captures (let x = $state(initialProp)).
  onwarn: (warning, handler) => {
    if (warning.code === "state_referenced_locally") return;
    handler(warning);
  },
};

export default config;
