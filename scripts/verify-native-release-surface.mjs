#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  inspectNativeReleaseSurface,
  NATIVE_RELEASE_FORBIDDEN_MARKERS,
} from "./lib/native-push-deploy-core.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const buildRoot = resolve(
  repoRoot,
  process.argv[2] ?? ".svelte-kit/cloudflare"
);

function readJavaScriptFiles(root) {
  const files = [];
  const directories = [root];

  while (directories.length > 0) {
    const directory = directories.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        directories.push(absolutePath);
      } else if (/\.(?:js|mjs)$/.test(entry.name)) {
        files.push({
          path: relative(root, absolutePath).replace(/\\/g, "/"),
          contents: readFileSync(absolutePath, "utf8"),
        });
      }
    }
  }

  return files;
}

if (!existsSync(buildRoot)) {
  console.error(`[native-surface] Build directory not found: ${buildRoot}`);
  process.exit(1);
}

const report = inspectNativeReleaseSurface(readJavaScriptFiles(buildRoot));
if (report.checkedFileCount === 0) {
  console.error(`[native-surface] No JavaScript assets found in ${buildRoot}`);
  process.exit(1);
}

if (report.violations.length > 0) {
  console.error("[native-surface] Forbidden release markers found:");
  for (const violation of report.violations) {
    console.error(`  ${violation.path}: ${JSON.stringify(violation.marker)}`);
  }
  process.exit(1);
}

console.log(
  `[native-surface] Verified ${report.checkedFileCount} JavaScript asset(s); ` +
    `${NATIVE_RELEASE_FORBIDDEN_MARKERS.length} forbidden marker(s) absent.`
);
