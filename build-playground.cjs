const fs = require('fs');
const path = require('path');

const dir = 'static/images/props/buttons';
const ids = ['staff','bigstaff','club','bigclub','fan','bigfan','triad','bigtriad','minihoop','bighoop',
  'buugeng','bigbuugeng','fractalgeng','trigeng','triquetra','triquetra2','chicken','bigchicken',
  'doublestar','bigdoublestar','eightrings','bigeightrings','torch','bigtorch','doublecontactball',
  'hand','sword','quiad'];

const svgs = {};
for (const id of ids) {
  try {
    let svg = fs.readFileSync(path.join(dir, id + '.svg'), 'utf8').trim().replace(/\n/g, ' ').replace(/<\?xml[^?]*\?>/, '');
    svgs[id] = svg;
  } catch {
    svgs[id] = '<svg viewBox="0 0 100 100"><text x="50" y="55" text-anchor="middle" fill="#666" font-size="12">?</text></svg>';
  }
}

const svgJson = JSON.stringify(svgs);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prop Selection — Variant UX</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d0f17;--card-bg:rgba(255,255,255,0.03);--stroke:rgba(255,255,255,0.08);--stroke-strong:rgba(255,255,255,0.15);--text:#e8e8ef;--text-dim:rgba(255,255,255,0.5);--accent:#818cf8;--accent-rgb:129,140,248;--font:-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px}
h1{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:20px}
.theme-bar{display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap;justify-content:center}
.theme-btn{padding:6px 14px;border-radius:20px;border:1px solid var(--stroke);background:var(--card-bg);color:var(--text-dim);font-size:11px;font-weight:600;cursor:pointer;transition:all 150ms ease;font-family:var(--font)}
.theme-btn:hover{border-color:var(--stroke-strong);color:var(--text)}
.theme-btn.active{background:rgba(var(--accent-rgb),0.15);border-color:rgba(var(--accent-rgb),0.4);color:var(--accent)}
.grid-container{width:100%;max-width:520px;background:var(--card-bg);border:1px solid var(--stroke);border-radius:16px;overflow:visible}
.grid-scroll{padding:12px}
.section-label{font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;opacity:0.5;padding:8px 4px 4px;text-align:center;border-top:1px solid var(--stroke)}
.section-label.first{border-top:none;padding-top:0}
.section-buttons{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:4px 4px 8px}
.prop-button{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:all 200ms cubic-bezier(0.22,1,0.36,1);color:var(--text);position:relative;padding:8px 4px 6px;gap:4px;border-radius:12px;width:79px;aspect-ratio:1/1.15;overflow:visible}
.prop-button:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.1);transform:translateY(-1px)}
.prop-button:active{transform:scale(0.96);transition-duration:60ms}
.prop-button.selected{background:rgba(var(--accent-rgb),0.1);border-color:rgba(var(--accent-rgb),0.4);box-shadow:0 0 16px rgba(var(--accent-rgb),0.12)}
.prop-image-container{display:flex;align-items:center;justify-content:center;width:100%;flex:1;min-height:0;position:relative}
.prop-image-container svg{width:80%;height:auto;max-height:80%;opacity:0.5;transition:opacity 200ms ease}
.prop-button:hover .prop-image-container svg{opacity:0.75}
.prop-button.selected .prop-image-container svg{opacity:0.95}
.prop-label{text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;width:100%;font-size:10px;font-weight:500;letter-spacing:-0.1px;line-height:1.2;flex-shrink:0;color:var(--text-dim);opacity:0.4;transition:all 200ms ease;font-family:var(--font)}
.prop-button:hover .prop-label{opacity:0.65}
.prop-button.selected .prop-label{opacity:1;color:var(--accent)}
.variant-badge{position:absolute;top:4px;left:4px;width:16px;height:16px;border-radius:50%;background:var(--text-dim);color:var(--bg);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;z-index:10;pointer-events:none}
.checkmark{position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:50%;background:var(--accent);color:white;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:10;box-shadow:0 2px 8px rgba(var(--accent-rgb),0.4);animation:ckpop 300ms cubic-bezier(0.34,1.56,0.64,1)}
@keyframes ckpop{0%{transform:scale(0);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
.size-strip{border-top:1px solid var(--stroke);padding:10px 16px;display:flex;align-items:center;gap:12px;justify-content:center;background:rgba(255,255,255,0.015);animation:slidein 250ms cubic-bezier(0.36,0.66,0.04,1)}
@keyframes slidein{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
.size-label{font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px}
.size-opts{display:flex;gap:3px;background:rgba(255,255,255,0.04);border-radius:10px;padding:3px;border:1px solid var(--stroke)}
.size-opt{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;border:none;background:transparent;color:var(--text-dim);font-size:11px;font-weight:600;cursor:pointer;transition:all 150ms ease;font-family:var(--font);white-space:nowrap}
.size-opt:hover{color:var(--text);background:rgba(255,255,255,0.04)}
.size-opt.active{background:rgba(var(--accent-rgb),0.15);color:var(--accent);box-shadow:0 1px 4px rgba(0,0,0,0.3)}
.popover-bd{position:fixed;inset:0;z-index:99}
.vpop{position:fixed;z-index:100;border-radius:14px;background:#141620;border:1px solid rgba(255,255,255,0.12);box-shadow:0 12px 48px rgba(0,0,0,0.6);padding:10px 12px;display:flex;flex-direction:column;gap:8px;align-items:center;animation:popin 200ms cubic-bezier(0.34,1.56,0.64,1)}
@keyframes popin{0%{transform:scale(0.92);opacity:0}100%{transform:scale(1);opacity:1}}
.pop-label{font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;opacity:0.6}
.pop-btns{display:flex;gap:6px;justify-content:center}
.pop-btns .prop-button{width:70px}
.prompt-out{width:100%;max-width:520px;margin-top:20px;background:rgba(255,255,255,0.03);border:1px solid var(--stroke);border-radius:12px;padding:16px;position:relative}
.prompt-lbl{font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}
.prompt-txt{font-size:13px;color:var(--text);line-height:1.5;white-space:pre-wrap}
.copy-btn{position:absolute;top:12px;right:12px;padding:4px 10px;border-radius:6px;border:1px solid var(--stroke);background:var(--card-bg);color:var(--text-dim);font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font)}
.copy-btn:hover{border-color:var(--stroke-strong);color:var(--text)}
.hidden{display:none!important}
</style>
</head>
<body>
<h1>Prop Selection — Variant UX</h1>
<div class="theme-bar" id="themeBar"></div>
<div class="grid-container"><div class="grid-scroll" id="gridScroll"></div><div id="sizeToggle" class="hidden"></div></div>
<div class="prompt-out"><div class="prompt-lbl">Selection Info</div><div class="prompt-txt" id="promptText">Select a prop.</div><button class="copy-btn" onclick="copyPrompt()">Copy</button></div>
<script>
const SVG_DATA=${svgJson};
const THEMES={Cosmic:{bg:'#0d0f17',accent:'#818cf8',ar:'129,140,248'},Ocean:{bg:'#0a1628',accent:'#38bdf8',ar:'56,189,248'},Forest:{bg:'#0f1a0f',accent:'#4ade80',ar:'74,222,128'},Blossom:{bg:'#1a0f1a',accent:'#f0abfc',ar:'240,171,252'},Ember:{bg:'#1a110a',accent:'#fb923c',ar:'251,146,60'}};
const SECTIONS=[
{label:'Staves & Clubs',props:[
{id:'staff',label:'Staff',bi:true,big:'bigstaff',bigLabel:'Big Staff'},
{id:'bigstaff',label:'Big Staff',bi:true},
{id:'club',label:'Club',bi:false,big:'bigclub',bigLabel:'Big Club'},
{id:'fan',label:'Fan',bi:false,big:'bigfan',bigLabel:'Big Fan'}
]},
{label:'Curved',props:[
{id:'triad',label:'Triad',bi:false,big:'bigtriad',bigLabel:'Big Triad'},
{id:'minihoop',label:'Mini Hoop',bi:false,big:'bighoop',bigLabel:'Big Hoop'},
{id:'buugeng',label:'Buugeng',bi:true,big:'bigbuugeng',bigLabel:'Big Buugeng',shapes:['buugeng','fractalgeng']},
{id:'trigeng',label:'Trigeng',bi:true},
{id:'triquetra',label:'Triquetra',bi:false,shapes:['triquetra','triquetra2']}
]},
{label:'Novelty',props:[
{id:'chicken',label:'Chicken',bi:false,big:'bigchicken',bigLabel:'Big Chicken'},
{id:'doublestar',label:'Dbl Star',bi:true,big:'bigdoublestar',bigLabel:'Big Dbl Star'},
{id:'eightrings',label:'8 Rings',bi:true,big:'bigeightrings',bigLabel:'Big 8 Rings'},
{id:'torch',label:'Torch',bi:false,big:'bigtorch',bigLabel:'Big Torch'},
{id:'doublecontactball',label:'Dbl Contact',bi:true}
]},
{label:'Singles',props:[
{id:'hand',label:'Hand',bi:false},
{id:'sword',label:'Sword',bi:true},
{id:'quiad',label:'Quiad',bi:true}
]}
];

let sel='staff',szMode='regular',curTheme='Cosmic';

function svg(id){return SVG_DATA[id]||'<svg viewBox="0 0 100 100"><text x="50" y="55" text-anchor="middle" fill="#666" font-size="12">?</text></svg>'}
function strip(s){const m=s.match(/viewBox="([^"]+)"/);if(!m)return s;const p=m[1].split(/\\s+/).map(Number),cx=p[2]/2,cy=p[3]/2;let inner=s.replace(/<svg[^>]*>/,'').replace(/<\\/svg>/,'');return '<g transform="translate('+(-cx)+','+(-cy)+')">'+inner+'</g>'}
function pair(id,bi){const b=strip(svg(id)),r=strip(svg(id));const blueF='filter:brightness(1.6) saturate(1.3)';const redF='filter:hue-rotate(125deg) saturate(1.5) brightness(1.4)';if(bi)return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g transform="translate(50,36) rotate(-25) scale(0.38)" style="'+blueF+'">'+b+'</g><g transform="translate(50,64) rotate(25) scale(0.38)" style="'+redF+'">'+r+'</g></svg>';return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g transform="translate(32,50) rotate(-15) scale(0.35)" style="'+blueF+'">'+b+'</g><g transform="translate(68,50) rotate(15) scale(0.35)" style="'+redF+'">'+r+'</g></svg>'}
function find(id){for(const s of SECTIONS)for(const p of s.props)if(p.id===id)return p;return null}

function theme(n){curTheme=n;const t=THEMES[n],r=document.documentElement.style;r.setProperty('--bg',t.bg);r.setProperty('--accent',t.accent);r.setProperty('--accent-rgb',t.ar);document.body.style.background=t.bg;render()}

function render(){
const bar=document.getElementById('themeBar');bar.innerHTML='';
for(const n of Object.keys(THEMES)){const b=document.createElement('button');b.className='theme-btn'+(n===curTheme?' active':'');b.textContent=n;b.onclick=()=>theme(n);bar.appendChild(b)}

const sc=document.getElementById('gridScroll');sc.innerHTML='';
for(let si=0;si<SECTIONS.length;si++){
const sec=SECTIONS[si];
const lbl=document.createElement('div');lbl.className='section-label'+(si===0?' first':'');lbl.textContent=sec.label;sc.appendChild(lbl);
const row=document.createElement('div');row.className='section-buttons';
for(const p of sec.props){
const btn=document.createElement('button');btn.className='prop-button'+(sel===p.id?' selected':'');
const img=document.createElement('div');img.className='prop-image-container';
const did=(sel===p.id&&szMode==='big'&&p.big)?p.big:p.id;
img.innerHTML=pair(did,p.bi);btn.appendChild(img);
const lb=document.createElement('span');lb.className='prop-label';lb.textContent=(sel===p.id&&szMode==='big'&&p.bigLabel)?p.bigLabel:p.label;btn.appendChild(lb);
if(p.shapes&&p.shapes.length>1){const bd=document.createElement('div');bd.className='variant-badge';bd.textContent=p.shapes.length;btn.appendChild(bd)}
if(sel===p.id){const ck=document.createElement('div');ck.className='checkmark';ck.innerHTML='&#10003;';btn.appendChild(ck)}
btn.onclick=e=>{if(p.shapes&&p.shapes.length>1&&sel!==p.id){openPop(p,e.currentTarget);return}sel=p.id;szMode='regular';closePop();render()};
row.appendChild(btn)}
sc.appendChild(row)}

const st=document.getElementById('sizeToggle');const prop=find(sel);
if(!prop||!prop.big){st.className='hidden';st.innerHTML=''}
else{st.className='size-strip';
st.innerHTML='<span class="size-label">'+prop.label+'</span><div class="size-opts"><button class="size-opt '+(szMode==='regular'?'active':'')+'" onclick="sz(\\'regular\\')">'+prop.label+'</button><button class="size-opt '+(szMode==='big'?'active':'')+'" onclick="sz(\\'big\\')">'+(prop.bigLabel||'Big '+prop.label)+'</button></div>'}

const pt=document.getElementById('promptText');
let t='Selected: '+((szMode==='big'&&prop&&prop.bigLabel)?prop.bigLabel:prop?prop.label:'?');
if(prop&&prop.big)t+='\\nSize toggle: '+prop.label+' / '+(prop.bigLabel||'Big '+prop.label);
if(prop&&prop.shapes)t+='\\nShape variants: '+prop.shapes.join(', ');
t+='\\nEnum: '+((szMode==='big'&&prop&&prop.big)?prop.big:sel);
pt.textContent=t}

function sz(s){szMode=s;render()}

function openPop(prop,anchor){closePop();
const bd=document.createElement('div');bd.className='popover-bd';bd.id='popBd';bd.onclick=closePop;document.body.appendChild(bd);
const pop=document.createElement('div');pop.className='vpop';pop.id='popEl';
const lbl=document.createElement('span');lbl.className='pop-label';lbl.textContent=prop.label+' Variants';pop.appendChild(lbl);
const btns=document.createElement('div');btns.className='pop-btns';
for(const vid of prop.shapes){
const vp=find(vid)||{id:vid,label:vid,bi:prop.bi};
const btn=document.createElement('button');btn.className='prop-button'+(sel===vid?' selected':'');
const img=document.createElement('div');img.className='prop-image-container';img.innerHTML=pair(vid,vp.bi!==undefined?vp.bi:prop.bi);btn.appendChild(img);
const lb=document.createElement('span');lb.className='prop-label';lb.textContent=vp.label||vid;btn.appendChild(lb);
if(sel===vid){const ck=document.createElement('div');ck.className='checkmark';ck.innerHTML='&#10003;';btn.appendChild(ck)}
btn.onclick=()=>{sel=vid;szMode='regular';closePop();render()};
btns.appendChild(btn)}
pop.appendChild(btns);
const rect=anchor.getBoundingClientRect();
pop.style.top=(rect.bottom+6)+'px';pop.style.left=(rect.left+rect.width/2)+'px';pop.style.transform='translateX(-50%)';
document.body.appendChild(pop);
requestAnimationFrame(()=>{const pr=pop.getBoundingClientRect();if(pr.right>window.innerWidth-12)pop.style.left=(window.innerWidth-12-pr.width/2)+'px';if(pr.left<12)pop.style.left=(12+pr.width/2)+'px';if(pr.bottom>window.innerHeight-12)pop.style.top=(rect.top-pr.height-6)+'px'})}

function closePop(){document.getElementById('popBd')?.remove();document.getElementById('popEl')?.remove()}
function copyPrompt(){navigator.clipboard.writeText(document.getElementById('promptText').textContent);const b=event.target;b.textContent='Copied!';setTimeout(()=>b.textContent='Copy',1500)}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePop()});
render();
</script>
</body>
</html>`;

fs.writeFileSync('prop-variant-playground.html', html);
console.log('Written:', html.length, 'bytes');
