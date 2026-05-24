// @deprecated — all consumers use deep imports; remove when confirmed safe

/**
 * Sequence Engine - Wrapper
 *
 * Re-exports platform-agnostic types and implementations from @tka/sequence-engine.
 * Also exports browser-only extensions (BrowserDataProvider, constraints) that
 * stay in the app because they have SvelteKit dependencies.
 */

// Platform-agnostic exports from package
export * from "@tka/sequence-engine";

// Browser data provider (only for browser contexts)
export {
  BrowserDataProvider,
  createBrowserDataProvider,
} from "./data/implementations/BrowserDataProvider";

// Constraints (re-export from constraints submodule)
export * from "./constraints";
