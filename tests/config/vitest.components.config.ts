import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export default defineConfig({
  plugins: [svelte()],

  // axe-core is CJS; pre-bundle it so Vite doesn't re-optimize mid-run.
  // A cold-start re-optimization reload can flake the first a11y test (esp. in CI).
  optimizeDeps: { include: ["axe-core"] },

  resolve: {
    conditions: ["browser"],
    alias: {
      $lib: path.resolve(projectRoot, "src/lib"),
      $shared: path.resolve(projectRoot, "src/lib/shared"),
      "$test-helpers": path.resolve(projectRoot, "tests/helpers"),
      "$app/environment": path.resolve(projectRoot, "tests/setup/stubs/app-environment.ts"),
      "$app/navigation": path.resolve(projectRoot, "tests/setup/stubs/app-navigation.ts"),
      "$app/state": path.resolve(projectRoot, "tests/setup/stubs/app-state.ts"),
      "$app/stores": path.resolve(projectRoot, "tests/setup/stubs/app-stores.ts"),
    },
  },

  test: {
    name: "components",
    include: ["src/**/*.svelte.{test,spec}.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [{ browser: "chromium" }],
    },
  },
});
