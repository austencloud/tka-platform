import { defineConfig } from "vitest/config";

// This package owns its own runner. The root config (tests/config/vitest.config.ts)
// is jsdom-based and excludes tests/integration/** outright, so tests written
// against it would silently never execute — that was audit finding 5.
export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		// These two predate this config and are written against node:test
		// (`import { describe, it } from "node:test"`), so vitest finds no suite
		// in them. They are referenced by no CI job or script — run them with
		// `npx tsx --test tests/<file>` until someone gives them a home.
		exclude: [
			"**/node_modules/**",
			"tests/rendering-boundaries.test.ts",
			"tests/engine-generation-adapter-constraints.test.ts",
		],
		testTimeout: 15_000,
	},
});
