/**
 * Patches local screenshot imageUrls into festival-seed.ts.
 * Run: node scripts/patch-festival-screenshots.cjs
 */
const fs = require('fs');
const path = require('path');

const SEED_FILE = path.join(__dirname, '..', 'src', 'lib', 'features', 'festivals', 'data', 'festival-seed.ts');

// Local screenshots served from /images/festivals/
const IMAGE_MAP = {
  "Great Lakes Flow Festival 2026": "/images/festivals/great-lakes-flow.jpg",
  "ZenFlow Retreat": "/images/festivals/zenflow.jpg",
  "Flow Fest Dallas 2026": "/images/festivals/flowfests.jpg",
  "Flow Fest Denver 2026": "/images/festivals/flowfests.jpg",
  "Flow Fest Indianapolis 2026": "/images/festivals/flowfests.jpg",
  "Flow Fest Seattle 2026": "/images/festivals/flowfests.jpg",
  "Flow Fest Fort Lauderdale 2026": "/images/festivals/flowfests.jpg",
  "Flow Fest Chicago 2026": "/images/festivals/flowfests.jpg",
  "Flow Fest Philadelphia 2026": "/images/festivals/flowfests.jpg",
  "Portland Juggling Festival 2026": "/images/festivals/portland-juggling.jpg",
  "The Cheeslandia Hoop Affair 2026": "/images/festivals/cheeslandia-hoop.jpg",
  "Eat, Play, Love Gathering": "/images/festivals/eat-play-love.jpg",
  "Ignite Fire Hoop & Fans Intensive": "/images/festivals/ignite-hoop.jpg",
  "The Hoop Dream Retreat (Bali)": "/images/festivals/hoop-dream-bali.jpg",
};

let content = fs.readFileSync(SEED_FILE, 'utf8');
let patched = 0;

for (const [name, url] of Object.entries(IMAGE_MAP)) {
  const nameEscaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(name: "${nameEscaped}"[\\s\\S]*?)(estimatedSize:)`, 'm');
  const match = content.match(regex);

  if (!match) {
    console.log(`SKIP: "${name}" not found`);
    continue;
  }

  if (match[1].includes('imageUrl:')) {
    console.log(`SKIP: "${name}" already has imageUrl`);
    continue;
  }

  content = content.replace(
    match[0],
    match[1] + `imageUrl: "${url}",\n    ` + match[2]
  );
  patched++;
  console.log(`PATCHED: "${name}"`);
}

fs.writeFileSync(SEED_FILE, content);
console.log(`\nDone. Patched ${patched} festivals.`);
