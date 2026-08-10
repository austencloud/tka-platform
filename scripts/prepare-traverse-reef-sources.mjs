/**
 * Decompress the trench gallery's source assets for Blender.
 *
 * Blender's glTF importer rejects EXT_meshopt_compression outright
 * ("Extension EXT_meshopt_compression is not available on this addon
 * version"), and several of the ocean assets ship with it. gltf-transform
 * decodes it on read, so a plain copy round-trip is enough to hand Blender
 * something it will open.
 *
 * Writes to .cache/traverse-reef-src/ with '/' flattened to '_', which is what
 * scripts/build-traverse-reef.py expects. The cache is disposable — delete it
 * and re-run.
 *
 * Run (after scripts/generate-traverse-reef.py):
 *   node scripts/prepare-traverse-reef-sources.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const COMPOSITION = join(HERE, "water-traverse-reef.json");
const MODELS_ROOT = join(REPO, "static", "models", "ocean");
const CACHE = join(REPO, ".cache", "traverse-reef-src");
// The bare .bin shim is a shell script; execFileSync on Windows needs the .CMD.
const CLI = join(
  REPO,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "gltf-transform.CMD" : "gltf-transform"
);

const composition = JSON.parse(readFileSync(COMPOSITION, "utf8"));
const paths = [...new Set(composition.placements.map((p) => p.path))].sort();

mkdirSync(CACHE, { recursive: true });

let copied = 0;
let skipped = 0;
const failed = [];

for (const rel of paths) {
  const source = join(MODELS_ROOT, rel);
  const target = join(CACHE, rel.replaceAll("/", "_"));
  if (existsSync(target)) {
    skipped += 1;
    continue;
  }
  try {
    // shell: true — the Windows shim is a .CMD, which execFileSync cannot spawn directly.
    execFileSync(CLI, ["copy", source, target], { stdio: "pipe", shell: true });
    copied += 1;
  } catch (error) {
    failed.push(`${rel}: ${error.message.split("\n")[0]}`);
  }
}

console.log(`${paths.length} sources — ${copied} decoded, ${skipped} cached`);
if (failed.length > 0) {
  console.error(`failed (${failed.length}):\n  ${failed.join("\n  ")}`);
  process.exit(1);
}
