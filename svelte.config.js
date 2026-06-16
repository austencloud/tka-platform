import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess({ script: true }),

  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: [
          '/_app/immutable/*',
          '/_app/version.json',
          '/.well-known/*',
          '/animations/*',
          '/assets/*',
          '/audio/*',
          '/branding/*',
          '/data/*',
          '/fonts/*',
          '/gallery/*',
          '/guide/*',
          '/guides/*',
          '/images/*',
          '/models/*',
          '/pictographs/*',
          '/pwa/*',
          '/retro-eras/*',
          '/screenshots/*',
          '/sounds/*',
          '/textures/*',
          '/thumbnails/*',
          '/favicon.png',
          '/firebase-messaging-handler.js',
          '/firebase-messaging-sw.js',
          '/legacy-sw.js',
          '/manifest.webmanifest',
          '/og-default.png',
          '/robots.txt',
          '/sitemap.xml',
          '/sw.js',
        ]
      }
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
      handleHttpError: ({ path, message, status }) => {
        // PWA splash screens and icons may not exist yet
        if (path.startsWith("/pwa/")) return;
        // SPA routes hit during crawl return 500 because they need client-side JS —
        // the adapter-static fallback handles them at runtime
        if (status === 500) return;
        throw new Error(message);
      },
      handleMissingId: ({ path, id }) => {
        // Guide nav renders section anchor links for the active chapter,
        // but placeholder pages don't have those section elements yet
        if (path.startsWith("/guide/level-1/")) return;
        throw new Error(`Missing id "#${id}" on ${path}`);
      },
    },
  },

  // ============================================================================
  // SVELTE 5 COMPILER OPTIONS
  // ============================================================================
  compilerOptions: {
    warningFilter: (warning) => {
      if (warning.code === "state_referenced_locally") return false;
      return true;
    },
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
