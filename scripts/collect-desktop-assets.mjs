#!/usr/bin/env node
import { collectDesktopAssets } from "./desktop-asset-bundle.mjs";

try {
  const summary = await collectDesktopAssets();
  for (const entry of summary.missing) {
    console.warn(`  not in static/: ${entry.path}  (from ${entry.source})`);
  }
  console.log(
    `Desktop asset bundle: ${summary.manifest.fileCount} files, ${(
      summary.manifest.totalBytes / 1e6
    ).toFixed(1)} MB (${(summary.copiedBytes / 1e6).toFixed(
      1
    )} MB from static/, ${(summary.downloadedBytes / 1e6).toFixed(
      1
    )} MB from R2) -> ${summary.bundleDirectory}`
  );
} catch (error) {
  console.error(`Desktop asset collection failed: ${error.message}`);
  process.exitCode = 1;
}
