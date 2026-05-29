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

const HOT = [
  'src/lib/shared/animation-engine/',
  'src/lib/shared/3d/',
  'src/lib/shared/sequence-viewer/',
  'src/lib/features/choreo-card/',
  'src/lib/features/create/',
  'src/lib/features/admin/',
];
const isHot = (f) => HOT.some((h) => f.startsWith(h));

const importRe = /from\s+["'](\.[^"']+|\$lib[^"']+)["']/g;
function resolveSpec(fromFile, spec) {
  let base;
  if (spec.startsWith('$lib')) base = path.resolve('src/lib', spec.slice(5));
  else base = path.resolve(path.dirname(fromFile), spec);
  const cands = [base, base + '.ts', base + '.svelte', base + '.svelte.ts', base + '.js', base + '/index.ts'];
  for (const c of cands) if (fs.existsSync(c)) return path.relative(process.cwd(), c).split(path.sep).join('/');
  return null;
}

const sharedRoot = 'src/lib/shared';
const mods = fs
  .readdirSync(sharedRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((m) => !['animation-engine', '3d', 'sequence-viewer'].includes(m));

const modFiles = {};
for (const m of mods) modFiles[m] = files.filter((f) => f.startsWith(sharedRoot + '/' + m + '/'));

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
for (const m of mods) {
  const hotConsumed = modFiles[m].some((f) => hotImportsTarget[f]);
  (hotConsumed ? deferred : safe).push(m);
}
console.log('SAFE (no hot consumers) ' + safe.length + ':');
console.log('  ' + safe.sort().join(' '));
console.log();
console.log('DEFERRED (hot consumers exist) ' + deferred.length + ':');
console.log('  ' + deferred.sort().join(' '));
