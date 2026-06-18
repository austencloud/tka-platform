import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/auth-upgrade/**/*.e2e.test.ts"],

    // The functions under test import `$lib/...` paths. Mirror the alias from
    // tests/config/vitest.config.ts so those imports resolve to src/lib.
    alias: {
      $lib: path.resolve(projectRoot, "src/lib"),
      $shared: path.resolve(projectRoot, "src/lib/shared"),
    },

    // Vitest 4: poolOptions removed; forks config is top-level.
    pool: "forks",
    forks: { singleFork: true },
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
