import { sveltekit } from "@sveltejs/kit/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

/**
 * Diagnostics harnesses: runs that PRODUCE an artifact rather than assert one.
 *
 * They sit outside the default `include` globs so a CI run never rewrites a
 * committed report, and this config is written out rather than merged into
 * `vitest.config.ts` because `mergeConfig` CONCATENATES `include`, which would
 * drag the whole unit suite along behind the harness. Run one explicitly:
 *
 *   npx vitest run --config tests/config/vitest.diagnostics.config.ts
 */
export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup/vitest-setup.ts"],
    include: ["tests/tools/**/*.{test,spec}.{js,ts}"],
    exclude: ["**/node_modules/**/*"],

    alias: {
      $lib: path.resolve(projectRoot, "src/lib"),
      "$app/environment": path.resolve(
        projectRoot,
        "tests/setup/stubs/app-environment.ts"
      ),
      "$app/navigation": path.resolve(
        projectRoot,
        "tests/setup/stubs/app-navigation.ts"
      ),
      "$app/state": path.resolve(projectRoot, "tests/setup/stubs/app-state.ts"),
      "$app/stores": path.resolve(
        projectRoot,
        "tests/setup/stubs/app-stores.ts"
      ),
      $shared: path.resolve(projectRoot, "src/lib/shared"),
    },

    pool: "forks",
    forks: { singleFork: true },
    testTimeout: 300_000,
    isolate: true,
  },

  resolve: {
    conditions: ["browser"],
  },
});
