import fs from 'fs';
import path from 'path';

// Roots = everything handleInit imports, plus the render-time dynamic targets.
const ROOTS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['src/lib/shared/render/services/image-composer.ts', 'src/lib/shared/render/services/seed-override-resolvers.ts'];

function norm(p) { return p.split(path.sep).join('/'); }
function resolve(spec, from) {
  if (spec.startsWith('$app/') || spec.startsWith('@sveltejs/kit')) return { kit: spec };
  let p;
  if (spec.startsWith('$lib')) p = spec.replace('$lib', 'src/lib');
  else if (spec.startsWith('.')) p = norm(path.join(path.dirname(from), spec));
  else return null;
  for (const e of ['', '.ts', '.svelte.ts', '.svelte', '/index.ts', '.js']) {
    const f = p + e;
    try { if (fs.statSync(f).isFile()) return { file: f }; } catch {}
  }
  return null;
}

const STATIC = /(?:^|\n)\s*(import|export)\b[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g;
const DYN = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

let seen, hits;
function walk(file, stack) {
  if (seen.has(file) || stack.length > 45) return;
  seen.add(file);
  let s; try { s = fs.readFileSync(file, 'utf8'); } catch { return; }
  const edges = [];
  let m;
  STATIC.lastIndex = 0;
  while ((m = STATIC.exec(s))) {
    if (/^(import|export)\s+type\b/.test(m[0].trimStart())) continue;
    edges.push({ spec: m[2], dyn: false });
  }
  // DYN disabled (static-only for eval-time crash analysis)
  if(false){ DYN.lastIndex = 0;
  while ((m = DYN.exec(s))) edges.push({ spec: m[1], dyn: true });
  for (const { spec, dyn } of edges) {
    const r = resolve(spec, file);
    if (!r) continue;
    if (r.kit) {
      if (/navigation|forms|stores|paths|@sveltejs\/kit/.test(r.kit)) {
        // Record the entering app-side module (last src file before kit) + via static/dynamic
        hits.push({ entry: stack[1] || file, kit: r.kit, dynAnywhere: stack.dynSeen || dyn, leaf: file });
      }
      continue;
    }
    const ns = [...stack, r.file];
    ns.dynSeen = stack.dynSeen || dyn;
    walk(r.file, ns);
  }
}

const all = [];
for (const root of ROOTS) {
  seen = new Set(); hits = [];
  const s0 = [root]; s0.dynSeen = false;
  walk(root, s0);
  for (const h of hits) all.push({ root, ...h });
}
// Dedup by the leaf module that imports kit + the kit specifier
const uniq = new Map();
for (const h of all) {
  const k = h.leaf + ' :: ' + h.kit;
  if (!uniq.has(k)) uniq.set(k, h);
}
console.log('Distinct SvelteKit-client reaches in worker graph:\n');
for (const h of uniq.values()) {
  console.log(`• ${h.leaf.replace('src/lib/shared/', '~/')}  imports  ${h.kit}`);
}
console.log('\n(' + uniq.size + ' distinct leaf→kit edges)');
