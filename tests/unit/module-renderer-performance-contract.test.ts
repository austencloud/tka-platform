/**
 * Module loading performance contract.
 *
 * Background-loading Museum pulls the Three.js/Threlte graph into whichever
 * feature is active. In Vite development that is hundreds of source-module
 * requests, and in production it spends bandwidth and CPU without user intent.
 * Keep the heavy module behind explicit navigation intent or activation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("ModuleRenderer heavy-module loading", () => {
  it("does not start Museum from a boot-time timer", () => {
    const renderer = readSource(
      "src/lib/shared/modules/ModuleRenderer.svelte"
    );

    expect(renderer).not.toContain('loadModule("museum")');
    expect(renderer).not.toContain("preloadTimer");
  });

  it("keeps Museum available to the existing navigation-intent prefetcher", () => {
    const prefetch = readSource(
      "src/lib/shared/navigation/utils/module-prefetch.ts"
    );

    expect(prefetch).toContain(
      'museum: "/src/lib/features/museum/MuseumModule.svelte"'
    );
  });
});
