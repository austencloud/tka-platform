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

// guides/ stays: 3 downloadable PDFs (~28 MB total), each under the 25 MiB
// per-file cap. They were swept in with the May-13 deploy-size trim but are
// user-facing downloads linked from the landing page (/guides/level-N.pdf).
const DIRS_TO_REMOVE = [
  "screenshots",
  "thumbnails",
  // Design sketches are throwaway HTML mockups reviewed at
  // localhost:5173/sketches/<file>.html during design work. Vite serves them
  // from static/ in dev, so that workflow is untouched — but static/ copies
  // verbatim into the deploy output, which published 32 internal mockups on
  // tkaflowarts.com/sketches/. They are not route-gated, so no feature flag or
  // load guard can reach them; dropping them here is the only seam.
  "sketches",
];

// Individual dev-only files that live in static/ and would otherwise ship.
// Same reasoning as the sketches directory above.
const FILES_TO_REMOVE = ["element-icons-preview.html"];

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

for (const file of FILES_TO_REMOVE) {
  const fullPath = join(OUTPUT_DIR, file);
  if (existsSync(fullPath)) {
    unlinkSync(fullPath);
    console.log(`  Removed ${fullPath}`);
  }
}

console.log("Trimming files > 25 MiB...");
walk(OUTPUT_DIR);
console.log("Done.");
