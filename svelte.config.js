import netlifyAdapter from "@sveltejs/adapter-netlify";
import staticAdapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Cloudflare Pages sets CF_PAGES=1 during builds.
// Use adapter-static for Cloudflare (landing page is a pure SPA).
// Use adapter-netlify for Netlify (app needs serverless API routes).
const isCloudflare = process.env.CF_PAGES === "1";

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
    // ADAPTER (conditional: Cloudflare Pages vs Netlify)
    // ============================================================================
    // Cloudflare Pages: adapter-static with SPA fallback (tkaflowarts.com landing)
    // Netlify: adapter-netlify with serverless functions (tkascribe.com app + API)
    adapter: isCloudflare
      ? staticAdapter({
          fallback: "200.html",
          strict: false,
        })
      : netlifyAdapter({
          edge: false,
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
  // onwarn suppresses state_referenced_locally during builds (Vite plugin).
  // For svelte-check, these are either fixed with $derived/$effect or are
  // genuinely intentional one-time prop captures (let x = $state(initialProp)).
  onwarn: (warning, handler) => {
    if (warning.code === "state_referenced_locally") return;
    handler(warning);
  },
};

export default config;
