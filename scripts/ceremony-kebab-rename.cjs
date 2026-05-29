#!/usr/bin/env node
// Kebab-rename in-scope .ts files for one feature module + rewrite imports across src/.
// Import rewrites are RESOLUTION-BASED: each import specifier is resolved to an absolute
// path and only rewritten if it resolves to a file we actually renamed. This avoids
// false positives when the same class stem exists in multiple modules.
// Usage: node scripts/ceremony-kebab-rename.cjs <module> [--apply]
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const FEAT = path.join(SRC, "lib", "features");

const moduleName = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!moduleName) { console.error("module required"); process.exit(1); }

function kebab(s) {
  s = s.replace(/([a-z0-9])([A-Z])/g, "$1-$2");
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2");
  return s.toLowerCase();
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

const modDir = path.join(FEAT, moduleName);
const modTs = listFiles(modDir, [".ts"]);

// Build rename map keyed by absolute old path (without extension stripped) -> new abs path.
const renames = [];
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
  renames.push({ oldPath: f, newPath: path.join(path.dirname(f), newBase), newBase });
}

if (renames.length === 0) { console.log("ALREADY_CLEAN"); process.exit(0); }

// Map: absolute module-resolution key (path WITHOUT extension) -> new module-resolution key.
// An import specifier resolving to "<dir>/<oldStem>" should become "<dir>/<newStem>".
const keyMap = new Map();
for (const r of renames) {
  const oldKey = r.oldPath.replace(/\.svelte\.ts$|\.ts$/,"");
  const newKey = r.newPath.replace(/\.svelte\.ts$|\.ts$/,"");
  keyMap.set(path.normalize(oldKey), path.normalize(newKey));
}

// 1) git mv all files first (only on apply).
if (APPLY) {
  const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
  for (const r of renames) {
    execSync(`git mv "${rel(r.oldPath)}" "${rel(r.newPath)}"`, { cwd: ROOT, stdio: "pipe" });
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
  return path.normalize(base);
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
  module: moduleName,
  renamed: renames.map((r) => `${path.relative(ROOT, r.oldPath).replace(/\\/g, "/")} -> ${r.newBase}`),
  renamedCount: renames.length,
  editedFiles: [...editedFiles].sort(),
  editedCount: editedFiles.size,
}, null, 2));
