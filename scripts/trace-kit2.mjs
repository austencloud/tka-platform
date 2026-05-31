import fs from 'fs'; import path from 'path';
function norm(p){return p.split(path.sep).join('/');}
function resolve(spec,from){ if(spec.startsWith('$app/')||spec.startsWith('@sveltejs/kit'))return{kit:spec}; let p; if(spec.startsWith('$lib'))p=spec.replace('$lib','src/lib'); else if(spec.startsWith('.'))p=norm(path.join(path.dirname(from),spec)); else return null; for(const e of ['','.ts','.svelte.ts','.svelte','/index.ts','.js']){const f=p+e; try{if(fs.statSync(f).isFile())return{file:f};}catch{}} return null;}
let seen,chains;
function walk(file,stack){ if(seen.has(file)||stack.length>30)return; seen.add(file); let s; try{s=fs.readFileSync(file,'utf8');}catch{return;} const re=/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]/g; let m; while((m=re.exec(s))){const sp=m[1]||m[2]; if(!sp)continue; const r=resolve(sp,file); if(!r)continue; if(r.kit){if(r.kit.includes('navigation')||r.kit.includes('forms')||r.kit.includes('stores')||r.kit.includes('@sveltejs/kit'))chains.push([...stack,file,'>>> '+r.kit]); continue;} walk(r.file,[...stack,file]);}}
seen=new Set();chains=[];walk('src/lib/shared/auth/state/authState.svelte.ts',[]);
console.log(chains.length?'KIT-CLIENT reaches from authState: '+chains.length:'no nav/forms/stores/@sveltejs/kit reach from authState');
for(const c of chains.slice(0,2))console.log('  '+c.map(x=>x.replace('src/lib/shared/','~/')).join(' -> '));
