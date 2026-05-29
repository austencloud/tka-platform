/**
 * Ceremony Flatten + Kebab Rename — single module at a time.
 *
 * For ONE module (src/lib/shared/<module>):
 *  1. Flatten services/implementations/* -> services/  (incl. subdirs)
 *  2. Collapse services/contracts/ : types-only -> services/, then delete dir; empty -> delete.
 *     (NEVER touches I[A-Z]*.ts — interface cull is handled separately/manually.)
 *  3. Kebab-rename PascalCase / camelCase-getter .ts files in the module.
 *     - Preserve .svelte.ts double-ext.
 *     - DO NOT rename .svelte components or I[A-Z]*.ts interfaces.
 *  4. Resolution-based import rewrite across ALL of src/.
 *
 * Produces a plan of git-mv operations + a set of in-file import edits.
 * Outputs shell commands for git mv (so renames are tracked) and applies
 * file content edits directly.
 *
 * Usage: node scripts/ceremony-flatten-kebab.cjs <module> [--apply]
 *   Without --apply: prints the plan (dry run), writes NOTHING.
 *   With --apply: performs git mv + content edits.
 *
 * NOTE: git mv is emitted as a batch shell script to stdout when --emit-mv is set;
 * by default with --apply we shell out to `git mv` ourselves.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MODULE = process.argv[2];
const APPLY = process.argv.includes('--apply');
// Repo-relative paths to EXCLUDE from any move (edge cases recorded in report).
const SKIP_ARG = process.argv.find(a => a.startsWith('--skip='));
const SKIP_PATHS = new Set(
  (SKIP_ARG ? SKIP_ARG.split('=')[1].split(',') : []).map(s => s.replace(/\\/g, '/'))
);

if (!MODULE) {
  console.error('Usage: node scripts/ceremony-flatten-kebab.cjs <module> [--apply]');
  process.exit(1);
}

const MOD_REL = `src/lib/shared/${MODULE}`;
const MOD_ABS = path.resolve(ROOT, MOD_REL);
if (!fs.existsSync(MOD_ABS)) {
  console.error(`Module not found: ${MOD_REL}`);
  process.exit(1);
}

// Files the parallel session owns — NEVER touch.
const FORBIDDEN = new Set([
  'src/lib/features/choreo-card/services/card-back/__tests__/card-back-job-builder.test.ts',
  'src/lib/features/choreo-card/services/card-back/__tests__/gradient-parse.test.ts',
  'src/lib/features/choreo-card/services/card-back/card-back-job-builder.ts',
  'src/lib/features/choreo-card/services/card-back/gradient-parse.ts',
  'src/lib/features/choreo-card/services/deck-variation.ts',
  'src/lib/shared/animation-engine/components/AnimatorCanvas.svelte',
  'src/lib/shared/animation-engine/components/SplitCanvasView.svelte',
  'src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte',
  'src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte',
  'src/routes/test/deck-variation/+page.svelte',
].map(p => p.replace(/\\/g, '/')));

// ---------------- kebab algorithm ----------------
// insert '-' before uppercase following lowercase/digit, and between ([A-Z]+)([A-Z][a-z]); lowercase.
function kebab(stem) {
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Should this .ts file be renamed? PascalCase or camelCase-getter.
// Skip: I[A-Z]*.ts interfaces. (.svelte handled separately — not .ts.)
function shouldRename(basename) {
  // basename WITHOUT directory, WITH extension(s)
  if (basename.endsWith('.svelte')) return false; // svelte component
  // strip extension(s)
  let stem = basename;
  let ext = '';
  if (stem.endsWith('.svelte.ts')) { ext = '.svelte.ts'; stem = stem.slice(0, -'.svelte.ts'.length); }
  else if (stem.endsWith('.ts')) { ext = '.ts'; stem = stem.slice(0, -'.ts'.length); }
  else return false;
  // I[A-Z]* interface => skip
  if (/^I[A-Z]/.test(stem)) return false;
  // Already kebab/lowercase (no uppercase) => no rename needed
  if (!/[A-Z]/.test(stem)) return false;
  return { stem, ext };
}

function kebabBasename(basename) {
  const r = shouldRename(basename);
  if (!r) return basename;
  return kebab(r.stem) + r.ext;
}

// ---------------- gather all src files ----------------
const allFiles = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      walk(full);
    } else {
      allFiles.push(path.relative(ROOT, full).replace(/\\/g, '/'));
    }
  }
}
walk(path.join(ROOT, 'src'));

const importableExts = ['.ts', '.svelte.ts', '.svelte', '.js'];
const fileSet = new Set(allFiles);

// ---------------- build move plan for this module ----------------
// move: { from, to }  (both repo-relative, posix)
const moves = [];
const moveMap = new Map(); // from -> to

function planMove(from, to) {
  if (from === to) return;
  if (FORBIDDEN.has(from) || FORBIDDEN.has(to)) {
    throw new Error(`Refusing to move forbidden path: ${from} -> ${to}`);
  }
  // Collision guard: target already exists on disk and isn't itself being vacated.
  if (fileSet.has(to) && !moveMap.has(to) && to !== from) {
    throw new Error(`COLLISION: ${from} -> ${to} (target already exists). Add to --skip= and handle as edge case.`);
  }
  moves.push({ from, to });
  moveMap.set(from, to);
}

// Gather module .ts/.svelte files (current on disk)
const modFiles = allFiles.filter(f => f.startsWith(MOD_REL + '/'));

// Step 1 + 2: directory relocations (flatten implementations, collapse contracts)
// Compute new directory for each file, then apply kebab to basename.
function relocateDir(relPath) {
  // returns new dir-relative path (still with original basename)
  let p = relPath;
  // implementations flatten: services/implementations/<rest> -> services/<rest>
  p = p.replace(
    new RegExp(`(${MOD_REL}/(?:[^/]+/)*?services)/implementations/`),
    '$1/'
  );
  // contracts collapse: services/contracts/types.ts (and other non-interface) -> services/
  // Only collapse if dir has NO I[A-Z]*.ts file. Decided at module level below.
  return p;
}

// Determine contracts collapse eligibility: find all contracts dirs in module
const contractsDirs = new Set();
for (const f of modFiles) {
  const m = f.match(new RegExp(`(${MOD_REL}/(?:[^/]+/)*?services/contracts)/`));
  if (m) contractsDirs.add(m[1]);
}
const collapsibleContracts = new Set();
for (const dir of contractsDirs) {
  const filesInDir = modFiles.filter(f => f.startsWith(dir + '/'));
  const hasInterface = filesInDir.some(f => /\/I[A-Z][^/]*\.ts$/.test(f));
  if (!hasInterface) collapsibleContracts.add(dir);
}

for (const f of modFiles) {
  if (FORBIDDEN.has(f)) continue;
  if (SKIP_PATHS.has(f)) continue;
  let newPath = relocateDir(f);
  // contracts collapse
  for (const dir of collapsibleContracts) {
    if (newPath.startsWith(dir + '/')) {
      const rest = newPath.slice((dir + '/').length); // e.g. types.ts
      // parent of contracts = services
      const parent = dir.replace(/\/contracts$/, '');
      newPath = parent + '/' + rest;
    }
  }
  // kebab the basename
  const dir = path.posix.dirname(newPath);
  const base = path.posix.basename(newPath);
  const newBase = kebabBasename(base);
  newPath = dir + '/' + newBase;
  if (newPath !== f) planMove(f, newPath);
}

// ---------------- resolution helpers ----------------
// Resolve an import specifier from a given importer file to a repo-relative path (pre-move).
function resolveSpecifier(importerRel, spec) {
  let basePath;
  if (spec.startsWith('.')) {
    basePath = path.posix.normalize(path.posix.join(path.posix.dirname(importerRel), spec));
  } else if (spec.startsWith('$lib/')) {
    basePath = 'src/lib/' + spec.slice('$lib/'.length);
  } else {
    return null; // bare package or alias we don't handle
  }
  // Try candidates
  // 1. exact (if spec already had extension)
  const candidates = [];
  if (/\.(ts|js|svelte)$/.test(basePath)) {
    candidates.push(basePath);
    // a .svelte spec may actually be a .svelte.ts module
    if (basePath.endsWith('.svelte')) candidates.push(basePath + '.ts');
  } else {
    for (const ext of ['.ts', '.svelte.ts', '.svelte', '.js']) candidates.push(basePath + ext);
    // index
    for (const ext of ['.ts', '.js']) candidates.push(basePath + '/index' + ext);
  }
  for (const c of candidates) {
    if (fileSet.has(c)) return c;
  }
  return null;
}

// Compute new specifier given importer's (possibly new) location and target's new location.
function makeSpecifier(importerNewRel, targetNewRel, originalSpec) {
  // preserve $lib style if original used it
  const usesAlias = originalSpec.startsWith('$lib/');
  // Decide the suffix to keep: if original spec ended in .svelte (pointing at .svelte.ts), keep .svelte.
  // Determine target "import path" (strip .ts, keep .svelte for components, special-case .svelte.ts).
  let targetImport = targetNewRel;
  const origHadExt = /\.(ts|js|svelte)$/.test(originalSpec);
  if (targetNewRel.endsWith('.svelte.ts')) {
    // module imported as .svelte (no .ts) typically
    if (originalSpec.endsWith('.svelte')) targetImport = targetNewRel.slice(0, -'.ts'.length); // -> .svelte
    else if (originalSpec.endsWith('.svelte.ts')) targetImport = targetNewRel; // explicit
    else targetImport = targetNewRel.slice(0, -'.ts'.length); // default to .svelte (matches resolver)
  } else if (targetNewRel.endsWith('.ts')) {
    targetImport = origHadExt && originalSpec.endsWith('.ts') ? targetNewRel : targetNewRel.slice(0, -'.ts'.length);
  } else if (targetNewRel.endsWith('.js')) {
    targetImport = origHadExt ? targetNewRel : targetNewRel.slice(0, -'.js'.length);
  } else if (targetNewRel.endsWith('.svelte')) {
    targetImport = targetNewRel; // components keep .svelte
  }

  if (usesAlias) {
    if (targetImport.startsWith('src/lib/')) {
      return '$lib/' + targetImport.slice('src/lib/'.length);
    }
  }
  // relative
  let rel = path.posix.relative(path.posix.dirname(importerNewRel), targetImport);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// ---------------- import rewriting across all of src ----------------
// For each file in src, find import/export-from/dynamic-import specifiers,
// resolve, and if the resolved target is in moveMap, rewrite to new spec
// using the importer's NEW location (importer may itself be moving).

const importRe = /(import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s*|export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s*|import\s*|import\(\s*)(['"])([^'"]+)(\2)/g;

const edits = []; // { file, from(spec), to(spec), line }
const fileNewContent = new Map();
let rewriteSites = 0;

for (const f of allFiles) {
  if (!/\.(ts|svelte|js)$/.test(f)) continue;
  if (FORBIDDEN.has(f)) continue;
  const abs = path.resolve(ROOT, f);
  let content = fs.readFileSync(abs, 'utf-8');
  let changed = false;

  const importerNew = moveMap.get(f) || f;
  const importerMoved = moveMap.has(f);

  const newContent = content.replace(importRe, (full, pre, q1, spec, q2) => {
    const resolved = resolveSpecifier(f, spec);
    if (!resolved) return full;
    // Target file is being renamed/moved -> rewrite to its new location.
    if (moveMap.has(resolved)) {
      const targetNew = moveMap.get(resolved);
      const newSpec = makeSpecifier(importerNew, targetNew, spec);
      if (newSpec === spec) return full;
      rewriteSites++;
      edits.push({ file: f, from: spec, to: newSpec });
      changed = true;
      return pre + q1 + newSpec + q2;
    }
    // SELF-RELATIVE RE-ANCHOR: importer itself is moving but this target is NOT.
    // A relative specifier's depth changes; recompute against importer's new dir.
    // (Alias/$lib and bare specifiers are location-independent — skip.)
    if (importerMoved && spec.startsWith('.')) {
      const newSpec = makeSpecifier(importerNew, resolved, spec);
      if (newSpec === spec) return full;
      rewriteSites++;
      edits.push({ file: f, from: spec, to: newSpec, reanchor: true });
      changed = true;
      return pre + q1 + newSpec + q2;
    }
    return full;
  });

  if (changed) fileNewContent.set(f, newContent);
}

// ---------------- report ----------------
console.log(`\n=== MODULE: ${MODULE} ${APPLY ? '(APPLY)' : '(DRY RUN)'} ===`);
console.log(`\nCollapsible contracts dirs: ${[...collapsibleContracts].join(', ') || '(none)'}`);
const keptContracts = [...contractsDirs].filter(d => !collapsibleContracts.has(d));
console.log(`Kept contracts dirs (have interface): ${keptContracts.join(', ') || '(none)'}`);
console.log(`\nMoves (${moves.length}):`);
for (const m of moves) console.log(`  ${m.from}\n    -> ${m.to}`);
console.log(`\nImport rewrite sites: ${rewriteSites} across ${fileNewContent.size} files`);
const editsByFile = {};
for (const e of edits) (editsByFile[e.file] ||= []).push(e);
for (const [file, es] of Object.entries(editsByFile)) {
  console.log(`  ${file}:`);
  for (const e of es) console.log(`      ${e.from}  ->  ${e.to}`);
}

if (!APPLY) {
  console.log('\n(dry run — nothing written)');
  process.exit(0);
}

// ---------------- apply ----------------
// 1) content edits first (paths are pre-move; edits reference current files by old path)
//    But files that are themselves moving need their content written to the NEW path after git mv.
//    Strategy: write content edits to OLD path on disk now (git mv preserves content), then git mv.
for (const [file, content] of fileNewContent) {
  fs.writeFileSync(path.resolve(ROOT, file), content, 'utf-8');
}

// 2) git mv each move. Ensure target dir exists.
function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}
for (const m of moves) {
  const toDir = path.posix.dirname(m.to);
  fs.mkdirSync(path.resolve(ROOT, toDir), { recursive: true });
  // git mv; if target basename differs only by case on a case-insensitive FS, use a two-step.
  const fromAbs = m.from;
  const toAbs = m.to;
  try {
    sh(`git mv -- "${fromAbs}" "${toAbs}"`);
  } catch (e) {
    // case-only rename fallback
    const tmp = toAbs + '.tmprename';
    sh(`git mv -- "${fromAbs}" "${tmp}"`);
    sh(`git mv -- "${tmp}" "${toAbs}"`);
  }
}

// 3) remove now-empty implementations/ and collapsed contracts/ dirs
function rmEmptyDirs(startRel) {
  const startAbs = path.resolve(ROOT, startRel);
  if (!fs.existsSync(startAbs)) return;
  // walk bottom-up
  const dirs = [];
  (function collect(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) collect(path.join(d, e.name));
    }
    dirs.push(d);
  })(startAbs);
  for (const d of dirs) {
    try {
      if (fs.readdirSync(d).length === 0) fs.rmdirSync(d);
    } catch {}
  }
}
rmEmptyDirs(MOD_REL);

// Emit the exact set of paths to stage: new move targets + old move sources
// (sources may still need staging as deletions) + content-edited files.
const stagePaths = new Set();
for (const m of moves) { stagePaths.add(m.from); stagePaths.add(m.to); }
for (const f of fileNewContent.keys()) stagePaths.add(f);
fs.writeFileSync(
  path.resolve(ROOT, 'scripts/.ceremony-stage-paths.txt'),
  [...stagePaths].join('\n') + '\n',
  'utf-8'
);

console.log('\nAPPLIED. Stage paths written to scripts/.ceremony-stage-paths.txt');
