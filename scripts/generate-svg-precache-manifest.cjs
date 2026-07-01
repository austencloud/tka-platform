#!/usr/bin/env node
/**
 * generate-svg-precache-manifest.cjs
 *
 * Emits static/svg-precache-manifest.json — the finite set of pictograph SVG
 * assets the service worker precaches on install so pictographs render
 * cold-offline (audit 2026-06-30, fix #1). The set is small (~260KB / ~190
 * files) and stable; generating it at build time keeps it from rotting as
 * props/letters are added.
 *
 * Wired into `build` / `build:fast` BEFORE `vite build` so the manifest lands
 * in static/ and is copied into build/ (served at /svg-precache-manifest.json).
 * The output file is gitignored (deterministic build artifact).
 */

const fs = require("fs");
const path = require("path");

const STATIC_DIR = path.join(__dirname, "..", "static");
const IMAGES_DIR = path.join(STATIC_DIR, "images");
const OUTPUT = path.join(STATIC_DIR, "svg-precache-manifest.json");

// The render-critical asset dirs under static/images. Every live pictograph
// fetches from these at runtime (prop-svg-loader, arrow-svg-loader, glyph-cache,
// svg-preloader, GridSvg). Animated props (props/animated) are excluded — they
// belong to the animation engine, not the static pictograph renderer.
const ESSENTIAL_DIRS = [
  "props/pictograph",
  "grid",
  "arrows",
  "letters_trimmed",
  "numbers",
  "vtg_glyphs",
];

const ASSET_EXTENSIONS = new Set([".svg", ".json"]);

/** Recursively collect asset files under a dir, returning absolute paths. */
function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // dir missing — skip, runtime cache-first still covers it
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Collect the precache asset URL list (root-relative, forward-slashed, sorted,
 * deduped). Exported for testing.
 * @param {string} [imagesDir] override the static/images dir (tests)
 * @returns {string[]} e.g. ["/images/grid/diamond_grid.svg", ...]
 */
function collectAssets(imagesDir = IMAGES_DIR) {
  const urls = new Set();
  for (const rel of ESSENTIAL_DIRS) {
    const abs = path.join(imagesDir, rel);
    for (const file of walk(abs)) {
      const fromStatic = path.relative(path.dirname(imagesDir), file);
      urls.add("/" + fromStatic.split(path.sep).join("/"));
    }
  }
  return Array.from(urls).sort();
}

function main() {
  const assets = collectAssets();
  const payload = {
    // Note: no timestamp — keeps the file byte-stable across rebuilds when the
    // asset set is unchanged (avoids needless diffs / cache churn).
    count: assets.length,
    assets,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `[svg-precache] wrote ${assets.length} assets -> static/svg-precache-manifest.json`
  );
}

if (require.main === module) {
  main();
}

module.exports = { collectAssets, ESSENTIAL_DIRS, OUTPUT };
