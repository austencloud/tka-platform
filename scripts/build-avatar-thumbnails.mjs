/**
 * Build + publish avatar thumbnails for the TKA 3D viewer.
 *
 * The PerformerHubDetail avatar grid paints a thumbnail per avatar from
 *   ${R2_CDN}/models/avatars/thumbnails/<id>.webp
 * (bucket: tka-assets). This script generates and uploads them end to end:
 *
 *   1. Resolve every avatar id from the canonical AVATAR_DEFINITIONS, gather
 *      each <id>.glb (local static copy, or download from the R2 CDN).
 *   2. Blender renders a head-and-shoulders portrait PNG per GLB
 *      (scripts/render-avatar-thumbnails.py).
 *   3. sharp downsizes each PNG to a 256px square WebP.
 *   4. wrangler uploads each WebP to tka-assets/models/avatars/thumbnails/<id>.webp.
 *   5. Verify each public CDN URL returns 200.
 *
 * Usage:
 *   node scripts/build-avatar-thumbnails.mjs            # full pipeline
 *   node scripts/build-avatar-thumbnails.mjs --no-upload  # render + webp only
 *   node scripts/build-avatar-thumbnails.mjs --only x-bot,ch07
 *
 * Requires: Blender installed, wrangler authenticated, sharp (already a dep).
 */
import { execFileSync, execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const R2_PUBLIC = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";
const R2_BUCKET = "tka-assets";
const R2_PREFIX = "models/avatars";
const THUMB_SIZE = 256;

const BLENDER_BIN =
  process.env.BLENDER_BIN ||
  "C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe";

const PROJECT_ROOT = process.cwd();
const STATIC_AVATARS = join(PROJECT_ROOT, "static", "models", "avatars");
const DEFINITIONS = join(
  PROJECT_ROOT,
  "node_modules",
  "@austencloud",
  "scene-3d",
  "src",
  "lib",
  "config",
  "avatar-definitions.ts",
);
const RENDER_SCRIPT = join(PROJECT_ROOT, "scripts", "render-avatar-thumbnails.py");

const WORK = join(tmpdir(), "tka-avatar-thumbs");
const IN_DIR = join(WORK, "in");
const PNG_DIR = join(WORK, "png");
const WEBP_DIR = join(WORK, "webp");

const args = process.argv.slice(2);
const noUpload = args.includes("--no-upload");
const onlyArg = args.find((a) => a === "--only");
const onlyIds = onlyArg
  ? args[args.indexOf("--only") + 1]?.split(",").map((s) => s.trim())
  : null;

/** Parse canonical avatar ids from AVATAR_DEFINITIONS. */
function readAvatarIds() {
  if (!existsSync(DEFINITIONS)) {
    throw new Error(`avatar-definitions.ts not found at ${DEFINITIONS}`);
  }
  const src = readFileSync(DEFINITIONS, "utf8");
  const ids = [...src.matchAll(/id:\s*["']([a-z0-9-]+)["']/gi)].map((m) => m[1]);
  const unique = [...new Set(ids)];
  if (unique.length < 2) {
    throw new Error(`Parsed only ${unique.length} avatar ids — definitions changed?`);
  }
  return unique;
}

async function downloadGlb(id, dest) {
  const url = `${R2_PUBLIC}/${R2_PREFIX}/${id}.glb`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${id}.glb -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

async function gatherGlbs(ids) {
  let local = 0;
  let remote = 0;
  for (const id of ids) {
    const dest = join(IN_DIR, `${id}.glb`);
    const localSrc = join(STATIC_AVATARS, `${id}.glb`);
    if (existsSync(localSrc)) {
      copyFileSync(localSrc, dest);
      local++;
    } else {
      process.stdout.write(`  downloading ${id}.glb … `);
      await downloadGlb(id, dest);
      process.stdout.write("ok\n");
      remote++;
    }
  }
  console.log(`Gathered ${ids.length} GLBs (${local} local, ${remote} from R2)`);
}

function renderAll() {
  console.log("Rendering portraits via Blender …");
  if (!existsSync(BLENDER_BIN)) {
    throw new Error(`Blender not found at ${BLENDER_BIN} (set BLENDER_BIN)`);
  }
  execFileSync(
    BLENDER_BIN,
    [
      "--background",
      "--python",
      RENDER_SCRIPT,
      "--",
      "--input",
      IN_DIR,
      "--output",
      PNG_DIR,
      "--size",
      "512",
    ],
    { stdio: "inherit" },
  );
}

async function toWebp(ids) {
  console.log("Converting PNG → WebP …");
  const made = [];
  for (const id of ids) {
    const png = join(PNG_DIR, `${id}.png`);
    if (!existsSync(png)) {
      console.warn(`  missing render: ${id}.png — skipping`);
      continue;
    }
    const webp = join(WEBP_DIR, `${id}.webp`);
    await sharp(png)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "top" })
      .webp({ quality: 88 })
      .toFile(webp);
    made.push(id);
  }
  console.log(`Wrote ${made.length} WebP thumbnails`);
  return made;
}

function upload(ids) {
  console.log(`Uploading to ${R2_BUCKET}/${R2_PREFIX}/thumbnails/ …`);
  for (const id of ids) {
    const webp = join(WEBP_DIR, `${id}.webp`);
    const key = `${R2_BUCKET}/${R2_PREFIX}/thumbnails/${id}.webp`;
    execSync(
      `npx wrangler r2 object put "${key}" --file "${webp}" --content-type image/webp --remote`,
      { stdio: "ignore" },
    );
    process.stdout.write(`  ${id} ✓\n`);
  }
}

async function verify(ids) {
  console.log("Verifying public URLs …");
  let ok = 0;
  for (const id of ids) {
    const url = `${R2_PUBLIC}/${R2_PREFIX}/thumbnails/${id}.webp`;
    const res = await fetch(url, { method: "HEAD" });
    console.log(`  ${id}.webp -> ${res.status}`);
    if (res.ok) ok++;
  }
  console.log(`${ok}/${ids.length} live on CDN`);
  return ok;
}

async function main() {
  for (const d of [IN_DIR, PNG_DIR, WEBP_DIR]) {
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
  }

  let ids = readAvatarIds();
  if (onlyIds) ids = ids.filter((id) => onlyIds.includes(id));
  console.log(`Avatars: ${ids.join(", ")}\n`);

  await gatherGlbs(ids);
  renderAll();
  const webpIds = await toWebp(ids);

  if (noUpload) {
    console.log("\n--no-upload set; skipping upload. WebP dir:", WEBP_DIR);
    return;
  }
  upload(webpIds);
  await verify(webpIds);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
