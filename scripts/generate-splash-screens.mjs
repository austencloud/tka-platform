/**
 * Generate branded PWA and Android splash screens.
 *
 * Creates a dark radial-gradient background (#0b1d2a → #060d14)
 * with the TKA icon centered in a soft circular vignette,
 * plus a subtle blue/indigo glow ring behind the logo and
 * the app name below.
 *
 * Usage:
 *   node scripts/generate-splash-screens.mjs
 *   node scripts/generate-splash-screens.mjs --android
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "static", "pwa");
const ANDROID_RES = path.join(
  ROOT,
  "android",
  "app",
  "src",
  "main",
  "res"
);
const ICON = path.join(OUT, "icons", "icon-1024x1024.png");

// Every device size referenced in app.html, plus newer iPhones (15/16 era)
const SCREENS = [
  // iPads
  { w: 2048, h: 2732, name: "splash-2048x2732.png" },
  { w: 1668, h: 2388, name: "splash-1668x2388.png" },
  { w: 1536, h: 2048, name: "splash-1536x2048.png" },
  // iPhones
  { w: 1320, h: 2868, name: "splash-1320x2868.png" },   // iPhone 16 Pro Max
  { w: 1290, h: 2796, name: "splash-1290x2796.png" },   // iPhone 14/15 Pro Max
  { w: 1206, h: 2622, name: "splash-1206x2622.png" },   // iPhone 16 Pro
  { w: 1179, h: 2556, name: "splash-1179x2556.png" },   // iPhone 14/15 Pro
  { w: 1170, h: 2532, name: "splash-1170x2532.png" },   // iPhone 14/15
  { w: 1125, h: 2436, name: "splash-1125x2436.png" },   // iPhone X/XS/11 Pro
  { w: 1242, h: 2688, name: "splash-1242x2688.png" },   // iPhone XS Max/11 Pro Max
  { w: 828, h: 1792, name: "splash-828x1792.png" },     // iPhone XR/11
  { w: 1242, h: 2208, name: "splash-1242x2208.png" },   // iPhone 6+/7+/8+
  { w: 750, h: 1334, name: "splash-750x1334.png" },     // iPhone 6/7/8
  { w: 640, h: 1136, name: "splash-640x1136.png" },     // iPhone 5/SE1
];

// Capacitor's native splash plugin selects these exact Android resources by
// orientation and density for both cold launches and programmatic warm scans.
const ANDROID_SCREENS = [
  { w: 480, h: 320, name: "drawable/splash.png" },
  { w: 480, h: 320, name: "drawable-land-mdpi/splash.png" },
  { w: 800, h: 480, name: "drawable-land-hdpi/splash.png" },
  { w: 1280, h: 720, name: "drawable-land-xhdpi/splash.png" },
  { w: 1600, h: 960, name: "drawable-land-xxhdpi/splash.png" },
  { w: 1920, h: 1280, name: "drawable-land-xxxhdpi/splash.png" },
  { w: 320, h: 480, name: "drawable-port-mdpi/splash.png" },
  { w: 480, h: 800, name: "drawable-port-hdpi/splash.png" },
  { w: 720, h: 1280, name: "drawable-port-xhdpi/splash.png" },
  { w: 960, h: 1600, name: "drawable-port-xxhdpi/splash.png" },
  { w: 1280, h: 1920, name: "drawable-port-xxxhdpi/splash.png" },
];

/**
 * Build an SVG radial-gradient background with a centred glow ring
 * and the app name rendered below the logo area.
 */
function backgroundSvg(w, h, logoSize) {
  // Glow sits behind the logo — slightly larger
  const glowR = Math.round(logoSize * 0.55);
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2) - Math.round(logoSize * 0.08); // nudge up a touch
  const textY = cy + Math.round(logoSize / 2) + Math.round(logoSize * 0.32);
  const fontSize = Math.round(logoSize * 0.16);
  const subtitleY = textY + Math.round(fontSize * 1.5);
  const subtitleSize = Math.round(fontSize * 0.55);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <!-- Background radial gradient -->
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#0f2337"/>
      <stop offset="60%" stop-color="#0b1d2a"/>
      <stop offset="100%" stop-color="#060d14"/>
    </radialGradient>

    <!-- Glow behind logo -->
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.18"/>
      <stop offset="40%" stop-color="#6366f1" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#060d14" stop-opacity="0"/>
    </radialGradient>

    <!-- Subtle top-edge vignette -->
    <linearGradient id="topVig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.3"/>
      <stop offset="30%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Fill background -->
  <rect width="${w}" height="${h}" fill="url(#bg)"/>

  <!-- Glow ring -->
  <circle cx="${cx}" cy="${cy}" r="${glowR}" fill="url(#glow)"/>

  <!-- Top vignette -->
  <rect width="${w}" height="${h}" fill="url(#topVig)"/>

  <!-- App name -->
  <text x="${cx}" y="${textY}"
        font-family="system-ui, -apple-system, 'Helvetica Neue', sans-serif"
        font-size="${fontSize}" font-weight="300" letter-spacing="0.12em"
        fill="rgba(255,255,255,0.65)" text-anchor="middle">
    TKA COMPOSER
  </text>

  <!-- Subtitle -->
  <text x="${cx}" y="${subtitleY}"
        font-family="system-ui, -apple-system, 'Helvetica Neue', sans-serif"
        font-size="${subtitleSize}" font-weight="300" letter-spacing="0.08em"
        fill="rgba(255,255,255,0.30)" text-anchor="middle">
    Flow Arts Notation
  </text>
</svg>`;
}

async function generateSplash({ w, h, name }, outDir = OUT) {
  // Logo sizing: ~18% of the shorter dimension, clamped
  const shortSide = Math.min(w, h);
  const logoSize = Math.min(Math.round(shortSide * 0.18), 280);

  // 1. Render the SVG background at full resolution
  const bgBuffer = Buffer.from(backgroundSvg(w, h, logoSize));
  const bg = sharp(bgBuffer, { density: 72 }).png();

  // 2. Prepare the icon — resize and add rounded-rect clip via overlay
  //    We'll create a circular soft-shadow version of the icon
  const iconResized = await sharp(ICON)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Create a rounded-rect mask for the icon (24px radius equivalent)
  const cornerRadius = Math.round(logoSize * 0.18);
  const maskSvg = Buffer.from(
    `<svg width="${logoSize}" height="${logoSize}">
      <rect x="0" y="0" width="${logoSize}" height="${logoSize}"
            rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
    </svg>`
  );

  const maskedIcon = await sharp(iconResized)
    .composite([
      {
        input: await sharp(maskSvg).resize(logoSize, logoSize).png().toBuffer(),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  // 3. Composite icon onto background
  const cx = Math.round((w - logoSize) / 2);
  const cy = Math.round((h - logoSize) / 2) - Math.round(logoSize * 0.08);

  const outPath = path.join(outDir, name);
  await sharp(bgBuffer, { density: 72 })
    .resize(w, h)
    .composite([
      { input: maskedIcon, left: cx, top: cy },
    ])
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(outPath);

  const stats = await sharp(outPath).metadata();
  console.log(`  ✓ ${name}  ${stats.width}×${stats.height}`);
}

async function main() {
  const androidOnly = process.argv.includes("--android");
  const screens = androidOnly ? ANDROID_SCREENS : SCREENS;
  const outDir = androidOnly ? ANDROID_RES : OUT;
  const platform = androidOnly ? "Android" : "iOS PWA";
  console.log(`Generating ${screens.length} ${platform} splash screens…\n`);

  for (const screen of screens) {
    await generateSplash(screen, outDir);
  }

  console.log(`\nDone — files written to ${outDir}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
