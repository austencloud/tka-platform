import { sveltekit } from "@sveltejs/kit/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export default defineConfig({
  plugins: [sveltekit()],

  test: {
    environment: "jsdom",
    globals: true,

    setupFiles: ["./tests/setup/vitest-setup.ts"],

    include: [
      "tests/unit/**/*.{test,spec}.{js,ts}",
      "tests/integration/**/*.{test,spec}.{js,ts}",
      "tests/debug/**/*.{test,spec}.{js,ts}",
      "src/**/__tests__/**/*.{test,spec}.{js,ts}",
      "src/lib/features/assemble-lab/**/*.{test,spec}.{js,ts}",
      "src/lib/features/train/prop-tracking-lab/**/*.{test,spec}.{js,ts}",
    ],
    exclude: [
      "legacy_app/**/*",
      "**/node_modules/**/*",
      "tests/e2e/**/*",
      "tests/screenshots/**/*",
      // Emulator-dependent suites have their own configs (vitest.e2e.config.ts,
      // vitest.rules.config.ts) run via `npm run test:e2e` / `test:rules` with
      // Firebase emulators. They cannot pass in the default emulator-less run.
      "tests/integration/**/*",
      // Component tests run in the browser project (vitest.components.config.ts),
      // never under jsdom.
      "**/*.svelte.{test,spec}.{js,ts}",
    ],

    alias: {
      $lib: path.resolve(projectRoot, "src/lib"),
      "$app/environment": path.resolve(projectRoot, "tests/setup/stubs/app-environment.ts"),
      "$app/navigation": path.resolve(projectRoot, "tests/setup/stubs/app-navigation.ts"),
      "$app/stores": path.resolve(projectRoot, "tests/setup/stubs/app-stores.ts"),
      $shared: path.resolve(projectRoot, "src/lib/shared"),
    },

    // Vitest 4.0: poolOptions deprecated, use pool config directly
    pool: "forks",
    forks: {
      singleFork: true,
    },

    isolate: true,

    outputFile: {
      json: "./test-results/vitest-results.json",
    },
  },

  resolve: {
    conditions: ["browser"],
  },

});
