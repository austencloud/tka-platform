#!/usr/bin/env node
/**
 * Trim the Cloudflare Pages build output:
 * 1. Remove entire directories that are dev-only or served from R2/CDN
 * 2. Remove individual files larger than the 25 MiB per-file limit
 */
import { readdirSync, statSync, unlinkSync, rmSync, existsSync } from "fs";
import { join } from "path";

const MAX_BYTES = 25 * 1024 * 1024;
const OUTPUT_DIR = ".svelte-kit/cloudflare";

const DIRS_TO_REMOVE = [
  "screenshots",
  "thumbnails",
  "guides",
];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else {
      const size = statSync(fullPath).size;
      if (size > MAX_BYTES) {
        console.log(`  Removing ${fullPath} (${(size / 1024 / 1024).toFixed(1)} MiB)`);
        unlinkSync(fullPath);
      }
    }
  }
}

console.log(`Trimming deploy output in ${OUTPUT_DIR}...`);

for (const dir of DIRS_TO_REMOVE) {
  const fullPath = join(OUTPUT_DIR, dir);
  if (existsSync(fullPath)) {
    const files = readdirSync(fullPath, { recursive: true });
    rmSync(fullPath, { recursive: true, force: true });
    console.log(`  Removed ${fullPath}/ (${files.length} entries)`);
  }
}

console.log("Trimming files > 25 MiB...");
walk(OUTPUT_DIR);
console.log("Done.");
