// One-shot mechanical transform for src/lib/features/create only.
// Transforms: flatten services/implementations -> services, collapse contracts
// (move types.ts up; keep polymorphic ILOOPExecutor), kebab-rename PascalCase/getX
// .ts files, rewrite all import sites in src/ via resolution-based matching.
// ZERO behavior change.
//
// Usage: node scripts/ceremony-create-transform.mjs [--apply]

import fs from 'fs';
import path from 'path';

const APPLY = process.argv.includes('--apply');
const ROOT = path.resolve('.').split(path.sep).join('/');
const SRC = ROOT + '/src';
const CREATE = SRC + '/lib/features/create';

const HOT = new Set(
  fs
    .readFileSync('scripts/.ceremony-hot-files.txt', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((p) => ROOT + '/' + p.replace(/\\/g, '/'))
);

function pascalToKebab(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function kebabName(filename) {
  if (/^I[A-Z].*\.ts$/.test(filename)) return filename; // interface file: skip
  const svelteTs = filename.match(/^(.+)\.svelte\.ts$/);
  if (svelteTs) {
    const stem = svelteTs[1];
    if (!/[A-Z]/.test(stem) && !/^get[A-Z]/.test(stem)) return filename;
    if (!/^[A-Z]/.test(stem) && !/^get[A-Z]/.test(stem)) return filename;
    return pascalToKebab(stem) + '.svelte.ts';
  }
  const m = filename.match(/^(.+?)((?:\.test)?\.ts)$/);
  if (!m) return filename;
  const stem = m[1];
  const ext = m[2];
  if (!/^[A-Z]/.test(stem) && !/^get[A-Z]/.test(stem)) return filename;
  return pascalToKebab(stem) + ext;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.svelte-kit') continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

// ── Build rename map (old abs -> new abs) ──
const renameMap = new Map();
function planMove(oldAbs, newAbs) {
  if (oldAbs === newAbs) return;
  if (HOT.has(oldAbs)) {
    console.warn('SKIP HOT FILE:', oldAbs);
    return;
  }
  renameMap.set(oldAbs, newAbs);
}
function applyKebabToPath(abs) {
  const dir = abs.slice(0, abs.lastIndexOf('/'));
  const base = abs.slice(abs.lastIndexOf('/') + 1);
  if (!base.endsWith('.ts')) return abs;
  return dir + '/' + kebabName(base);
}

function flattenDir(implDir, servicesDir) {
  if (!fs.existsSync(implDir)) return;
  for (const e of fs.readdirSync(implDir, { withFileTypes: true })) {
    const src = implDir + '/' + e.name;
    if (e.isDirectory()) {
      const destSub = servicesDir + '/' + e.name;
      for (const f of walk(src)) {
        const relUnder = f.slice(src.length);
        planMove(f, applyKebabToPath(destSub + relUnder));
      }
    } else {
      planMove(src, applyKebabToPath(servicesDir + '/' + e.name));
    }
  }
}

const implDirs = [
  'construct/option-picker/services/implementations',
  'construct/start-position-picker/services/implementations',
  'generate/circular/services/implementations',
  'generate/shared/services/implementations',
  'shared/services/implementations',
  'shared/workspace-panel/sequence-display/services/implementations',
  'shared/workspace-panel/shared/services/implementations',
  'spell/services/implementations',
];
for (const d of implDirs) {
  const implDir = CREATE + '/' + d;
  const servicesDir = implDir.slice(0, implDir.lastIndexOf('/'));
  flattenDir(implDir, servicesDir);
}

const contractsTypesMoves = [
  'construct/option-picker/services/contracts/types.ts',
  'shared/workspace-panel/sequence-display/services/contracts/types.ts',
  'spell/services/contracts/types.ts',
];
for (const rel of contractsTypesMoves) {
  const abs = CREATE + '/' + rel;
  if (!fs.existsSync(abs)) continue;
  const servicesDir = abs.slice(0, abs.indexOf('/contracts/'));
  planMove(abs, servicesDir + '/types.ts');
}

// kebab-rename remaining create .ts files
for (const f of walk(CREATE)) {
  if (!f.endsWith('.ts')) continue;
  if (renameMap.has(f)) continue;
  const renamed = applyKebabToPath(f);
  if (renamed !== f) planMove(f, renamed);
}

// sidecars
for (const [oldAbs, newAbs] of [...renameMap.entries()]) {
  if (!oldAbs.endsWith('.ts') || oldAbs.endsWith('.d.ts')) continue;
  const oldStem = oldAbs.slice(0, -3);
  const newStem = newAbs.slice(0, -3);
  for (const ext of ['.js', '.d.ts']) {
    const oldSide = oldStem + ext;
    if (fs.existsSync(oldSide) && !renameMap.has(oldSide)) planMove(oldSide, newStem + ext);
  }
}

console.log(`Planned ${renameMap.size} file moves/renames.`);

// ── Virtual existence (accounts for planned moves) ──
const movedTo = new Map([...renameMap.entries()].map(([o, n]) => [n, o]));
// Resolve a candidate to a CURRENT-ON-DISK file (old tree). Then map old->new.
function existsOld(abs) {
  return fs.existsSync(abs);
}
function candidatePaths(base) {
  const c = [base, base + '.ts', base + '.svelte', base + '.svelte.ts', base + '.js', base + '/index.ts'];
  if (base.endsWith('.js')) c.push(base.replace(/\.js$/, '.ts'));
  if (base.endsWith('.svelte')) c.push(base + '.ts');
  return c;
}
// fromFileAbsOld: resolve specifiers against the file's CURRENT (pre-move) location,
// because that's where the relative path is anchored in the source we read.
function resolveSpecOld(fromFileAbsOld, spec) {
  let base;
  if (spec.startsWith('$lib')) base = path.resolve(SRC + '/lib', spec.slice(5)).split(path.sep).join('/');
  else if (spec.startsWith('.')) base = path.resolve(fromFileAbsOld.slice(0, fromFileAbsOld.lastIndexOf('/')), spec).split(path.sep).join('/');
  else return null;
  for (const c of candidatePaths(base)) if (existsOld(c)) return c;
  return null;
}
function afterMove(abs) {
  return renameMap.get(abs) || abs;
}

// Build the new specifier preserving the original's extension style.
function buildSpec(fromFileAbsNew, targetAbsNew, originalSpec) {
  let p;
  if (originalSpec.startsWith('$lib')) {
    p = '$lib/' + targetAbsNew.slice((SRC + '/lib/').length);
  } else {
    let rel = path.relative(fromFileAbsNew.slice(0, fromFileAbsNew.lastIndexOf('/')), targetAbsNew).split(path.sep).join('/');
    if (!rel.startsWith('.')) rel = './' + rel;
    p = rel;
  }
  // Match extension style of original
  if (originalSpec.endsWith('.svelte.ts')) return p; // keep
  if (originalSpec.endsWith('.svelte')) return p.replace(/\.svelte\.ts$/, '.svelte').replace(/\.ts$/, '');
  if (originalSpec.endsWith('.js')) return p.replace(/\.svelte\.ts$/, '.svelte.js').replace(/\.ts$/, '.js');
  if (originalSpec.endsWith('.ts') && !originalSpec.endsWith('.d.ts')) return p; // explicit .ts kept
  // default: extensionless
  return p.replace(/\.svelte\.ts$/, '.svelte').replace(/\.ts$/, '');
}

// Matches static + dynamic (incl. cross-line) specifiers. Captures the quoted spec.
const specRe = /(from\s*|import\s*\(\s*|import\s+)(["'])(\.[^"']+|\$lib[^"']+)\2/g;

const edits = [];
const pendingWrites = new Map(); // newAbs -> content
function rewriteFile(fileAbsOld) {
  const fileAbsNew = afterMove(fileAbsOld);
  const original = fs.readFileSync(fileAbsOld, 'utf8');
  let changed = 0;
  const fileMoved = fileAbsOld !== fileAbsNew;

  const next = original.replace(specRe, (full, lead, q, spec) => {
    const resolvedOld = resolveSpecOld(fileAbsOld, spec);
    if (!resolvedOld) return full;
    const targetNew = afterMove(resolvedOld); // map old->new (identity if not moved)
    const targetMoved = targetNew !== resolvedOld;
    if (!fileMoved && !targetMoved) return full;
    const newSpec = buildSpec(fileAbsNew, targetNew, spec);
    if (newSpec === spec) return full;
    changed++;
    return lead + q + newSpec + q;
  });

  if (changed > 0) {
    edits.push({ file: fileAbsNew, count: changed });
    pendingWrites.set(fileAbsNew, next);
  }
}

const allSrc = walk(SRC).filter((f) => /\.(ts|svelte)$/.test(f));
for (const f of allSrc) {
  if (HOT.has(f)) continue;
  rewriteFile(f);
}

console.log(`Import rewrites: ${edits.length} files affected, ${edits.reduce((s, e) => s + e.count, 0)} specifiers.`);

// ── SAFETY GUARD: nothing forbidden in moves or edits ──
const forbidden = (abs) =>
  abs.includes('/lib/shared/render') || abs.includes('/lib/shared/3d') || HOT.has(abs);
const badMoves = [...renameMap.keys()].filter(forbidden).concat([...renameMap.values()].filter(forbidden));
const badEdits = edits.map((e) => e.file).filter(forbidden);
if (badMoves.length || badEdits.length) {
  console.error('FORBIDDEN PATHS DETECTED — aborting:');
  [...new Set([...badMoves, ...badEdits])].forEach((p) => console.error('  ', p));
  process.exit(2);
}
// Report out-of-create edited files (legit cross-module consumers).
const outside = edits.map((e) => e.file).filter((f) => !f.startsWith(CREATE + '/'));
console.log(`Out-of-create consumer files edited: ${outside.length}`);

if (!APPLY) {
  console.log('\n--- DRY RUN ---');
  console.log('Sample moves:');
  [...renameMap.entries()].slice(0, 12).forEach(([o, n]) => console.log('  ', o.slice(CREATE.length + 1), '->', n.slice(CREATE.length + 1)));
  console.log('Sample rewrites:');
  edits.slice(0, 12).forEach((e) => console.log('  ', e.count, e.file.slice(SRC.length + 1)));
  process.exit(0);
}

// APPLY: write rewritten content to pre-move paths, then move.
const contentByOld = new Map();
for (const [newAbs, content] of pendingWrites) {
  const oldAbs = movedTo.get(newAbs) || newAbs;
  contentByOld.set(oldAbs, content);
}
for (const [oldAbs, content] of contentByOld) fs.writeFileSync(oldAbs, content);

for (const [oldAbs, newAbs] of renameMap) {
  const dir = newAbs.slice(0, newAbs.lastIndexOf('/'));
  fs.mkdirSync(dir, { recursive: true });
  if (oldAbs.toLowerCase() === newAbs.toLowerCase() && oldAbs !== newAbs) {
    const tmp = oldAbs + '.ceremonytmp';
    fs.renameSync(oldAbs, tmp);
    fs.renameSync(tmp, newAbs);
  } else {
    fs.renameSync(oldAbs, newAbs);
  }
}

// Clean up now-empty implementations/ and emptied contracts/ dirs.
function rmEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) rmEmptyDirs(dir + '/' + e.name);
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
for (const d of implDirs) rmEmptyDirs(CREATE + '/' + d);
for (const rel of contractsTypesMoves) {
  const cdir = (CREATE + '/' + rel).replace(/\/types\.ts$/, '');
  rmEmptyDirs(cdir);
}
rmEmptyDirs(CREATE + '/generate/shared/services/contracts');

console.log('APPLIED moves + rewrites + dir cleanup.');
