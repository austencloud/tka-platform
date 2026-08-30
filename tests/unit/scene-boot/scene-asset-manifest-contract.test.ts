/**
 * Static contract test for the scene prefetch manifest.
 *
 * The manifest tells the prefetcher which models a 3D environment downloads, so
 * they can be warmed into the HTTP cache before anyone opens 3D. Nothing at
 * runtime checks it: a scene that gains a model simply loads it cold, and a
 * manifest entry for a model no longer used silently wastes a viewer's
 * bandwidth. Both directions are checked here instead.
 *
 * Two neighbours of the scene sources are deliberately outside the manifest,
 * and both exclusions are asserted to still exist so a rename cannot quietly
 * widen the scan:
 *
 * - `*-composer-plugin.ts` — model catalogs for the Scene Lab and Themes Lab
 *   authoring surfaces, never mounted by the viewer.
 * - `scenes/winter/graybox/` — a review model reachable only from a test route.
 *
 * If this test fails, fix the manifest — do not loosen the assertions.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BackgroundType } from "@austencloud/backgrounds";

import { SCENE_ASSET_MANIFEST } from "$lib/shared/3d/scene-boot/scene-asset-manifest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const SCENES_DIR = path.join(
  repoRoot,
  "src/lib/shared/3d/environments/scenes"
);

/**
 * Which environment owns each scene folder, and each root-level `*Scene.svelte`
 * once its suffix is dropped. Folder names and background names diverge where
 * the visual theme was named before the enum was.
 */
const SCENE_OWNERS: Record<string, BackgroundType> = {
  autumn: BackgroundType.AUTUMN,
  blossom: BackgroundType.BLOSSOM,
  "cherry-blossom": BackgroundType.BLOSSOM,
  celestial: BackgroundType.CELESTIAL,
  cosmic: BackgroundType.COSMIC,
  ember: BackgroundType.EMBER,
  "first-fire": BackgroundType.EMBER,
  forest: BackgroundType.FOREST,
  ocean: BackgroundType.OCEAN,
  rainbow: BackgroundType.PRIDE,
  "pure-black": BackgroundType.VOID,
  void: BackgroundType.VOID,
  winter: BackgroundType.WINTER,
};

const MODEL_URL = /\/models\/[A-Za-z0-9_./-]+\.glb/g;

function isExcluded(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  return (
    normalized.endsWith("-composer-plugin.ts") ||
    normalized.startsWith("winter/graybox/")
  );
}

function sourceFiles(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...sourceFiles(path.join(dir, entry.name), relative));
    } else if (/\.(svelte|ts)$/.test(entry.name) && !isExcluded(relative)) {
      found.push(relative);
    }
  }
  return found;
}

function ownerOf(relativePath: string): BackgroundType | null {
  const [head] = relativePath.split("/");
  if (head.endsWith(".svelte")) {
    const name = head.replace(/Scene\.svelte$/, "").toLowerCase();
    return SCENE_OWNERS[name] ?? null;
  }
  return SCENE_OWNERS[head] ?? null;
}

/** Every model URL a viewer-mounted scene source names, grouped by environment. */
function collectFromSources(): Map<BackgroundType, Map<string, string>> {
  const byOwner = new Map<BackgroundType, Map<string, string>>();
  for (const relative of sourceFiles(SCENES_DIR)) {
    const text = readFileSync(path.join(SCENES_DIR, relative), "utf8");
    const urls = text.match(MODEL_URL);
    if (!urls) continue;
    const owner = ownerOf(relative);
    expect(
      owner,
      `${relative} names a model but no environment owns it — add its folder to SCENE_OWNERS`
    ).not.toBeNull();
    const bucket = byOwner.get(owner!) ?? new Map<string, string>();
    for (const url of urls) bucket.set(url, relative);
    byOwner.set(owner!, bucket);
  }
  return byOwner;
}

describe("scene asset manifest", () => {
  const fromSources = collectFromSources();

  it("lists every model the scene sources load", () => {
    const missing: string[] = [];
    for (const [owner, urls] of fromSources) {
      const listed = new Set(SCENE_ASSET_MANIFEST[owner] ?? []);
      for (const [url, file] of urls) {
        if (!listed.has(url)) missing.push(`${owner}: ${url} (${file})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("lists nothing the scene sources no longer load", () => {
    const stale: string[] = [];
    for (const [owner, urls] of Object.entries(SCENE_ASSET_MANIFEST)) {
      const found = fromSources.get(owner as BackgroundType);
      for (const url of urls) {
        if (!found?.has(url)) stale.push(`${owner}: ${url}`);
      }
    }
    expect(stale).toEqual([]);
  });

  it("covers every background, so a new environment cannot be forgotten", () => {
    for (const background of Object.values(BackgroundType)) {
      expect(SCENE_ASSET_MANIFEST[background]).toBeDefined();
    }
  });

  it("still excludes the authoring catalogs and the graybox review model", () => {
    const all = (function walk(dir, prefix = ""): string[] {
      const found: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) found.push(...walk(path.join(dir, entry.name), relative));
        else found.push(relative);
      }
      return found;
    })(SCENES_DIR);

    expect(all.filter((f) => f.endsWith("-composer-plugin.ts")).length).toBeGreaterThan(0);
    expect(all.some((f) => f.startsWith("winter/graybox/"))).toBe(true);
  });
});
