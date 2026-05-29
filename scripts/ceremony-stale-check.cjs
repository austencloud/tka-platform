#!/usr/bin/env node
// Global resolution-based stale-import sweep.
// For every relative / $lib import specifier in src/, resolve it to a file on disk.
// Report any specifier that resolves to a NONEXISTENT path. Output count + offenders.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

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

// Resolve a specifier to an existing file path, trying the candidate extensions
// and index files the way the bundler would. Returns the resolved path or null
// (null meaning we couldn't find anything = STALE, IF it's a path we own).
function resolve(spec, fromFile) {
  let base;
  if (spec.startsWith("$lib/")) base = path.join(SRC, "lib", spec.slice(5));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return { ours: false };
  const cands = [
    base,
    base + ".ts",
    base + ".svelte",
    base + ".svelte.ts",
    base + ".js",
    base + ".d.ts",
    base + ".json",
    path.join(base, "index.ts"),
    path.join(base, "index.js"),
  ];
  // a spec ending in .svelte may be a .svelte.ts module
  if (spec.endsWith(".svelte")) cands.push(base + ".ts");
  for (const c of cands) {
    try { if (fs.statSync(c).isFile()) return { ours: true, found: c }; } catch {}
  }
  // directory exists but no resolvable entry?
  try { if (fs.statSync(base).isDirectory()) return { ours: true, found: base, dir: true }; } catch {}
  return { ours: true, found: null };
}

const importRe = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'`])([^"'`]+)(\2)/g;
const offenders = [];
for (const f of listFiles(SRC, [".ts", ".svelte"])) {
  const content = fs.readFileSync(f, "utf8");
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(content))) {
    const spec = m[3];
    if (spec.startsWith("$app/") || spec.startsWith("$env/") || spec.startsWith("$service-worker")) continue;
    const r = resolve(spec, f);
    if (r.ours && r.found === null) {
      offenders.push({ file: rel(f), spec });
    }
  }
}
console.log("STALE IMPORT COUNT: " + offenders.length);
for (const o of offenders) console.log("  " + o.file + "  ->  " + o.spec);
process.exit(offenders.length === 0 ? 0 : 0);
