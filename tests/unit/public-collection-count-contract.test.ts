/**
 * Static contract test for public-collection count normalization.
 *
 * public-collection-loader is the only door foreign collections enter the app
 * through, and it normalizes `sequenceCount` to PUBLIC members before anything
 * escapes (see the module invariant in
 * src/lib/features/library/services/public-collection-loader.ts and
 * docs/superpowers/specs/2026-07-10-public-collection-count-normalization-design.md).
 *
 * Before this, correctness was opt-in: each surface patched the count itself,
 * and three surfaces drifted (community cards, foreign detail header, followed
 * rail — "4 sequences" over a 1-sequence grid). This test locks the fix at the
 * source level. If it fails, fix the offending file — do not loosen it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOADER =
  "src/lib/features/library/services/public-collection-loader.ts";

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|svelte)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("public-collection count normalization contract", () => {
  it("keeps countPublicMembers module-private to the loader", () => {
    const loader = read(LOADER);
    expect(loader).toMatch(/async function countPublicMembers/);
    expect(loader).not.toMatch(/export\s+(async\s+)?function countPublicMembers/);
  });

  it("no file outside the loader references countPublicMembers", () => {
    const srcRoot = path.join(repoRoot, "src");
    const loaderAbs = path.join(repoRoot, LOADER);
    const offenders = walk(srcRoot)
      .filter((f) => f !== loaderAbs)
      .filter((f) => readFileSync(f, "utf8").includes("countPublicMembers"))
      .map((f) => path.relative(repoRoot, f));

    // A consumer counting for itself means normalization moved back out of
    // the loader — the exact opt-in drift this contract forbids.
    expect(offenders).toEqual([]);
  });

  it("every public-facing getter routes through toPublicView", () => {
    const loader = read(LOADER);
    for (const getter of [
      "getUserPublicCollections",
      "getAllPublicCollections",
      "getPublicCollection",
    ]) {
      const start = loader.indexOf(`export async function ${getter}`);
      expect(start, `${getter} missing from loader`).toBeGreaterThan(-1);
      const body = loader.slice(start, loader.indexOf("\n}", start));
      expect(body, `${getter} must normalize via toPublicView`).toContain(
        "toPublicView",
      );
    }
  });
});
