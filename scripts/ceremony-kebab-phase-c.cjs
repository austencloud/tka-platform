#!/usr/bin/env node
// Phase C driver: kebab-rename ALL PascalCase .ts under src/lib/shared in one shot.
//
// Why a driver: ceremony-kebab-rename.cjs rewrites importers per the subdir it just renamed.
// Run subdir-by-subdir, that per-pass rewrite is INCOMPLETE across subdir boundaries (a file
// in shared/3d importing shared/effects only gets fixed when its specifier resolves to an
// already-renamed target — order-dependent). The authoritative fix is to do EVERY rename
// first, then a SINGLE full-tree import rewrite driven by git's complete rename set
// (ceremony-kebab-fix-imports.cjs). This driver enforces that order so the pipeline can't be
// run half-way (which leaves "Cannot find module" errors). Validated: yields 0 rename-induced
// svelte-check errors against quiet main.
//
// Usage:
//   node scripts/ceremony-kebab-phase-c.cjs            # dry-run: list subdirs + rename counts
//   node scripts/ceremony-kebab-phase-c.cjs --apply    # apply renames + full-tree rewrite
//
// MERGE NOTE: run this ONLY against a genuinely quiet main (no other agents mid-edit). The
// rewrite touches ~1.9k files; foundation/ (+677 importers) and pictograph/ (+503) are the
// hottest paths in the repo and will conflict with any concurrent edit. Re-run regenerates
// against fresh main — never merge a stale diff.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SHARED = path.join(ROOT, "src", "lib", "shared");
const APPLY = process.argv.includes("--apply");

function listFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith(".ts")) out.push(p);
    }
  })(dir);
  return out;
}

// Enumerate shared subdirs that hold a rename candidate (PascalCase/camel .ts, not I-prefix,
// not .svelte/.test/.spec/.d.ts) — same filter the rename codemod applies.
const subdirs = new Set();
for (const f of listFiles(SHARED)) {
  const base = path.basename(f);
  if (/^I[A-Z]/.test(base)) continue;
  if (/\.(svelte|test|spec|d)\.ts$/.test(base)) continue;
  if (!/^[A-Z]/.test(base) && !/[a-z][A-Z]/.test(base)) continue;
  const rel = path.relative(SHARED, f).replace(/\\/g, "/");
  subdirs.add(rel.split("/")[0]);
}
const ordered = [...subdirs].sort();
console.log(`shared subdirs with candidates (${ordered.length}): ${ordered.join(", ")}`);

const renameScript = path.join(__dirname, "ceremony-kebab-rename.cjs");
const fixScript = path.join(__dirname, "ceremony-kebab-fix-imports.cjs");

// STEP 1 — renames (and best-effort per-subdir rewrite).
let totalRenamed = 0;
const allCollisions = [];
for (const sd of ordered) {
  let out;
  try {
    out = execSync(`node "${renameScript}" "shared/${sd}"${APPLY ? " --apply" : ""}`, {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
    }).toString();
  } catch (err) {
    console.error(`FAILED on shared/${sd}:`);
    console.error((err.stderr || err.stdout || err.message || "").toString());
    process.exit(1);
  }
  const m = out.match(/"renamedCount":\s*(\d+)/);
  const n = m ? Number(m[1]) : 0;
  totalRenamed += n;
  try {
    const parsed = JSON.parse(out.startsWith("{") ? out : out.slice(out.indexOf("{")));
    for (const c of parsed.collisions || []) allCollisions.push(`shared/${sd}: ${c}`);
  } catch { /* ALREADY_CLEAN or non-JSON */ }
  console.log(`  shared/${sd}: ${n} renames`);
}
console.log(`total renames: ${totalRenamed}`);
if (allCollisions.length) {
  console.log(`\n!! ${allCollisions.length} COLLISION(S) — pre-existing duplicate files in main, SKIPPED (need manual reconciliation):`);
  for (const c of allCollisions) console.log(`   ${c}`);
}

// STEP 2 — authoritative full-tree import rewrite from git's complete rename set.
if (APPLY) {
  const out = execSync(`node "${fixScript}" --apply`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();
  const e = out.match(/"editedCount":\s*(\d+)/);
  console.log(`full-tree rewrite: ${e ? e[1] : "?"} files corrected`);
  console.log("DONE. Run `npm run check` to verify (expect only pre-existing env errors).");
} else {
  console.log("DRY-RUN. Re-run with --apply to perform renames + full-tree rewrite.");
}
