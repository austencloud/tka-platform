import puppeteer from 'file:///E:/tka-platform/node_modules/.pnpm/puppeteer-core@24.22.0/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const OUT='C:/Users/Austen/AppData/Local/Temp/claude/E--tka-platform/f23514f7-27e2-44f1-859d-6bd23a5e830d/scratchpad/';
const targets={30:'examples-cccc',31:'examples-acac',33:'gamma-loops',34:'type2-loops',35:'sixteen-count',36:'eight-letter-words',37:'prop-reversal-loops',38:'full-reversal-loops'};
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--ignore-certificate-errors']});
const page=await browser.newPage();
await page.setViewport({width:1100,height:1300});
await page.goto('https://localhost:5173/guide/level-1/print',{waitUntil:'networkidle2',timeout:180000});
await new Promise(r=>setTimeout(r,20000));
const handles=await page.$$('.guide-page');
for(const [idx,name] of Object.entries(targets)){
  const h=handles[+idx];
  await h.evaluate(e=>e.scrollIntoView());
  await new Promise(r=>setTimeout(r,1800));
  await h.screenshot({path:OUT+'pg-'+name+'.png'});
  console.log('OK',name);
}
await browser.close();
