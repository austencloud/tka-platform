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
  getClientEmptiedRoutePaths,
  getDisabledFeatureModulePaths,
  getSsrEmptiedRoutePaths,
  getSsrRenderedFeatureComponentPaths,
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
  let ssrRenderedComponentPaths: string[] = [];
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
      ssrRenderedComponentPaths = isSsrBuild
        ? getSsrRenderedFeatureComponentPaths()
        : [];
      stubbedPackages = isSsrBuild ? getSsrStubbedPackages() : [];
      emptiedRoutePaths = isSsrBuild
        ? getSsrEmptiedRoutePaths()
        : getClientEmptiedRoutePaths();

      if (disabledModulePaths.length > 0 || emptiedRoutePaths.length > 0) {
        console.log(
          `[feature-gate] Production ${isSsrBuild ? "SSR" : "client"} build: gating ${disabledModulePaths.length} module path(s) and emptying ${emptiedRoutePaths.length} route path(s).`
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

      // Public SSR shells stay real even when their feature directory is
      // broadly stubbed. Imports beneath the shell are resolved independently
      // and still hit the normal gate, preserving the server bundle boundary.
      if (
        ssrRenderedComponentPaths.some((path) =>
          normalizedSource.includes(path)
        )
      ) {
        return null;
      }

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

      // Keep disabled route files in SvelteKit's manifest, but remove their
      // implementation graph. Their load guards still run and redirect users;
      // the page components and everything they import do not reach the client.
      // SSR uses the same technique for selected ssr=false routes because
      // build_server_nodes also requires their real filenames in its manifest.
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
