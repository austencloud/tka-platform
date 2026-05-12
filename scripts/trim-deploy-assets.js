#!/usr/bin/env node
/**
 * Remove files larger than Cloudflare Pages' 25 MiB limit from the build output.
 * These assets must be served from R2 or another CDN.
 */
import { readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";

const MAX_BYTES = 25 * 1024 * 1024;
const OUTPUT_DIR = ".svelte-kit/cloudflare";

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

console.log(`Trimming files > 25 MiB from ${OUTPUT_DIR}...`);
walk(OUTPUT_DIR);
console.log("Done.");
