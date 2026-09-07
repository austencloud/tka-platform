#!/usr/bin/env node
/**
 * Downloads and extracts the pinned WebView2 Fixed Version runtime into
 * src-tauri/webview2-runtime/ so the NSIS installer ships its own browser
 * engine (tauri.conf.json → bundle.windows.webviewInstallMode.fixedRuntime).
 *
 * Why fixed instead of Evergreen: a machine whose Evergreen runtime is frozen
 * by EdgeUpdate policy (Austen's is pinned at 122.0.2365.106, which crashes
 * the renderer on the Create module) can never be repaired by the bootstrapper.
 * Shipping the engine makes the demo build independent of that machine state
 * and of any install-time download.
 *
 * Windows only (uses expand.exe). Skips the download when the runtime is
 * already present. Set WEBVIEW2_RUNTIME_SOURCE=<dir> to copy an existing
 * extracted runtime instead of downloading.
 */
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const WEBVIEW2_FIXED_RUNTIME_VERSION = "152.0.4191.53";
export const WEBVIEW2_FIXED_RUNTIME_URL =
  "https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/f8ecb2c5-f486-4df5-994f-1eec63f1de23/Microsoft.WebView2.FixedVersionRuntime.152.0.4191.53.x64.cab";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RUNTIME_DIRECTORY = join(repoRoot, "src-tauri", "webview2-runtime");

function runtimePresent(directory) {
  return existsSync(join(directory, "msedgewebview2.exe"));
}

async function download(url, target) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`WebView2 runtime download failed: ${response.status} ${url}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  return statSync(target).size;
}

async function main() {
  if (runtimePresent(RUNTIME_DIRECTORY)) {
    console.log(`WebView2 runtime already present at ${RUNTIME_DIRECTORY}`);
    return;
  }
  const source = process.env.WEBVIEW2_RUNTIME_SOURCE;
  if (source) {
    if (!runtimePresent(source)) {
      throw new Error(`WEBVIEW2_RUNTIME_SOURCE has no msedgewebview2.exe: ${source}`);
    }
    cpSync(source, RUNTIME_DIRECTORY, { recursive: true });
    console.log(`Copied WebView2 runtime from ${source}`);
    return;
  }
  if (process.platform !== "win32") {
    throw new Error("The WebView2 fixed runtime can only be prepared on Windows (expand.exe).");
  }
  const cab = join(tmpdir(), `webview2-${WEBVIEW2_FIXED_RUNTIME_VERSION}.cab`);
  console.log(`Downloading ${WEBVIEW2_FIXED_RUNTIME_URL}`);
  const bytes = await download(WEBVIEW2_FIXED_RUNTIME_URL, cab);
  console.log(`Downloaded ${(bytes / 1024 / 1024).toFixed(1)} MB`);

  const extracted = join(tmpdir(), `webview2-extract-${WEBVIEW2_FIXED_RUNTIME_VERSION}`);
  rmSync(extracted, { recursive: true, force: true });
  mkdirSync(extracted, { recursive: true });
  execFileSync("expand.exe", [cab, "-F:*", extracted], { stdio: "inherit" });

  // The cab expands to <extracted>/Microsoft.WebView2.FixedVersionRuntime.<ver>.x64/
  const inner = join(
    extracted,
    `Microsoft.WebView2.FixedVersionRuntime.${WEBVIEW2_FIXED_RUNTIME_VERSION}.x64`
  );
  const root = runtimePresent(inner) ? inner : extracted;
  if (!runtimePresent(root)) {
    throw new Error(`Expanded cab has no msedgewebview2.exe under ${extracted}`);
  }
  rmSync(RUNTIME_DIRECTORY, { recursive: true, force: true });
  cpSync(root, RUNTIME_DIRECTORY, { recursive: true });
  rmSync(extracted, { recursive: true, force: true });
  rmSync(cab, { force: true });
  console.log(`WebView2 runtime ${WEBVIEW2_FIXED_RUNTIME_VERSION} ready at ${RUNTIME_DIRECTORY}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
