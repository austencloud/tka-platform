/**
 * Vite Plugin — Compile-Time Feature Gate
 *
 * Stubs .svelte component files from disabled features at resolve time,
 * preventing Rolldown from traversing their component subtrees.
 *
 * Only actual .svelte components are gated — .svelte.ts runes modules and
 * plain .ts files pass through because they're fast to compile (esbuild)
 * and may use named exports that a simple stub can't satisfy.
 */

import type { Plugin, ResolvedConfig } from "vite";
import { getDisabledFeatureModulePaths } from "./feature-flags";

const STUB_ID = "\0feature-gate-stub.js";
const STUB_EXPORT = "export default null;\n";

function normalize(p: string): string {
  return p.replace(/\\/g, "/");
}

export function featureGatePlugin(): Plugin {
  let isProductionBuild = false;
  let disabledModulePaths: string[] = [];

  return {
    name: "vite-plugin-feature-gate",
    enforce: "pre",

    configResolved(config: ResolvedConfig) {
      isProductionBuild = config.command === "build";
      if (!isProductionBuild) return;

      disabledModulePaths = getDisabledFeatureModulePaths();

      if (disabledModulePaths.length > 0) {
        console.log(
          `[feature-gate] Production build: gating ${disabledModulePaths.length} disabled feature module path(s).`
        );
      }
    },

    async resolveId(source, importer, options) {
      if (!isProductionBuild || !disabledModulePaths.length) return null;

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
      return null;
    },
  };
}
