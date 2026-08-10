#!/usr/bin/env node
/**
 * Decode every asset the composition references into a Blender-importable copy.
 *
 * Blender's glTF importer cannot read EXT_meshopt_compression or Draco, and
 * most of the optimized ocean assets carry one or the other. `gltf-transform
 * copy` round-trips through the library's own decoders and writes plain
 * buffers, which the importer accepts.
 *
 * Output lives under static/models/ocean/.sources/ -- dot-prefixed so
 * SvelteKit never serves it and the deploy trim never ships it.
 *
 * Run: node scripts/prepare-ocean-sources.mjs
 *
 * Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "fs";
import { dirname, join, resolve } from "path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"), "..");
const MODELS = join(ROOT, "static/models/ocean");
const SOURCES = join(MODELS, ".sources");
const COMPOSITION = join(ROOT, "scripts/ocean-composition.json");

const composition = JSON.parse(readFileSync(COMPOSITION, "utf-8"));
const paths = [...new Set(composition.placements.map((p) => p.path))].sort();

mkdirSync(SOURCES, { recursive: true });

let decoded = 0;
let skipped = 0;
for (const relative of paths) {
  const input = join(MODELS, relative.replace(/\//g, "/"));
  const output = join(SOURCES, relative.replace(/\//g, "__"));
  if (!existsSync(input)) throw new Error(`Missing ${input}`);

  // Skip work already done, keyed on mtime: this runs over 39 assets and some
  // of them are 2M-vertex corals.
  if (existsSync(output) && statSync(output).mtimeMs >= statSync(input).mtimeMs) {
    skipped += 1;
    continue;
  }

  // execSync with a quoted string, matching optimize-ocean-seabed.mjs. The
  // execFileSync/spawnSync path fails on Windows: npx resolves to npx.cmd,
  // which spawnSync refuses to execute directly (EINVAL).
  execSync(
    `npx --yes @gltf-transform/cli copy ${JSON.stringify(input)} ${JSON.stringify(output)}`,
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  decoded += 1;
  console.log(`  decoded ${relative}`);
}

console.log(`Prepared ${paths.length} sources (${decoded} decoded, ${skipped} up to date)`);
console.log(`  -> ${SOURCES}`);
