// Blast-radius analysis for Phase 5 candidates.
// CLEAN  = only used via getX().method() (trivial getter retirement) — low risk.
// TANGLED = also `new`'d directly or referenced as a type/param — higher risk,
//           conversion forces type-annotation + instantiation-site rewrites.
const fs = require('fs');
const path = require('path');
const m = require('./ceremony-manifest.json');

const cand = [];
for (const files of Object.values(m.modules)) {
  for (const f of files) {
    const c = f.classification;
    if (c && /^stateless/.test(c.classification)) {
      cand.push({ name: c.className, cls: c.classification, path: f.relativePath.replace(/\\/g, '/'), consumers: f.consumerCount });
    }
  }
}

const srcFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.svelte-kit') continue;
      walk(p);
    } else if (/\.(ts|svelte)$/.test(e.name)) {
      srcFiles.push(p.replace(/\\/g, '/'));
    }
  }
})('src');
const texts = srcFiles.map((p) => ({ p, t: fs.readFileSync(p, 'utf8') }));

const res = cand.map((c) => {
  const selfFile = c.path.split('/').pop();
  let newC = 0, typeC = 0;
  const reNew = new RegExp('new ' + c.name + '\\(');
  const reType = new RegExp('(:\\s*|<|as\\s+)' + c.name + '(\\b|>|\\[)');
  for (const { p, t } of texts) {
    if (p.endsWith('/' + selfFile)) continue;
    if (p.endsWith('/get' + c.name + '.ts')) continue;
    if (reNew.test(t)) newC++;
    if (reType.test(t)) typeC++;
  }
  return { ...c, newC, typeC, tangled: newC > 0 || typeC > 0 };
});

const clean = res.filter((r) => !r.tangled);
const tangled = res.filter((r) => r.tangled);
console.log('CLEAN:', clean.length, ' TANGLED:', tangled.length, ' / 111');
console.log('');
console.log('=== TANGLED (new or type-referenced — higher risk) ===');
tangled.sort((a, b) => (b.newC + b.typeC) - (a.newC + a.typeC));
tangled.forEach((r) => console.log('  ' + r.name.padEnd(36) + ' new:' + r.newC + ' type:' + r.typeC + ' consumers:' + r.consumers));
fs.writeFileSync('scripts/phase5-shape.json', JSON.stringify(res, null, 1));
console.log('\nwrote scripts/phase5-shape.json');
