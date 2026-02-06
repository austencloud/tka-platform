/**
 * Sync pictograph assets from scribe to landing.
 *
 * Copies SVG assets (arrows, props, grid, letters, numbers) that the
 * @tka/pictograph components need at runtime. Runs as a prebuild step
 * so landing always has up-to-date assets without committing duplicates.
 *
 * Usage: node scripts/sync-pictograph-assets.js
 */

import { cpSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIBE_IMAGES = resolve(__dirname, "../../../apps/scribe/static/images");
const LANDING_IMAGES = resolve(__dirname, "../static/images");

/** Directories to sync (source relative to scribe images → dest relative to landing images) */
const DIRS_TO_SYNC = [
  "arrows",
  "props",
  "grid",
  "letters_trimmed",
  "numbers",
];

/** Individual files to sync */
const FILES_TO_SYNC = [
  "arrow.svg",
];

function sync() {
  if (!existsSync(SCRIBE_IMAGES)) {
    console.error(`Source not found: ${SCRIBE_IMAGES}`);
    process.exit(1);
  }

  mkdirSync(LANDING_IMAGES, { recursive: true });

  let copied = 0;

  for (const dir of DIRS_TO_SYNC) {
    const src = resolve(SCRIBE_IMAGES, dir);
    const dest = resolve(LANDING_IMAGES, dir);

    if (!existsSync(src)) {
      console.warn(`  skip ${dir}/ (not found in scribe)`);
      continue;
    }

    cpSync(src, dest, { recursive: true });
    console.log(`  synced ${dir}/`);
    copied++;
  }

  for (const file of FILES_TO_SYNC) {
    const src = resolve(SCRIBE_IMAGES, file);
    const dest = resolve(LANDING_IMAGES, file);

    if (!existsSync(src)) {
      console.warn(`  skip ${file} (not found in scribe)`);
      continue;
    }

    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
    console.log(`  synced ${file}`);
    copied++;
  }

  console.log(`\nDone. Synced ${copied} items to ${LANDING_IMAGES}`);
}

sync();
