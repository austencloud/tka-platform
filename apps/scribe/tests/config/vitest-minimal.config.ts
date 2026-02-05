/**
 * Minimal Vitest Config for Unit Tests
 *
 * Avoids complex setup dependencies like Inversify.
 * Use for pure logic tests that don't need DI or Firebase mocks.
 */

import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [sveltekit()],

  test: {
    environment: "jsdom",
    globals: true,

    // NO setup file - tests are self-contained
    // setupFiles: [],

    include: [
      "tests/unit/thumbnail/**/*.{test,spec}.{js,ts}",
    ],
    exclude: [
      "node_modules/**/*",
    ],

    alias: {
      $lib: new URL("../../src/lib", import.meta.url).pathname,
      $app: new URL("../../src/app", import.meta.url).pathname,
    },

    pool: "forks",
    forks: {
      singleFork: true,
    },
  },

  resolve: {
    conditions: ["browser"],
  },
});
