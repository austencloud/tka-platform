// Live-vs-dead + getter analysis for SAFE Phase 5 candidates.
const fs = require('fs');
const path = require('path');
const r = require('./phase5-shape.json');
const safe = r.filter((x) => !x.tangled);

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.svelte-kit') continue;
      walk(p);
    } else if (/\.(ts|svelte)$/.test(e.name)) {
      files.push(p.replace(/\\/g, '/'));
    }
  }
})('src');
const T = files.map((p) => ({ p, t: fs.readFileSync(p, 'utf8') }));

for (const c of safe) {
  const self = c.path.split('/').pop();
  const imports = [];
  const news = [];
  const reImport = new RegExp('import[^;]*\\b' + c.name + '\\b[^;]*from');
  const reNew = new RegExp('new ' + c.name + '\\(');
  for (const { p, t } of T) {
    if (p.endsWith('/' + self)) continue;
    if (reImport.test(t)) imports.push(p.split('/').slice(-2).join('/'));
    if (reNew.test(t)) news.push(p.split('/').slice(-2).join('/'));
  }
  const selfTxt = T.find((x) => x.p.endsWith('/' + self))?.t || '';
  const getMatch = selfTxt.match(/export (?:function|const) (get\w+|provide\w+)/g) || [];
  const live = imports.length > 0 ? 'LIVE' : 'DEAD?';
  console.log(`${live}  ${c.name.padEnd(30)} imp:${imports.length} new:${news.length} getter:${getMatch.join(',') || '-'}`);
  if (imports.length) console.log('      by: ' + imports.join(', '));
}
