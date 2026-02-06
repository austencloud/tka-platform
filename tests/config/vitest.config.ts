import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

// ============================================================================
// VITEST 4.0 CONFIGURATION (2025 - Optimized for SvelteKit)
// ============================================================================

export default defineConfig({
  plugins: [sveltekit()],

  test: {
    // ============================================================================
    // ENVIRONMENT
    // ============================================================================
    environment: "jsdom",
    globals: true,

    // ============================================================================
    // SETUP
    // ============================================================================
    setupFiles: ["./tests/setup/vitest-setup.ts"],

    // ============================================================================
    // TEST FILES
    // ============================================================================
    include: [
      "tests/unit/**/*.{test,spec}.{js,ts}",
      "tests/integration/**/*.{test,spec}.{js,ts}",
      "tests/debug/**/*.{test,spec}.{js,ts}",
    ],
    exclude: [
      "legacy_app/**/*",
      "node_modules/**/*",
      "tests/e2e/**/*", // E2E tests run with Playwright
    ],

    // ============================================================================
    // PATH ALIASES (Match SvelteKit aliases)
    // ============================================================================
    alias: {
      $lib: new URL("./src/lib", import.meta.url).pathname,
      $app: new URL("./src/app", import.meta.url).pathname,
      $shared: new URL("./src/lib/shared", import.meta.url).pathname,
    },

    // ============================================================================
    // PERFORMANCE (Vitest 4.0 - 2025 best practices)
    // ============================================================================
    // Vitest 4.0: poolOptions deprecated, use pool config directly
    pool: "forks", // Better isolation
    forks: {
      singleFork: true, // Faster for smaller test suites
    },

    // Improved test isolation
    isolate: true, // Default, but explicit for clarity

    // Coverage configuration (if needed)
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'html'],
    //   exclude: ['tests/**', '**/*.config.*'],
    // },

    // Better error output
    outputFile: {
      json: "./test-results/vitest-results.json",
    },
  },

  // ============================================================================
  // RESOLVE (Browser conditions for SvelteKit)
  // ============================================================================
  resolve: {
    conditions: ["browser"],
  },

  // ============================================================================
  // DEPENDENCY OPTIMIZATION (Fix inversify resolution)
  // ============================================================================
  optimizeDeps: {
    include: ["inversify", "reflect-metadata"],
  },

  // ============================================================================
  // SSR (Prevent inversify CJS issues)
  // ============================================================================
  ssr: {
    noExternal: ["inversify", "reflect-metadata"],
  },
});
