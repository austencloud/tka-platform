/**
 * Patches imageUrl into festival-seed.ts for festivals that are missing images.
 * Run: node scripts/patch-festival-images.cjs
 */
const fs = require('fs');
const path = require('path');

const SEED_FILE = path.join(__dirname, '..', 'src', 'lib', 'features', 'festivals', 'data', 'festival-seed.ts');

const IMAGE_MAP = {
  "Flowstorm Revival 2026": "https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F839067789%2F246932043745%2F1%2Foriginal.20240901-193013?crop=focalpoint&fit=crop&w=940&auto=format%2Ccompress&q=75&sharp=10&fp-x=0.505685517282&fp-y=0.514283326295&s=106f080fea8757b3553b6d629026785a",
  "Ab 'in Pott Convention": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEggK3TCol86LlTzVDT8Nif7nRxGGowecoCfDX9JmODmha3N6XLEcA9FyWPpQ6zLchvymcdWQKoKbhza-UKd6eAUO0WI78f7n5u9Ll0Q5px4_obAuH5p_fLl8hZGetKF_m0Z4ortqIhmyBTBMdk3LKlncVZPlyydkBUOq6mKufjnTjky-MmDjSRphDIg9CMF/w1200-h630-p-k-no-nu/Ab%20in%20Pott%20-%20Logo%2026%20klein%20.png",
  "Salzburger Jonglierconvention": "https://www.soundofjuggling.com/wp-content/uploads/Logo-Final-bunt-und-sw.png",
  "Get the Ring: Hulahoop Convention": "https://festivalsandretreats.com/wp-content/uploads/2022/01/Get-the-Ring-Hulahoop-Convention-Switzerland.jpg",
  "Israeli Juggling Convention (IJC)": "https://www.ijc.co.il/wp-content/uploads/2025/12/IJC-simple-LOGO-e1765640801374.png",
  "Frozen Fire Festival 2026": "https://frozenfirefestival.com/wp-content/uploads/2024/10/firefest.jpg",
  "Spinstock Flow Arts Festival 2026": "https://images.squarespace-cdn.com/content/v1/6139fbf52d21cf6c1c8b83cb/bd112f1e-c8d9-4acd-8330-23d4d2ed0501/Spinstock_white.png",
  "Congress of Jugglers 2026": "https://se-images.campuslabs.com/clink/images/06ff11a6-5eee-447a-ab81-1b1966f423eca0f65a48-af6b-49bf-afb7-8360ab187e14.png",
  "Philadelphia Juggling Festival 2026": "https://phillyareajugglers.org/assets/images/festival/PhillyFest%202025%203.jpg",
  "TriFlow Fest 2026": "https://triflowfest.com/wp-content/uploads/2020/04/TriFlow-Fest-logo-site-web_2020-1.png",
  "GuateFlow Gathering 2026": "https://flowartsretreats.com/wp-content/uploads/2025/06/Logo-Guateflow-871x1024.png",
  "Convenção Brasileira de Malabarismo e Circo 2026": "https://lh3.googleusercontent.com/sitesv/APaQ0SS_OTfVdmZVNAXem1wL9_O5dxhJA3tK7peh-mRrdsal-FyO8fFVyzUMLXcg-STYvge-qq_rNX0tVBQ3pBYQqOnOWl9F_QOSnocpYQxRIYaxNo0U5hwObrYnQWovsceoe31xyoTOR41eDxteTXOwZC1DVFOpH1Kxxrw=w16383",
  "British Juggling Convention 2026": "https://www.bjc2026.co.uk/images/BJC2026Logo.png",
  "FS-Con (Fire Spinner Convention) 2026": "https://www.fs-con.org/wp-content/uploads/2023/01/fs_con-logo.png",
  "Chateau Flow Retreat 2026": "https://flowartsretreats.com/wp-content/uploads/2025/05/Chateau-Flow-Retreat-LOGO-HEX-GOLD-FRANCE-1-1024x871.png",
  "Fai Jai Flow Fest 2026": "https://cdn.flow.page/images/9325315b-a621-4c0d-8c3a-3cc65d4bbebc-profile-picture?m=1729073342",
  "Pirates Retreat 2026": "https://ekekocrafts.com/cdn/shop/articles/0710082f5ab6972f7546f7a6937fb806_912x.jpg?v=1678109479",
  "Japan Juggling Festival 2026": "https://www.juggling.jp/image/logo.gif",
  "Spin Circus Festival 2026": "https://images.squarespace-cdn.com/content/v1/59564ce0cd0f684157c12974/1613265199413-FNOHFCAHC7Y8JIP5809G/Spin%2BCircus%2BSplash%2Bwith%2Btext.jpg",
  "Tucson Juggling Festival 2026": "https://lh3.googleusercontent.com/sitesv/APaQ0STZa9JViCRIyK7JeS3xGJPs8imVkh3XsKU7AUjGHjV2a_C7hipwFv8vd2grzAIorfX3N-M2A-LJ42pJMfeVDZPIFfj5J6FGqrJWAvK7xt-Z0PLRz-0nWn4wDdmtxLg5balRLiqbBwX0gFmTRRCEJe3krUrszFXtpx-Vu2mKtAvyRFHx-9MD=w16383",
  "Circle of Fire": "https://www.firetribe.co.za/wp-content/uploads/2023/10/FireTribe-1788-copy.jpg",
};

let content = fs.readFileSync(SEED_FILE, 'utf8');
let patched = 0;

for (const [name, url] of Object.entries(IMAGE_MAP)) {
  // Find the festival entry by name and check if it already has imageUrl
  const nameEscaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(name: "${nameEscaped}"[\\s\\S]*?)(estimatedSize:)`, 'm');
  const match = content.match(regex);

  if (!match) {
    console.log(`SKIP: "${name}" not found in seed file`);
    continue;
  }

  // Check if imageUrl already exists in this block
  if (match[1].includes('imageUrl:')) {
    console.log(`SKIP: "${name}" already has imageUrl`);
    continue;
  }

  // Insert imageUrl before estimatedSize
  const escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  content = content.replace(
    match[0],
    match[1] + `imageUrl: "${escaped}",\n    ` + match[2]
  );
  patched++;
  console.log(`PATCHED: "${name}"`);
}

fs.writeFileSync(SEED_FILE, content);
console.log(`\nDone. Patched ${patched} festivals.`);
