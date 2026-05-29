// Enterprise-ceremony retirement for 8 feature modules.
// Mechanical: flatten implementations/, collapse non-polymorphic contracts/,
// kebab-rename PascalCase/camelCase .ts, rewrite resolved imports across src/.
// Usage: node scripts/ceremony-retire-8mod.mjs <module> [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const FEAT = path.join(SRC, 'lib', 'features');

const MODULE = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!MODULE) { console.error('need module'); process.exit(1); }
const MODDIR = path.join(FEAT, MODULE);

// ---- kebab algorithm ----
function kebabStem(stem) {
  // preserve trailing .svelte handled by caller; stem here has no extension chain except .svelte handled separately
  let s = stem;
  // between ([A-Z]+)([A-Z][a-z])  e.g. LOOPDetector -> LOOP-Detector, UIManager -> UI-Manager
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2');
  // before uppercase following lowercase/digit
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  return s.toLowerCase();
}
// returns new basename or null if no rename
function kebabBasename(base) {
  // skip .svelte components (not .svelte.ts)
  if (base.endsWith('.svelte')) return null;
  // I[A-Z]*.ts interfaces kept
  if (/^I[A-Z].*\.ts$/.test(base)) return null;
  let suffix = '';
  let core = base;
  if (core.endsWith('.svelte.ts')) { suffix = '.svelte.ts'; core = core.slice(0, -'.svelte.ts'.length); }
  else if (core.endsWith('.ts')) { suffix = '.ts'; core = core.slice(0, -'.ts'.length); }
  else return null;
  if (!/[A-Z]/.test(core)) return null; // already kebab / lowercase
  const nk = kebabStem(core) + suffix;
  return nk === base ? null : nk;
}

// ---- enumerate .ts files in module ----
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
const allFiles = walk(MODDIR, []);

// ---- build move plan: oldAbs -> newAbs ----
const moves = new Map(); // oldAbs -> newAbs
const dirsToRemove = new Set();

// 1+2: directory flattening (implementations/ always; contracts/ if no I[A-Z]*.ts)
const allDirs = new Set();
for (const f of allFiles) {
  let d = path.dirname(f);
  while (d.startsWith(MODDIR)) { allDirs.add(d); d = path.dirname(d); }
}
function dirFilesShallow(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name);
}
const flattenDirs = new Map(); // dirAbs -> targetParentAbs
for (const d of allDirs) {
  const name = path.basename(d);
  if (name === 'implementations') {
    flattenDirs.set(d, path.dirname(d));
  } else if (name === 'contracts') {
    const files = dirFilesShallow(d);
    const hasInterface = files.some(fn => /^I[A-Z].*\.ts$/.test(fn));
    if (!hasInterface) flattenDirs.set(d, path.dirname(d));
  }
}

// Compute provisional location after flatten for each file
function afterFlatten(absPath) {
  // walk up: if any ancestor dir is a flattenDir, lift that segment out
  // Apply repeatedly for nested (train prop-tracking-lab/services/implementations)
  let rel = absPath;
  let changed = true;
  while (changed) {
    changed = false;
    for (const [d, parent] of flattenDirs) {
      const prefix = d + path.sep;
      if (rel.startsWith(prefix)) {
        // file lives under flattenDir d -> move directly into parent preserving subpath beneath d
        const sub = rel.slice(prefix.length); // path beneath the flattened dir
        rel = path.join(parent, sub);
        changed = true;
        break;
      }
    }
  }
  return rel;
}

// 3: kebab rename on basename
for (const f of allFiles) {
  let dest = afterFlatten(f);
  const nb = kebabBasename(path.basename(dest));
  if (nb) dest = path.join(path.dirname(dest), nb);
  if (dest !== f) moves.set(f, dest);
}

// record dirs to remove (flattened dirs), check empty after
for (const d of flattenDirs.keys()) dirsToRemove.add(d);

// ---- resolution: build set of moved real abs paths, map oldAbs(no ext)->info ----
// We must resolve import specifiers to abs files and rewrite only if that abs file moved.
const movedByAbs = new Map(); // normalized abs (with ext) -> newAbs
for (const [o, n] of moves) movedByAbs.set(path.normalize(o), path.normalize(n));

// ---- import rewriting across all of src ----
const SPEC_EXTS = ['', '.ts', '.svelte.ts', '.svelte', '/index.ts', '.js'];
function resolveSpec(fromFile, spec) {
  let baseAbs;
  if (spec.startsWith('$lib/')) {
    baseAbs = path.resolve(SRC, 'lib', spec.slice('$lib/'.length));
  } else if (spec === '$lib') {
    baseAbs = path.resolve(SRC, 'lib');
  } else if (spec.startsWith('.')) {
    baseAbs = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null; // bare package import, not a local file
  }
  // try exact + extension variants
  const candidates = [];
  candidates.push(baseAbs);
  for (const e of ['.ts', '.svelte.ts', '.svelte', '.js']) candidates.push(baseAbs + e);
  candidates.push(path.join(baseAbs, 'index.ts'));
  for (const c of candidates) {
    if (movedByAbs.has(path.normalize(c)) || fs.existsSync(c)) return path.normalize(c);
  }
  return path.normalize(baseAbs);
}

// new abs for a resolved old abs (apply move if moved, else identity)
function newAbsFor(oldAbs) { return movedByAbs.get(oldAbs) || oldAbs; }

function specHadExt(spec) {
  return /\.(ts|svelte|js)$/.test(spec) || spec.endsWith('.svelte.ts');
}

function rewriteFileImports(filePath, virtualMoves) {
  // virtualMoves: function(absResolved) used during dry run before fs changes;
  // we resolve against current fs + planned moves.
  let txt = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  // match relative ('.') and $lib-aliased specifiers on static `from`/`import(` and dynamic import()
  txt = txt.replace(/(\bfrom\s*|\bimport\s*\(\s*)(['"])((?:\.|\$lib)[^'"]+)\2/g, (m, kw, q, spec) => {
    const resolvedOld = resolveSpec(filePath, spec);
    if (!resolvedOld) return m;
    const resolvedNew = newAbsFor(resolvedOld);
    // also: the FROM file itself may move; relative specs are relative to old fromFile location.
    const fromNew = newAbsFor(path.normalize(filePath));
    if (resolvedNew === resolvedOld && fromNew === path.normalize(filePath)) return m;
    const usedAlias = spec.startsWith('$lib');
    let out;
    if (usedAlias) {
      // preserve $lib form: alias is location-independent, so fromNew move doesn't matter
      out = '$lib/' + path.relative(path.join(SRC, 'lib'), resolvedNew).replace(/\\/g, '/');
    } else {
      out = path.relative(path.dirname(fromNew), resolvedNew).replace(/\\/g, '/');
      if (!out.startsWith('.')) out = './' + out;
    }
    // strip extension to match original style unless original had ext
    if (!specHadExt(spec)) {
      out = out.replace(/\.svelte\.ts$/, '').replace(/\.ts$/, '').replace(/\.js$/, '');
      out = out.replace(/\/index$/, ''); // index collapse
    }
    if (out !== spec) changed = true;
    return `${kw}${q}${out}${q}`;
  });
  if (changed && APPLY) fs.writeFileSync(filePath, txt, 'utf8');
  return changed;
}

// ---- DRY RUN report ----
console.log(`\n## MODULE: ${MODULE}  (APPLY=${APPLY})`);
console.log(`flatten dirs (${flattenDirs.size}):`);
for (const [d, p] of flattenDirs) console.log('  - ' + path.relative(SRC, d) + '  -> ' + path.relative(SRC, p));
console.log(`renames/moves (${moves.size}):`);
for (const [o, n] of moves) console.log('  ' + path.relative(SRC, o) + '  =>  ' + path.relative(SRC, n));

// ---- APPLY: git mv (two-phase to avoid case/clobber issues) ----
function gitmv(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  execSync(`git mv -f "${from}" "${to}"`, { cwd: ROOT, stdio: 'pipe' });
}
// ---- rewrite imports across all src files FIRST (files still at OLD paths) ----
// resolveSpec uses fs.existsSync against current (old) layout; newAbsFor maps old->new.
// fromNew is computed from movedByAbs so specifiers inside a to-be-moved file are
// recomputed relative to its FUTURE location. We write to the OLD path; git mv then
// relocates the already-corrected file.
const srcFiles = walk(SRC, []).filter(f => f.endsWith('.ts') || f.endsWith('.svelte'));
const touched = [];
for (const f of srcFiles) {
  if (!fs.existsSync(f)) continue;
  if (rewriteFileImports(f, null)) touched.push(f);
}
console.log(`import sites rewritten (${touched.length}):`);
for (const t of touched) console.log('  ~ ' + path.relative(ROOT, t));

if (APPLY) {
  // do moves: handle case-only renames via temp
  for (const [o, n] of moves) {
    if (o.toLowerCase() === n.toLowerCase() && o !== n) {
      const tmp = o + '.cmtmp';
      gitmv(o, tmp); gitmv(tmp, n);
    } else {
      gitmv(o, n);
    }
  }
  // remove emptied flatten dirs
  for (const d of [...dirsToRemove].sort((a,b)=>b.length-a.length)) {
    try { if (fs.existsSync(d) && fs.readdirSync(d).length === 0) fs.rmdirSync(d); } catch {}
  }
}
