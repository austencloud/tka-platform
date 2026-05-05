/**
 * Vite Plugin — Compile-Time Feature Gate
 *
 * Intercepts `resolveId` calls for disabled feature modules and returns a stub
 * module instead. Only active during production builds.
 *
 * Two interception strategies:
 *   1. Module path — if the import source (normalized) contains a disabled
 *      feature's path prefix, the module is replaced with a null stub.
 *   2. Route pattern — if the IMPORTER's path matches a disabled route pattern,
 *      the import is also replaced with a null stub.
 *
 * Virtual module IDs:
 *   "\0feature-gate-stub"         → TS/JS stubs  (export default null)
 *   "\0feature-gate-stub.svelte"  → Svelte stubs  (export default null)
 */

import type { Plugin, ResolvedConfig } from "vite";
import {
  getDisabledFeatureModulePaths,
  getDisabledRoutePatterns,
} from "./feature-flags.js";

const STUB_ID = "\0feature-gate-stub";
const STUB_SVELTE_ID = "\0feature-gate-stub.svelte";
const STUB_EXPORT = "export default null;\n";

function normalize(p: string): string {
  return p.replace(/\\/g, "/");
}

export function featureGatePlugin(): Plugin {
  let isProductionBuild = false;
  let disabledModulePaths: string[] = [];
  let disabledRoutePatterns: string[] = [];

  return {
    name: "vite-plugin-feature-gate",
    enforce: "pre",

    configResolved(config: ResolvedConfig) {
      isProductionBuild = config.command === "build";

      if (!isProductionBuild) return;

      disabledModulePaths = getDisabledFeatureModulePaths();
      disabledRoutePatterns = getDisabledRoutePatterns();

      const gatedCount = disabledModulePaths.length;
      if (gatedCount > 0) {
        console.log(
          `[feature-gate] Production build: gating ${gatedCount} disabled feature module path(s).`
        );
      }
    },

    resolveId(source: string, importer: string | undefined) {
      if (!isProductionBuild) return null;
      if (!disabledModulePaths.length && !disabledRoutePatterns.length)
        return null;

      const normalizedSource = normalize(source);
      const normalizedImporter = importer ? normalize(importer) : "";

      // Strategy 1: source contains a disabled module path prefix
      for (const prefix of disabledModulePaths) {
        if (normalizedSource.includes(prefix)) {
          return normalizedSource.endsWith(".svelte") ? STUB_SVELTE_ID : STUB_ID;
        }
      }

      // Strategy 2: the importer itself is inside a disabled route directory
      if (normalizedImporter) {
        for (const pattern of disabledRoutePatterns) {
          if (normalizedImporter.includes(pattern)) {
            return normalizedSource.endsWith(".svelte")
              ? STUB_SVELTE_ID
              : STUB_ID;
          }
        }
      }

      return null;
    },

    load(id: string) {
      if (id === STUB_ID || id === STUB_SVELTE_ID) {
        return STUB_EXPORT;
      }
      return null;
    },
  };
}
