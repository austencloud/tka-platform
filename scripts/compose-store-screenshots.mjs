/**
 * Compose Play Store screenshots from raw device captures.
 *
 * Raw phone captures are ~2.2:1 which Google Play rejects (max 2:1). This
 * takes captures from tests/screenshots/captures/, places each on a brand
 * 9:16 canvas (dark navy gradient + dot grid, Palatino headline, rounded
 * device frame), and writes Play-ready PNGs (24-bit, no alpha) to
 * tests/screenshots/store/.
 *
 *   node scripts/compose-store-screenshots.mjs
 *
 * Slots and captions live in STORE_SLOTS below — edit there, re-run.
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAPTURES = join(__dirname, "../tests/screenshots/captures");
const OUT = join(__dirname, "../tests/screenshots/store");

// Play phone canvas: 9:16, promotion-eligible (min 1080px)
const PHONE = { w: 1080, h: 1920 };
// Play tablet canvas: 9:16 portrait
const TABLET = { w: 1440, h: 2560 };

/** slot order = Play listing order — viewer showcase first, workspaces after */
const STORE_SLOTS = [
  {
    // The 3D viewer is gated to viewports >= 600px shortest side, so phones
    // get the 2D player; 3D headlines the tablet slots instead.
    out: "phone-1-viewer-animation",
    capture: "viewer--animation--galaxy-s24-ultra.png",
    canvas: PHONE,
    caption: ["Watch your sequence", "come to life"],
  },
  {
    out: "phone-2-tunnel",
    capture: "viewer--tunnel--galaxy-s24-ultra.png",
    canvas: PHONE,
    caption: ["Turn a sequence", "into a tunnel"],
  },
  {
    out: "phone-3-mandala",
    capture: "viewer--mandala--galaxy-s24-ultra.png",
    canvas: PHONE,
    caption: ["See the mandala", "inside your sequence"],
  },
  {
    out: "phone-4-construct",
    capture: "create--construct--galaxy-s24-ultra.png",
    canvas: PHONE,
    caption: ["Build a sequence", "one step at a time"],
  },
  {
    out: "phone-5-generate",
    capture: "create--generate--galaxy-s24-ultra.png",
    canvas: PHONE,
    caption: ["Or generate one", "and edit from there"],
  },
  {
    out: "phone-6-library",
    capture: "browse--collections--galaxy-s24-ultra.png",
    canvas: PHONE,
    caption: ["Keep everything", "in your library"],
  },
  {
    out: "phone-7-gallery",
    capture: "browse--gallery--galaxy-s24-ultra.png",
    canvas: PHONE,
    caption: ["Browse what others", "have built"],
  },
  {
    out: "phone-8-concepts",
    capture: "learn--concepts--galaxy-s24-ultra.png",
    canvas: PHONE,
    caption: ["Learn the notation", "with short lessons"],
  },
  {
    out: "tablet7-1-viewer-3d",
    capture: "viewer--3d--ipad-mini.png",
    canvas: TABLET,
    caption: ["Watch your sequence", "performed in 3D"],
  },
  {
    out: "tablet7-2-construct",
    capture: "create--construct--ipad-mini.png",
    canvas: TABLET,
    caption: ["Build a sequence", "one step at a time"],
  },
  {
    out: "tablet10-1-viewer-3d",
    capture: "viewer--3d--ipad-air.png",
    canvas: TABLET,
    caption: ["Watch your sequence", "performed in 3D"],
  },
  {
    out: "tablet10-2-construct",
    capture: "create--construct--ipad-air.png",
    canvas: TABLET,
    caption: ["Build a sequence", "one step at a time"],
  },
];

function dotGrid(w, h) {
  const dots = [];
  for (let y = 30; y < h; y += 120) {
    for (let x = 30 + ((y / 120) % 2) * 60; x < w; x += 120) {
      dots.push(`<circle cx="${x}" cy="${y}" r="1.5" fill="rgba(255,255,255,0.07)"/>`);
    }
  }
  return dots.join("");
}

function backgroundSvg(w, h, caption, headlineBottom) {
  const fontSize = Math.round(w * 0.062);
  const lineGap = Math.round(fontSize * 1.25);
  const firstLineY = headlineBottom - lineGap * (caption.length - 1);
  const lines = caption
    .map(
      (line, i) =>
        `<text x="50%" y="${firstLineY + i * lineGap}" text-anchor="middle"
           font-family="Palatino Linotype, Book Antiqua, Palatino, Georgia, serif"
           font-size="${fontSize}" fill="#ffffff">${line}</text>`
    )
    .join("");
  // red/blue accent bar under the headline, echoing the prop colors
  const barY = headlineBottom + Math.round(fontSize * 0.7);
  const barW = Math.round(w * 0.14);
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#050510"/>
        <stop offset="0.4" stop-color="#0a0e1a"/>
        <stop offset="0.7" stop-color="#0d1225"/>
        <stop offset="1" stop-color="#080c18"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    ${dotGrid(w, h)}
    ${lines}
    <rect x="${w / 2 - barW}" y="${barY}" width="${barW}" height="6" rx="3" fill="#e2504c"/>
    <rect x="${w / 2}" y="${barY}" width="${barW}" height="6" rx="3" fill="#4c6ee2"/>
  </svg>`);
}

function frameSvg(w, h, r) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${r}"
      fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="3"/>
  </svg>`);
}

function roundedMask(w, h, r) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${r}" fill="#fff"/>
  </svg>`);
}

async function composeSlot(slot) {
  const src = join(CAPTURES, slot.capture);
  if (!existsSync(src)) {
    console.warn(`SKIP ${slot.out}: missing capture ${slot.capture}`);
    return false;
  }
  const { w, h } = slot.canvas;
  const meta = await sharp(src).metadata();

  // Layout: headline block on top, screenshot fills the rest with margins
  const headlineBottom = Math.round(h * 0.115);
  const shotTop = Math.round(h * 0.165);
  const shotBottomMargin = Math.round(h * 0.035);
  const maxShotH = h - shotTop - shotBottomMargin;
  const maxShotW = Math.round(w * 0.86);

  const scale = Math.min(maxShotW / meta.width, maxShotH / meta.height);
  const shotW = Math.round(meta.width * scale);
  const shotH = Math.round(meta.height * scale);
  const radius = Math.round(shotW * 0.055);

  const shot = await sharp(src)
    .resize(shotW, shotH)
    .composite([{ input: roundedMask(shotW, shotH, radius), blend: "dest-in" }])
    .png()
    .toBuffer();

  const left = Math.round((w - shotW) / 2);
  const top = shotTop + Math.round((maxShotH - shotH) / 2);

  await sharp(backgroundSvg(w, h, slot.caption, headlineBottom))
    .composite([
      { input: shot, left, top },
      { input: frameSvg(shotW, shotH, radius), left, top },
    ])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, `${slot.out}.png`));

  console.log(`OK   ${slot.out}.png  (${w}x${h} from ${meta.width}x${meta.height})`);
  return true;
}

mkdirSync(OUT, { recursive: true });
let ok = 0;
for (const slot of STORE_SLOTS) {
  if (await composeSlot(slot)) ok++;
}
console.log(`\n${ok}/${STORE_SLOTS.length} store screenshots written to tests/screenshots/store/`);
