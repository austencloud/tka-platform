#!/usr/bin/env node
import { verifyDesktopAssets } from "./desktop-asset-bundle.mjs";

try {
  const summary = await verifyDesktopAssets();
  console.log(
    `Desktop asset bundle verified: ${summary.fileCount} files, ${(
      summary.totalBytes / 1e6
    ).toFixed(1)} MB, ${summary.requiredCount} required offline assets present.`
  );
} catch (error) {
  console.error(`Desktop asset bundle verification failed: ${error.message}`);
  process.exitCode = 1;
}
