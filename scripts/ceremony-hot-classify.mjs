import fs from 'fs';
import path from 'path';

const root = 'src';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name).split(path.sep).join('/');
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|svelte)$/.test(e.name)) files.push(p);
  }
})(root);

// TRUE hot set = exact uncommitted files (read from scripts/.ceremony-hot-files.txt), normalized.
const hotList = fs
  .readFileSync('scripts/.ceremony-hot-files.txt', 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => s.split(path.sep).join('/'));
const HOT = new Set(hotList);
const isHot = (f) => HOT.has(f);

const importRe = /from\s+["'](\.[^"']+|\$lib[^"']+)["']/g;
function resolveSpec(fromFile, spec) {
  let base;
  if (spec.startsWith('$lib')) base = path.resolve('src/lib', spec.slice(5));
  else base = path.resolve(path.dirname(fromFile), spec);
  const cands = [base, base + '.ts', base + '.svelte', base + '.svelte.ts', base + '.js', base + '/index.ts'];
  for (const c of cands) if (fs.existsSync(c)) return path.relative(process.cwd(), c).split(path.sep).join('/');
  return null;
}

// Candidate modules: all shared/* (except the 3 still-hot dirs) + create subtree as one bucket.
const sharedRoot = 'src/lib/shared';
const sharedMods = fs
  .readdirSync(sharedRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => 'shared/' + e.name);

const modFiles = {};
for (const m of sharedMods) modFiles[m] = files.filter((f) => f.startsWith('src/lib/' + m + '/'));
modFiles['features/create'] = files.filter((f) => f.startsWith('src/lib/features/create/'));

const hotImportsTarget = {};
for (const f of files) {
  if (!isHot(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = importRe.exec(src))) {
    const t = resolveSpec(f, m[1]);
    if (t) hotImportsTarget[t] = true;
  }
}

const safe = [], deferred = [];
for (const [m, fl] of Object.entries(modFiles)) {
  const hotConsumed = fl.some((f) => hotImportsTarget[f]);
  (hotConsumed ? deferred : safe).push(m);
}
console.log('SAFE (no hot consumers) ' + safe.length + ':');
console.log('  ' + safe.sort().join(' '));
console.log();
console.log('DEFERRED (still has hot consumers) ' + deferred.length + ':');
console.log('  ' + deferred.sort().join(' '));
