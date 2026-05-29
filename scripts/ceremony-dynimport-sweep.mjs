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

// Catch BOTH static `from "..."` and dynamic `import("...")` — the latter often spans
// lines: import(\n  "..."\n). Use [\s\S] to cross newlines.
const re = /(?:from|import)\s*\(?\s*["'](\.[^"']+|\$lib[^"']+)["']/g;

function resolves(fromFile, spec) {
  let base;
  if (spec.startsWith('$lib')) base = path.resolve('src/lib', spec.slice(5));
  else base = path.resolve(path.dirname(fromFile), spec);
  const cands = [base, base + '.ts', base + '.svelte', base + '.svelte.ts', base + '.js', base + '/index.ts'];
  // TS/Vite source resolution: a `.js` specifier (incl. `.svelte.js`) maps to `.ts` source.
  if (base.endsWith('.js')) cands.push(base.replace(/\.js$/, '.ts'));
  return cands.some((c) => fs.existsSync(c));
}

const stale = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(src))) {
    if (!resolves(f, m[1])) stale.push(f + '  ->  ' + m[1]);
  }
}
console.log('UNRESOLVABLE specifiers (static + dynamic) across src/: ' + stale.length);
stale.forEach((s) => console.log('  ' + s));
