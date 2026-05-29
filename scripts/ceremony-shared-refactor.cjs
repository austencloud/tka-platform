#!/usr/bin/env node
// Mechanical ceremony-retirement refactor for ONE shared module.
// Transforms: (1) flatten services/implementations/, (2) collapse services/contracts/
// (types.ts only or empty), (3) kebab-rename PascalCase/camelCase .ts files,
// (4) resolution-based import rewrite across all of src/.
//
// Import rewrites are RESOLUTION-BASED: each import specifier is resolved to an absolute
// path key and only rewritten if it resolves to a file we actually moved/renamed.
//
// .svelte.ts BUG CLASS handled: a consumer may import a `.svelte.ts` module with a
// specifier ending in `.svelte` (no `.ts`). The resolver maps both forms.
//
// Usage: node scripts/ceremony-shared-refactor.cjs <module> [--apply]
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const moduleName = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!moduleName) { console.error("module required"); process.exit(1); }

const modDir = path.join(SRC, "lib", "shared", moduleName);
if (!fs.existsSync(modDir)) { console.error("module dir not found: " + modDir); process.exit(1); }

function kebab(s) {
  s = s.replace(/([a-z0-9])([A-Z])/g, "$1-$2");
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2");
  return s.toLowerCase();
}
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
function gitmv(from, to) { execSync(`git mv "${rel(from)}" "${rel(to)}"`, { cwd: ROOT, stdio: "pipe" }); }

function listFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && exts.some((x) => e.name.endsWith(x))) out.push(p);
    }
  })(dir);
  return out;
}

// Track moves as {oldPath, newPath}. Both flatten-moves and kebab-renames go here.
const moves = [];

const servicesDir = path.join(modDir, "services");
const implDir = path.join(servicesDir, "implementations");
const contractsDir = path.join(servicesDir, "contracts");

// ---- TRANSFORM 1: flatten services/implementations/ (recursively preserve subdirs) ----
if (fs.existsSync(implDir)) {
  for (const e of fs.readdirSync(implDir, { withFileTypes: true })) {
    // Move each top-level entry (file or subdir) up to services/. Subdirs move whole.
    moves.push({ oldPath: path.join(implDir, e.name), newPath: path.join(servicesDir, e.name), isFlatten: true });
  }
}

// ---- TRANSFORM 2: collapse services/contracts/ if types-only or empty ----
let contractsAction = "none";
let contractMoves = [];
if (fs.existsSync(contractsDir)) {
  const entries = fs.readdirSync(contractsDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile());
  const hasInterface = files.some((f) => /^I[A-Z].*\.ts$/.test(f.name));
  if (entries.length === 0) {
    contractsAction = "delete-empty";
  } else if (!hasInterface) {
    // move all files up to services/, then delete dir
    for (const f of files) {
      contractMoves.push({ oldPath: path.join(contractsDir, f.name), newPath: path.join(servicesDir, f.name), isFlatten: true });
    }
    contractsAction = "collapse-types";
  } else {
    contractsAction = "keep-interface";
  }
}

module.exports = {}; // not used as module, but harmless

const plan = { module: moduleName, contractsAction };

if (!APPLY) {
  console.log(JSON.stringify({ ...plan, flattenImpl: moves.map((m) => rel(m.oldPath) + " -> " + rel(m.newPath)), contractMoves: contractMoves.map((m) => rel(m.oldPath) + " -> " + rel(m.newPath)) }, null, 2));
  // For dry run we don't compute kebab targets at final dirs (they depend on flatten first).
  process.exit(0);
}

// Apply flatten moves (impl + contracts) via git mv.
for (const m of [...moves, ...contractMoves]) gitmv(m.oldPath, m.newPath);
// Record into moves for resolution mapping.
moves.push(...contractMoves);

// Delete now-empty implementations/ and contracts/ dirs.
function rmIfEmpty(d) {
  if (fs.existsSync(d)) {
    const left = fs.readdirSync(d);
    if (left.length === 0) fs.rmdirSync(d);
  }
}
rmIfEmpty(implDir);
rmIfEmpty(contractsDir);

// ---- TRANSFORM 3: kebab-rename PascalCase/camelCase .ts files (at their CURRENT/new locations) ----
// Re-list all .ts files now that flatten has happened.
const tsFiles = listFiles(modDir, [".ts"]);
const renames = [];
for (const f of tsFiles) {
  const base = path.basename(f);
  if (base.endsWith(".d.ts")) continue; // leave declaration files
  const isPascal = /^[A-Z]/.test(base);
  const isCamel = /[a-z][A-Z]/.test(base);
  if (!isPascal && !isCamel) continue;
  if (/^I[A-Z]/.test(base)) continue; // polymorphic interface files preserved
  let stem, suffix;
  if (base.endsWith(".svelte.ts")) { stem = base.slice(0, -10); suffix = ".svelte.ts"; }
  else { stem = base.slice(0, -3); suffix = ".ts"; }
  const newBase = kebab(stem) + suffix;
  if (newBase === base) continue;
  renames.push({ oldPath: f, newPath: path.join(path.dirname(f), newBase) });
}
for (const r of renames) gitmv(r.oldPath, r.newPath);
moves.push(...renames);

// ---- TRANSFORM 4: resolution-based import rewrite ----
// Build keyMap: normalized module-resolution key (path WITHOUT extension) -> new key.
// Each move contributes a key. For flattened SUBDIRS, expand to every file inside.
const keyMap = new Map();
function stripExt(p) { return p.replace(/\.svelte\.ts$|\.ts$|\.svelte$/, ""); }
function addKey(oldAbs, newAbs) {
  keyMap.set(path.normalize(stripExt(oldAbs)), path.normalize(stripExt(newAbs)));
}
for (const m of moves) {
  // If oldPath was a directory that moved, every file under newPath got relocated.
  if (fs.existsSync(m.newPath) && fs.statSync(m.newPath).isDirectory()) {
    const inside = listFiles(m.newPath, [".ts", ".svelte"]);
    for (const nf of inside) {
      const oldf = path.join(m.oldPath, path.relative(m.newPath, nf));
      addKey(oldf, nf);
    }
  } else {
    addKey(m.oldPath, m.newPath);
  }
}

// Collapse multi-hop chains: a file can move twice (flatten then kebab), producing
// key chains old->intermediate->final. Resolve every key to its FINAL destination so a
// consumer importing the ORIGINAL path is rewritten to the final name in one rewrite.
for (const [k, v0] of keyMap) {
  let v = v0;
  const seen = new Set([k]);
  while (keyMap.has(v) && !seen.has(v)) {
    seen.add(v);
    v = keyMap.get(v);
  }
  keyMap.set(k, v);
}

// Resolve specifier -> absolute key. Handles .svelte specifiers that resolve to .svelte.ts.
// `resolveFromFile` is the path the relative spec should be resolved against. For a MOVED
// file we resolve against its OLD location so its own relative imports map to the same
// absolute target they always did, then re-emit relative to the NEW location.
function resolveSpecifier(spec, resolveFromFile) {
  let base;
  if (spec.startsWith("$lib/")) base = path.join(SRC, "lib", spec.slice(5));
  else if (spec.startsWith("$app/") || spec.startsWith("$env/")) return null;
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(resolveFromFile), spec);
  else return null;
  return path.normalize(stripExt(base));
}

// Map NEW file path -> OLD file path for every moved file (so we can fix the moved
// file's OWN relative imports to non-moved siblings, which break on a depth change).
const newToOldFile = new Map();
for (const m of moves) {
  if (fs.existsSync(m.newPath) && fs.statSync(m.newPath).isDirectory()) {
    for (const nf of listFiles(m.newPath, [".ts", ".svelte"])) {
      const oldf = path.join(m.oldPath, path.relative(m.newPath, nf));
      newToOldFile.set(path.normalize(nf), path.normalize(oldf));
    }
  } else {
    newToOldFile.set(path.normalize(m.newPath), path.normalize(m.oldPath));
  }
}
// Collapse chains so each FINAL new path points to the ORIGINAL old path (a file can move
// twice: flatten then kebab). Without this, oldF would only be the intermediate location
// and self-relative re-anchoring would compute the wrong base dir.
for (const [newP, oldP0] of newToOldFile) {
  let oldP = oldP0;
  const seen = new Set([newP]);
  while (newToOldFile.has(oldP) && !seen.has(oldP)) {
    seen.add(oldP);
    oldP = newToOldFile.get(oldP);
  }
  newToOldFile.set(newP, oldP);
}

const allFiles = listFiles(SRC, [".ts", ".svelte"]);
const editedFiles = new Set();
const importRe = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'`])([^"'`]+)(\2)/g;

for (const f of allFiles) {
  const content = fs.readFileSync(f, "utf8");
  let changed = false;
  // If THIS file moved, its relative specifiers were authored against its OLD dir.
  const oldF = newToOldFile.get(path.normalize(f)) || null;
  const newContent = content.replace(importRe, (mm, pre, q, spec, q2) => {
    // First, the keyMap path: spec points at a file that itself moved/renamed.
    // Resolve against current location (consumers) AND, if this file moved, also try old.
    let resolved = resolveSpecifier(spec, f);
    let useNewKey = resolved && keyMap.has(resolved);
    let newKey;
    if (useNewKey) {
      newKey = keyMap.get(resolved);
    } else if (oldF && spec.startsWith(".")) {
      // This file moved. Re-anchor its relative spec against the OLD dir to find the
      // true absolute target; if that target exists on disk, re-emit from the NEW dir.
      const oldResolved = resolveSpecifier(spec, oldF);
      if (oldResolved && oldResolved !== resolveSpecifier(spec, f)) {
        // Confirm the old-anchored target is real (a file or a moved key).
        const mapped = keyMap.has(oldResolved) ? keyMap.get(oldResolved) : oldResolved;
        const existsAsFile = [".ts", ".svelte.ts", ".svelte", ".js", ".d.ts"].some((e) => {
          try { return fs.statSync(mapped + e).isFile(); } catch { return false; }
        }) || (() => { try { return fs.statSync(mapped).isDirectory(); } catch { return false; } })();
        if (existsAsFile) { newKey = mapped; useNewKey = true; }
      }
    }
    if (!useNewKey) return mm;
    let newSpec;
    if (spec.startsWith("$lib/")) {
      newSpec = "$lib/" + path.relative(path.join(SRC, "lib"), newKey).replace(/\\/g, "/");
    } else {
      let r = path.relative(path.dirname(f), newKey).replace(/\\/g, "/");
      if (!r.startsWith(".")) r = "./" + r;
      newSpec = r;
    }
    // Preserve the original suffix style (.svelte vs nothing). If original spec ended
    // with `.svelte`, the target is a .svelte.ts module -> keep `.svelte`.
    if (/\.svelte$/.test(spec)) newSpec += ".svelte";
    else if (/\.svelte\.ts$/.test(spec)) newSpec += ".svelte.ts";
    else if (/\.ts$/.test(spec)) newSpec += ".ts";
    if (newSpec === spec) return mm;
    changed = true;
    return pre + q + newSpec + q2;
  });
  if (changed) { editedFiles.add(rel(f)); fs.writeFileSync(f, newContent); }
}

console.log(JSON.stringify({
  ...plan,
  flattened: moves.filter((m) => m.isFlatten).map((m) => rel(m.oldPath) + " -> " + rel(m.newPath)),
  renamed: renames.map((r) => rel(r.oldPath) + " -> " + path.basename(r.newPath)),
  renamedCount: renames.length,
  editedFiles: [...editedFiles].sort(),
  editedCount: editedFiles.size,
}, null, 2));
