/**
 * Bake the Kinetic Alphabet notation into real, crawlable image files for
 * Google Images SEO.
 *
 * For each of the 47 canonical letters it renders the representative pictograph
 * (variation 0) with the app's own `Canvas2DDirectRenderer` under node-canvas —
 * no browser — then encodes WebP (full + small) and a PNG fallback with
 * descriptive, slugged filenames into `static/notation/letters/`. It also bakes
 * the social-share `static/branding/og-image.png` that seven marketing pages
 * reference but which was never committed.
 *
 * The canvas render step and the sharp encode step are separate exported
 * functions so the encode/OG pipeline is unit-testable without the native
 * `canvas` binding (which needs libpango/libcairo at build time — present in CI,
 * absent in some sandboxes). If the renderer can't load, the script warns and
 * exits 0, leaving already-committed images in place so a deploy never breaks.
 *
 * Usage:
 *   tsx scripts/bake-notation-images.ts            # all letters + OG
 *   tsx scripts/bake-notation-images.ts --letters A,B,Σ
 *   tsx scripts/bake-notation-images.ts --og-only
 *   tsx scripts/bake-notation-images.ts --skip-og
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  CANONICAL_LETTERS,
  LETTER_IMAGE_DIR,
  LETTER_IMAGE_SIZE,
  LETTER_IMAGE_SMALL_SIZE,
  letterImageBasename,
  letterSeo,
} from "../src/lib/shared/seo/notation-letters";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const STATIC = path.join(ROOT, "static");
const LETTERS_OUT = path.join(STATIC, LETTER_IMAGE_DIR);
const CSV_PATH = path.join(STATIC, "data", "pictographs", "DiamondPictographDataframe.csv");
const OG_OUT = path.join(STATIC, "branding", "og-image.png");

// ── CSV ───────────────────────────────────────────────────────────────────

interface CsvTable {
  headers: string[];
  rows: string[][];
}

export function loadCsv(csvPath = CSV_PATH): CsvTable {
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((l) => l.split(","));
  return { headers, rows };
}

/** The representative pictograph data (variation 0) for a letter. */
export function pictographDataForLetter(letter: string, csv: CsvTable) {
  const { headers, rows } = csv;
  const row = rows.find((r) => r[0] === letter);
  if (!row) throw new Error(`No pictograph row for letter "${letter}"`);
  const col = (name: string) => row[headers.indexOf(name)];
  const motion = (side: "blue" | "red") => ({
    motionType: col(`${side}MotionType`),
    rotationDirection: col(`${side}RotationDirection`),
    startLocation: col(`${side}StartLocation`),
    endLocation: col(`${side}EndLocation`),
    startOrientation: "in",
    endOrientation: "in",
    turns: 1,
    propType: "staff",
    propPlacementData: { propType: "staff" },
  });
  return {
    id: `pictograph-${letter}`,
    letter,
    motions: { blue: motion("blue"), red: motion("red") },
  };
}

// ── Canvas render (native `canvas`; isolated so tests don't load it) ────────

let cachedRenderer: { renderPictograph: (d: unknown, o: unknown) => Promise<{ toBuffer: (t: string) => Buffer }> } | null = null;

async function getRenderer() {
  if (cachedRenderer) return cachedRenderer;
  // Absolute file URLs + @vite-ignore so bundlers (vitest) don't statically
  // resolve the native-canvas render graph at import time — it only loads when
  // the bake actually runs under tsx.
  const diUrl = new URL("../src/lib/shared/inversify/di.ts", import.meta.url).href;
  const typesUrl = new URL("../src/lib/shared/inversify/types/core.types.ts", import.meta.url).href;
  const { container } = await import(/* @vite-ignore */ diUrl);
  const { TYPES } = await import(/* @vite-ignore */ typesUrl);
  const renderer = container.get(TYPES.IDirectRenderer) as typeof cachedRenderer & {
    initialize: () => Promise<void>;
  };
  await renderer.initialize();
  cachedRenderer = renderer;
  return renderer;
}

/** Render one letter's pictograph to a PNG buffer via node-canvas. */
export async function renderLetterPng(letter: string, csv: CsvTable): Promise<Buffer> {
  const data = pictographDataForLetter(letter, csv);
  const renderer = await getRenderer();
  const canvas = await renderer.renderPictograph(data, {
    size: LETTER_IMAGE_SIZE,
    showGrid: true,
    showTKA: true,
    showTND: false,
    showElemental: false,
    showPositions: false,
    showReversals: false,
    showNonRadialPoints: false,
    darkMode: false,
    handPointVisibility: "active",
  });
  return canvas.toBuffer("image/png");
}

// ── Sharp encode (prebuilt; runs everywhere) ────────────────────────────────

export interface EncodedVariants {
  webp: string;
  webpSmall: string;
  png: string;
}

/** Encode a rendered PNG buffer into WebP (full + small) and a PNG fallback. */
export async function encodeLetterVariants(
  pngBuffer: Buffer,
  letter: string,
  outDir = LETTERS_OUT,
): Promise<EncodedVariants> {
  await fs.promises.mkdir(outDir, { recursive: true });
  const base = path.join(outDir, letterImageBasename(letter));
  const webp = `${base}.webp`;
  const webpSmall = `${base}-small.webp`;
  const png = `${base}.png`;
  await sharp(pngBuffer).webp({ quality: 90 }).toFile(webp);
  await sharp(pngBuffer)
    .resize(LETTER_IMAGE_SMALL_SIZE, LETTER_IMAGE_SMALL_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 82 })
    .toFile(webpSmall);
  await sharp(pngBuffer).png({ compressionLevel: 9 }).toFile(png);
  return { webp, webpSmall, png };
}

// ── OG image (SVG background rasterized by sharp + composited pictographs) ───

/**
 * Bake the 1200×630 social-share image: dark gradient, wordmark, tagline, and a
 * strip of real letter pictographs. Rasterized from an SVG string by sharp, so
 * it needs no browser and no native canvas.
 */
export async function bakeOgImage(
  outFile = OG_OUT,
  pictographPngs: string[] = defaultOgPictographs(),
): Promise<string> {
  const W = 1200;
  const H = 630;
  const bg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0c0515"/>
      <stop offset="30%" stop-color="#1a0a2e"/>
      <stop offset="70%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#0c0515"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="18%" r="70%">
      <stop offset="0%" stop-color="#581c87" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#581c87" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text x="${W / 2}" y="150" text-anchor="middle" font-family="system-ui, sans-serif" font-size="72" font-weight="800" fill="#ffffff">The Kinetic Alphabet</text>
  <text x="${W / 2}" y="205" text-anchor="middle" font-family="system-ui, sans-serif" font-size="32" font-weight="500" fill="#c4b5fd">Flow arts notation you can read like music</text>
</svg>`;

  let img = sharp(Buffer.from(bg));
  const usable = pictographPngs.filter((p) => fs.existsSync(p)).slice(0, 4);
  if (usable.length > 0) {
    const tile = 190;
    const gap = 22;
    const totalW = usable.length * tile + (usable.length - 1) * gap;
    const startX = Math.round((W - totalW) / 2);
    const y = 310;
    const composites = await Promise.all(
      usable.map(async (p, i) => ({
        input: await sharp(p)
          .resize(tile, tile, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer(),
        left: startX + i * (tile + gap),
        top: y,
      })),
    );
    img = img.composite(composites);
  }
  await fs.promises.mkdir(path.dirname(outFile), { recursive: true });
  await img.png().toFile(outFile);
  return outFile;
}

/** Prefer freshly-baked pictographs for the OG strip; fall back to committed ones. */
function defaultOgPictographs(): string[] {
  const baked = ["A", "Σ", "Φ", "α"].map(
    (l) => path.join(LETTERS_OUT, `${letterImageBasename(l)}.png`),
  );
  if (baked.every((p) => fs.existsSync(p))) return baked;
  const legacy = ["A", "B", "C", "W"].map(
    (l) => path.join(STATIC, "images", "grant-feature", `pictograph-${l}.png`),
  );
  return legacy;
}

// ── Orchestration ───────────────────────────────────────────────────────────

async function bakeAllLetters(letters: readonly string[]): Promise<number> {
  const csv = loadCsv();
  let ok = 0;
  for (const letter of letters) {
    try {
      const png = await renderLetterPng(letter, csv);
      await encodeLetterVariants(png, letter);
      const seo = letterSeo(letter as (typeof CANONICAL_LETTERS)[number]);
      console.log(`  ✓ ${letter.padEnd(3)} → ${path.basename(seo.images.webp)}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${letter}: ${(err as Error).message}`);
      throw err;
    }
  }
  return ok;
}

function parseArgs(argv: string[]) {
  const arg = (flag: string) => {
    const hit = argv.find((a) => a.startsWith(`${flag}=`) || a === flag);
    if (!hit) return undefined;
    return hit.includes("=") ? hit.split("=")[1] : "";
  };
  const lettersArg = arg("--letters");
  return {
    ogOnly: argv.includes("--og-only"),
    skipOg: argv.includes("--skip-og"),
    letters: lettersArg ? lettersArg.split(",").map((s) => s.trim()).filter(Boolean) : [...CANONICAL_LETTERS],
  };
}

async function main() {
  const { ogOnly, skipOg, letters } = parseArgs(process.argv.slice(2));

  if (!ogOnly) {
    console.log(`Baking ${letters.length} letter pictographs → static/${LETTER_IMAGE_DIR}/`);
    try {
      const n = await bakeAllLetters(letters);
      console.log(`Baked ${n} letters.`);
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (/canvas|Cannot find module|MODULE_NOT_FOUND|libpango|node-gyp/i.test(msg)) {
        console.warn(
          "\n⚠ Native `canvas` unavailable in this environment — skipping the render step.\n" +
            "  Committed images under static/notation/letters/ are left in place.\n" +
            "  The bake runs in CI / locally where canvas builds (needs libpango-dev/libcairo2-dev).\n",
        );
      } else {
        throw err;
      }
    }
  }

  if (!skipOg) {
    console.log("Baking social-share og-image.png …");
    const out = await bakeOgImage();
    console.log(`  ✓ ${path.relative(ROOT, out)}`);
  }
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
