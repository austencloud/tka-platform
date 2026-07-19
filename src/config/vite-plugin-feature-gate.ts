/**
 * Vite Plugin — Compile-Time Feature Gate
 *
 * Stubs .svelte component files from disabled features at resolve time,
 * preventing Rolldown from traversing their component subtrees.
 *
 * Only actual .svelte components are gated — .svelte.ts runes modules and
 * plain .ts files pass through because they're fast to compile (esbuild)
 * and may use named exports that a simple stub can't satisfy.
 *
 * The SSR build additionally stubs a small list of browser-only npm packages
 * (getSsrStubbedPackages) whose dynamic-import edges would otherwise be
 * inlined into the 25 MiB-capped _worker.js by wrangler.
 */

import type { Plugin, ResolvedConfig } from "vite";
import {
  getDisabledFeatureModulePaths,
  getSsrEmptiedRoutePaths,
  getSsrStubbedModulePaths,
  getSsrStubbedPackages,
} from "./feature-flags";

const STUB_ID = "\0feature-gate-stub.js";
const STUB_EXPORT = "export default null;\n";

function normalize(p: string): string {
  return p.replace(/\\/g, "/");
}

export function featureGatePlugin(): Plugin {
  let isProductionBuild = false;
  let disabledModulePaths: string[] = [];
  let stubbedPackages: string[] = [];
  let emptiedRoutePaths: string[] = [];

  return {
    name: "vite-plugin-feature-gate",
    enforce: "pre",

    configResolved(config: ResolvedConfig) {
      isProductionBuild = config.command === "build";
      if (!isProductionBuild) return;

      // The SSR/server build (Cloudflare Pages Functions, 25 MiB cap) never
      // renders feature modules — the app shell is CSR-only — so stub every
      // non-core module there. The client build only stubs genuinely-disabled
      // (dev-tier) features so all shipped modules reach users.
      const isSsrBuild = config.build?.ssr === true;
      disabledModulePaths = isSsrBuild
        ? getSsrStubbedModulePaths()
        : getDisabledFeatureModulePaths();
      stubbedPackages = isSsrBuild ? getSsrStubbedPackages() : [];
      emptiedRoutePaths = isSsrBuild ? getSsrEmptiedRoutePaths() : [];

      if (disabledModulePaths.length > 0) {
        console.log(
          `[feature-gate] Production ${isSsrBuild ? "SSR" : "client"} build: gating ${disabledModulePaths.length} module path(s).`
        );
      }
    },

    async resolveId(source, importer, options) {
      if (!isProductionBuild) return null;

      // Browser-only npm packages (SSR build only): sever the dynamic-import
      // edge so wrangler doesn't inline the package into _worker.js.
      if (stubbedPackages.includes(source)) {
        return STUB_ID;
      }

      if (!disabledModulePaths.length) return null;

      const normalizedSource = normalize(source);
      if (!normalizedSource.endsWith(".svelte")) return null;

      let matched = false;
      for (const prefix of disabledModulePaths) {
        if (normalizedSource.includes(prefix)) {
          matched = true;
          break;
        }
      }
      if (!matched) return null;

      // Resolve through other plugins to get the actual file path.
      // This distinguishes .svelte components from .svelte.ts runes modules
      // (both use ".svelte" in import paths but only components should be stubbed).
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });

      if (!resolved) return null;

      const resolvedPath = normalize(resolved.id);
      if (resolvedPath.endsWith(".svelte")) {
        return STUB_ID;
      }

      return null;
    },

    load(id: string) {
      if (id === STUB_ID) {
        return STUB_EXPORT;
      }

      // SSR build: empty ssr=false route components instead of resolve-stubbing
      // them — SvelteKit's build_server_nodes requires every route component to
      // stay in the Vite manifest under its real filename. An empty string is a
      // valid Svelte component with no import graph.
      if (emptiedRoutePaths.length) {
        const bare = normalize(id).split("?")[0]!;
        if (
          bare.endsWith(".svelte") &&
          emptiedRoutePaths.some((prefix) => bare.includes(prefix))
        ) {
          return "";
        }
      }

      return null;
    },
  };
}
