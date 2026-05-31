import fs from 'fs'; import path from 'path';
function norm(p){return p.split(path.sep).join('/');}
function resolve(spec,from){ if(spec.startsWith('$app/')||spec.startsWith('@sveltejs/kit'))return{kit:spec}; let p; if(spec.startsWith('$lib'))p=spec.replace('$lib','src/lib'); else if(spec.startsWith('.'))p=norm(path.join(path.dirname(from),spec)); else return null; for(const e of ['','.ts','.svelte.ts','.svelte','/index.ts','.js']){const f=p+e; try{if(fs.statSync(f).isFile())return{file:f};}catch{}} return null;}
let seen,chains;
function isType(line){return /^\s*import\s+type\b/.test(line)||/^\s*export\s+type\b/.test(line);}
function walk(file,stack){ if(seen.has(file)||stack.length>30)return; seen.add(file); let s; try{s=fs.readFileSync(file,'utf8');}catch{return;} const lines=s.split('\n');
  const re=/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]/g; let m;
  while((m=re.exec(s))){const sp=m[1]||m[2]; if(!sp)continue;
    // find the line of this match to skip type-only imports
    const upto=s.slice(0,m.index); const lineNo=upto.split('\n').length-1; const line=lines[lineNo]||'';
    if(isType(line))continue;
    const r=resolve(sp,file); if(!r)continue;
    if(r.kit){ if(/navigation|forms|stores|@sveltejs\/kit/.test(r.kit)) chains.push([...stack,file,'>>> '+r.kit]); continue;}
    walk(r.file,[...stack,file]);}}
const ROOTS=['src/lib/shared/render/services/seed-override-resolvers.ts','src/lib/shared/render/services/image-composer.ts'];
for(const root of ROOTS){seen=new Set();chains=[];walk(root,[]);
  console.log('\n=== '+root.replace('src/lib/shared/','~/')+' (runtime-only, → nav/forms/stores/kit) ===');
  if(!chains.length)console.log('  none');
  for(const c of chains.slice(0,3))console.log('  '+c.map(x=>x.replace('src/lib/shared/','~/')).join('\n   -> '));}
