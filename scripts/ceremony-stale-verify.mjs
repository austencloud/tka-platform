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

// Only flag stale imports that target the 13 processed modules (avoid pre-existing noise elsewhere).
const MODS = ['error','platform','delight','audio','debug','push','messaging','subscription','comparison','video','multi-grid','sync','voice-control']
  .map((m) => 'src/lib/shared/' + m + '/');
const targetsOurMods = (abs) => MODS.some((m) => abs.startsWith(m));

const importRe = /from\s+["'](\.[^"']+|\$lib[^"']+)["']/g;
function exists(base) {
  const c = [base, base + '.ts', base + '.svelte', base + '.svelte.ts', base + '.js', base + '/index.ts'];
  return c.some((x) => fs.existsSync(x));
}
function rel(abs) { return path.relative(process.cwd(), abs).split(path.sep).join('/'); }

const stale = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = importRe.exec(src))) {
    const spec = m[1];
    let base;
    if (spec.startsWith('$lib')) base = path.resolve('src/lib', spec.slice(5));
    else base = path.resolve(path.dirname(f), spec);
    const absRel = rel(base);
    // Only care about specifiers that point INTO one of our 13 modules
    if (!targetsOurMods(absRel)) continue;
    if (!exists(base)) stale.push(f + '  ->  ' + spec);
  }
}
console.log('STALE imports targeting the 13 modules: ' + stale.length);
stale.forEach((s) => console.log('  ' + s));
