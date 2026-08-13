#!/usr/bin/env node
/**
 * Trim the Cloudflare Pages build output:
 * 1. Remove entire directories that are dev-only or served from R2/CDN
 * 2. Remove individual files larger than the 25 MiB per-file limit
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { normalizeCloudflareRouteRules } from "./cloudflare-route-rules.js";
import {
  DEPLOY_DIRECTORY_FILE_ALLOWLISTS,
  getDisallowedDeployEntries,
} from "./deploy-asset-trim-policy.js";

const MAX_BYTES = 25 * 1024 * 1024;
const OUTPUT_DIR = ".svelte-kit/cloudflare";

function normalizeRoutesFile() {
  const routesPath = join(OUTPUT_DIR, "_routes.json");
  if (!existsSync(routesPath)) return;

  const routes = JSON.parse(readFileSync(routesPath, "utf8"));
  const normalized = normalizeCloudflareRouteRules(routes);
  const removed =
    routes.include.length +
    routes.exclude.length -
    normalized.include.length -
    normalized.exclude.length;

  if (removed === 0) return;

  writeFileSync(routesPath, `${JSON.stringify(normalized, null, 2)}\n`);
  console.log(
    `  Removed ${removed} overlapping Cloudflare route rule${removed === 1 ? "" : "s"}`
  );
}

// guides/ stays: 3 downloadable PDFs (~28 MB total), each under the 25 MiB
// per-file cap. They were swept in with the May-13 deploy-size trim but are
// user-facing downloads linked from the landing page (/guides/level-N.pdf).
const DIRS_TO_REMOVE = [
  "screenshots",
  "thumbnails",
  // Design sketches are throwaway HTML mockups reviewed at
  // localhost:5173/sketches/<file>.html during design work. Vite serves them
  // from static/ in dev, so that workflow is untouched — but static/ copies
  // verbatim into the deploy output, which published 32 internal mockups on
  // tkaflowarts.com/sketches/. They are not route-gated, so no feature flag or
  // load guard can reach them; dropping them here is the only seam.
  "sketches",
];

// Individual dev-only files that live in static/ and would otherwise ship.
// Same reasoning as the sketches directory above.
//
// The Autumn model entries are Blender/forest BUILD INPUTS, not runtime assets.
// They are trimmed from the deploy output rather than deleted from the repo
// because three of them are still needed on disk: forest-tree-layout.json
// consumes autumn-snag.glb, golden-larch.glb and autumn-willow.glb as
// sourcePath inputs to the forest builder.
const FILES_TO_REMOVE = [
  "element-icons-preview.html",
  // Optimized per-asset GLBs. The Autumn builder imports the *_raw* variants;
  // these optimized copies are only consumed by other builders, offline.
  "models/autumn/hero-tree-a.glb",
  "models/autumn/hero-tree-b.glb",
  "models/autumn/fallen-log.glb",
  "models/autumn/fern-clump.glb",
  "models/autumn/mushroom-grove.glb",
  "models/autumn/perched-owl.glb",
  "models/autumn/autumn-snag.glb",
  "models/autumn/autumn-willow.glb",
  "models/autumn/golden-larch.glb",
];

// Raw Meshy/Blender source GLBs. These are gitignored, but .gitignore does not
// stop SvelteKit copying static/ verbatim into the build output, so every one
// of them was being published. Only the largest tripped the 25 MiB per-file
// sweep below; the rest (9-20 MiB each) shipped silently. Nothing fetches a
// *_raw.glb at runtime — they exist purely as Blender import sources.
const isRawSourceModel = (path) => path.endsWith("_raw.glb");

let rawRemovedBytes = 0;

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else {
      const size = statSync(fullPath).size;
      if (isRawSourceModel(entry.name)) {
        console.log(
          `  Removing raw source ${fullPath} (${(size / 1024 / 1024).toFixed(1)} MiB)`
        );
        rawRemovedBytes += size;
        unlinkSync(fullPath);
      } else if (size > MAX_BYTES) {
        console.log(
          `  Removing ${fullPath} (${(size / 1024 / 1024).toFixed(1)} MiB)`
        );
        unlinkSync(fullPath);
      }
    }
  }
}

console.log(`Trimming deploy output in ${OUTPUT_DIR}...`);
normalizeRoutesFile();

for (const dir of DIRS_TO_REMOVE) {
  const fullPath = join(OUTPUT_DIR, dir);
  if (existsSync(fullPath)) {
    const files = readdirSync(fullPath, { recursive: true });
    rmSync(fullPath, { recursive: true, force: true });
    console.log(`  Removed ${fullPath}/ (${files.length} entries)`);
  }
}

for (const file of FILES_TO_REMOVE) {
  const fullPath = join(OUTPUT_DIR, file);
  if (existsSync(fullPath)) {
    unlinkSync(fullPath);
    console.log(`  Removed ${fullPath}`);
  }
}

// Autumn's floor directory is a texture workshop, not a runtime bundle. The
// GLB carries the baked macro atlas, and the browser fetches exactly one loose
// detail map. An allowlist prevents future bake outputs from silently shipping
// just because Vite copied `static/` into the Cloudflare artifact.
for (const [directory, allowedEntries] of Object.entries(
  DEPLOY_DIRECTORY_FILE_ALLOWLISTS
)) {
  const fullPath = join(OUTPUT_DIR, directory);
  if (!existsSync(fullPath)) continue;

  const entries = readdirSync(fullPath, { withFileTypes: true });
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
  const disallowed = getDisallowedDeployEntries(
    entries.map((entry) => entry.name),
    allowedEntries
  );
  let removedBytes = 0;
  for (const entryName of disallowed) {
    const entry = entriesByName.get(entryName);
    if (!entry) continue;
    const entryPath = join(fullPath, entryName);
    if (entry.isDirectory()) {
      rmSync(entryPath, { recursive: true, force: true });
    } else {
      removedBytes += statSync(entryPath).size;
      unlinkSync(entryPath);
    }
  }
  console.log(
    `  Kept ${allowedEntries.length} runtime file${allowedEntries.length === 1 ? "" : "s"} in ${fullPath}; removed ${disallowed.length} build entr${disallowed.length === 1 ? "y" : "ies"} (${(removedBytes / 1024 / 1024).toFixed(1)} MiB)`
  );
}

console.log("Trimming raw source models and files > 25 MiB...");
walk(OUTPUT_DIR);
if (rawRemovedBytes > 0) {
  console.log(
    `  Raw source models removed: ${(rawRemovedBytes / 1024 / 1024).toFixed(1)} MiB`
  );
}
console.log("Done.");
