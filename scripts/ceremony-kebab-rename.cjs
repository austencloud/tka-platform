#!/usr/bin/env node
// Kebab-rename in-scope .ts files for one feature module + rewrite imports across src/.
// Import rewrites are RESOLUTION-BASED: each import specifier is resolved to an absolute
// path and only rewritten if it resolves to a file we actually renamed. This avoids
// false positives when the same class stem exists in multiple modules.
// Usage: node scripts/ceremony-kebab-rename.cjs <module|path> [--apply]
//   bare name  => features/<name>   (e.g. choreo-card)
//   slashed    => path under src/lib (e.g. shared/3d, shared/pictograph)
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const target = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!target) { console.error("module|path required (bare => features/<name>; slashed => path under src/lib, e.g. shared/3d)"); process.exit(1); }
// Backward-compat: bare name resolves under features/; an explicit slashed path is taken
// relative to src/lib so shared/ subdirs are reachable without forking the script.
const modRel = target.includes("/") ? target : path.join("features", target);

function kebab(s) {
  s = s.replace(/([a-z])([A-Z])/g, "$1-$2");          // camel boundary: dataView -> data-View
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2");    // acronym boundary: URLSyncer -> URL-Syncer
  s = s.replace(/([a-zA-Z])([0-9])/g, "$1-$2");        // letter->digit: Data3D -> Data-3D, Bloom2D -> Bloom-2D
  s = s.replace(/([0-9])([A-Z])(?![a-z])/g, "$1$2");   // keep a dimensional token whole: 3D stays 3D, not 3-D
  return s.toLowerCase();                              // -> data-3d, bloom-2d
}

function listFiles(dir, exts) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && exts.some((x) => e.name.endsWith(x))) out.push(p);
    }
  })(dir);
  return out;
}

const modDir = path.join(SRC, "lib", modRel);
const modTs = listFiles(modDir, [".ts"]);

// Build rename map keyed by absolute old path (without extension stripped) -> new abs path.
const renames = [];
const collisions = [];
for (const f of modTs) {
  const base = path.basename(f);
  const isPascal = /^[A-Z]/.test(base);
  const isCamel = /[a-z][A-Z]/.test(base);
  if (!isPascal && !isCamel) continue;
  if (/^I[A-Z]/.test(base)) continue; // polymorphic interface files preserved
  let stem, suffix;
  if (base.endsWith(".svelte.ts")) { stem = base.slice(0, -10); suffix = ".svelte.ts"; }
  else { stem = base.slice(0, -3); suffix = ".ts"; }
  const newBase = kebab(stem) + suffix;
  if (newBase === base) continue;
  const newPath = path.join(path.dirname(f), newBase);
  // Collision guard: if the kebab destination already exists as a DIFFERENT file (not just a
  // case-only variant of the source), main carries a pre-existing duplicate (e.g. both
  // TerrainMeshGenerator.ts AND terrain-mesh-generator.ts tracked — a case-collision landmine
  // on Windows). Renaming would clobber/fail. Skip and report for manual reconciliation; do
  // NOT silently merge two divergent files.
  if (newBase.toLowerCase() !== base.toLowerCase() && fs.existsSync(newPath)) {
    collisions.push(`${path.relative(ROOT, f).replace(/\\/g, "/")} -> ${newBase} (destination already exists)`);
    continue;
  }
  renames.push({ oldPath: f, newPath, newBase });
}

if (renames.length === 0 && collisions.length === 0) { console.log("ALREADY_CLEAN"); process.exit(0); }
if (renames.length === 0) {
  console.log(JSON.stringify({ module: modRel, renamedCount: 0, collisions }, null, 2));
  process.exit(0);
}

// Map: absolute module-resolution key -> new key. Strip ONLY a trailing ".ts" so a
// ".svelte.ts" runes-state module keys as "<dir>/<Stem>.svelte" — which is exactly how
// importers reference it (Vite resolves "./Foo.svelte" -> "./Foo.svelte.ts"). Stripping
// ".svelte.ts" wholesale (the old behavior) keyed it as "<dir>/<Stem>" and never matched
// those importers, silently leaving them pointing at the pre-rename PascalCase path.
const keyMap = new Map();
for (const r of renames) {
  const oldKey = r.oldPath.replace(/\.ts$/,"");
  const newKey = r.newPath.replace(/\.ts$/,"");
  keyMap.set(path.normalize(oldKey), path.normalize(newKey));
}

// 1) git mv all files first (only on apply).
if (APPLY) {
  const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
  for (const r of renames) {
    const oldRel = rel(r.oldPath), newRel = rel(r.newPath);
    // Case-only renames (Letter.ts -> letter.ts) need a two-step temp mv on a
    // case-insensitive filesystem (Windows): a direct `git mv` leaves the old-case
    // file on disk and a phantom delete in the index. Force through a temp name.
    if (path.basename(oldRel).toLowerCase() === path.basename(newRel).toLowerCase()) {
      const tmpRel = newRel + ".case-tmp";
      execSync(`git mv -f "${oldRel}" "${tmpRel}"`, { cwd: ROOT, stdio: "pipe" });
      execSync(`git mv -f "${tmpRel}" "${newRel}"`, { cwd: ROOT, stdio: "pipe" });
    } else {
      execSync(`git mv "${oldRel}" "${newRel}"`, { cwd: ROOT, stdio: "pipe" });
    }
  }
}
// After mv, the on-disk files live at newPath. For resolution we treat both as existing.

// Resolve an import specifier (string) found in file `fromFile` to an absolute module key.
function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith("$lib/")) base = path.join(SRC, "lib", spec.slice(5));
  else if (spec.startsWith("$app/")) return null;
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // bare package import
  // Canonicalize to the keyMap form: drop a trailing ".ts" if the importer wrote one
  // explicitly (e.g. "./authState.svelte.ts" -> "./authState.svelte"), so both extension
  // styles resolve to the same key.
  return path.normalize(base).replace(/\.ts$/, "");
}

// 2) Rewrite imports across all of src/. Parse each import/dynamic-import specifier,
//    resolve it, and if it matches a renamed key, replace the stem in the specifier.
const allFiles = listFiles(SRC, [".ts", ".svelte"]);
const editedFiles = new Set();

const importRe = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'`])([^"'`]+)(\2)/g;

for (const f of allFiles) {
  const content = fs.readFileSync(f, "utf8");
  let changed = false;
  const newContent = content.replace(importRe, (m, pre, q, spec, q2) => {
    const resolved = resolveSpecifier(spec, f);
    if (!resolved) return m;
    if (keyMap.has(resolved)) {
      const newKey = keyMap.get(resolved);
      // Replace only the final path segment (stem) in the original specifier string,
      // preserving the importer's chosen prefix style ($lib vs relative).
      const newStem = path.basename(newKey);
      const newSpec = spec.replace(/[^/]+$/, newStem);
      changed = true;
      return pre + q + newSpec + q2;
    }
    return m;
  });
  if (changed) {
    editedFiles.add(path.relative(ROOT, f).replace(/\\/g, "/"));
    if (APPLY) fs.writeFileSync(f, newContent);
  }
}

console.log(JSON.stringify({
  module: modRel,
  renamed: renames.map((r) => `${path.relative(ROOT, r.oldPath).replace(/\\/g, "/")} -> ${r.newBase}`),
  renamedCount: renames.length,
  editedFiles: [...editedFiles].sort(),
  editedCount: editedFiles.size,
  collisions,
}, null, 2));
