#!/usr/bin/env node
// One-off corrective: the first kebab apply renamed files correctly but missed importers
// of ".svelte.ts" runes-state modules (key-strip bug, now fixed in ceremony-kebab-rename.cjs).
// This rewrites the still-broken importers using the SAME corrected resolution logic, driven
// by the rename map captured in the apply manifest. Idempotent: imports already pointing at the
// new kebab path don't resolve to an old key, so they're left untouched.
// Usage: node scripts/ceremony-kebab-fix-imports.cjs [--apply]
// Source of truth = git's staged rename detection (git mv staged every rename).
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const APPLY = process.argv.includes("--apply");

// Build old-abs-key -> new-abs-key from staged renames (strip trailing .ts only, keep .svelte).
const keyMap = new Map();
const nameStatus = execSync("git diff --cached --name-status -M", { cwd: ROOT }).toString();
for (const line of nameStatus.split("\n")) {
  const parts = line.split("\t");
  if (!parts[0] || !parts[0].startsWith("R")) continue;
  const [, oldRel, newRel] = parts;
  if (!oldRel || !newRel) continue;
  const oldKey = path.normalize(path.join(ROOT, oldRel).replace(/\.ts$/, ""));
  const newKey = path.normalize(path.join(ROOT, newRel).replace(/\.ts$/, ""));
  keyMap.set(oldKey, newKey);
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

function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith("$lib/")) base = path.join(SRC, "lib", spec.slice(5));
  else if (spec.startsWith("$app/")) return null;
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  return path.normalize(base).replace(/\.ts$/, "");
}

const importRe = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'`])([^"'`]+)(\2)/g;
const allFiles = listFiles(SRC, [".ts", ".svelte"]);
const edited = new Set();

for (const f of allFiles) {
  const content = fs.readFileSync(f, "utf8");
  let changed = false;
  const next = content.replace(importRe, (m, pre, q, spec, q2) => {
    const resolved = resolveSpecifier(spec, f);
    if (!resolved || !keyMap.has(resolved)) return m;
    const newStem = path.basename(keyMap.get(resolved));
    const newSpec = spec.replace(/[^/]+$/, newStem);
    changed = true;
    return pre + q + newSpec + q2;
  });
  if (changed) {
    edited.add(path.relative(ROOT, f).replace(/\\/g, "/"));
    if (APPLY) fs.writeFileSync(f, next);
  }
}

console.log(JSON.stringify({ mappings: keyMap.size, editedCount: edited.size, edited: [...edited].sort() }, null, 2));
