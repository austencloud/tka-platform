#!/usr/bin/env node
/**
 * Regenerate the printable Level 1 guide PDF from the /guide/level-1/print route.
 *
 * Loop: edit any guide section's .svelte prose → `npm run guide:pdf` → fresh
 * static/guides/level-1.pdf (served at the landing-page download link).
 *
 * Renders via headless Chrome --print-to-pdf against a running dev/preview
 * server (does NOT start one — `npm run dev` is hooks-blocked). The print route
 * sets a print-mode context that forces every pictograph to render eagerly;
 * --virtual-time-budget gives that time to settle before capture.
 *
 * Flags / env:
 *   --url <url>        override the print route URL
 *   CHROME_PATH        override the Chrome executable path
 *
 * Spec: docs/superpowers/specs/2026-06-21-guide-proof-reprint-loop-design.md
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, copyFileSync, rmSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const OUTPUT = join(REPO_ROOT, "static", "guides", "level-1.pdf");
const MIN_PAGES = 50;
const MIN_BYTES = 1_000_000;
const VIRTUAL_TIME_BUDGET_MS = 30_000;

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const URL = arg("--url") ?? "http://localhost:5173/guide/level-1/print";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    if (existsSync(c)) return c;
  }
  return process.env.CHROME_PATH ?? CHROME_CANDIDATES[0];
}

async function probe(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`[guide:pdf] source: ${URL}`);

  if (!(await probe(URL))) {
    console.error(
      `\n[guide:pdf] ERROR: cannot reach ${URL}\n` +
        `The print route needs a running server. Start one, then re-run:\n` +
        `   • dev server (port 5173, the usual): already running in VS Code — check it's up\n` +
        `   • or a standalone preview:  npm run build && npm run preview\n` +
        `   • or point at another port:  node scripts/build-guide-pdf.mjs --url http://localhost:4173/guide/level-1/print\n`
    );
    process.exit(1);
  }

  const chrome = findChrome();
  if (!existsSync(chrome)) {
    console.error(`[guide:pdf] ERROR: Chrome not found at ${chrome}. Set CHROME_PATH.`);
    process.exit(1);
  }
  console.log(`[guide:pdf] chrome: ${chrome}`);

  const tmpOut = join(tmpdir(), `guide-l1-render-${process.pid}.pdf`);
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--virtual-time-budget=${VIRTUAL_TIME_BUDGET_MS}`,
    `--print-to-pdf=${tmpOut}`,
    URL,
  ];

  console.log(`[guide:pdf] rendering (virtual-time-budget ${VIRTUAL_TIME_BUDGET_MS}ms)…`);
  await execFileAsync(chrome, args, { timeout: VIRTUAL_TIME_BUDGET_MS + 30_000 });

  if (!existsSync(tmpOut)) {
    console.error(`[guide:pdf] ERROR: Chrome produced no file at ${tmpOut}`);
    process.exit(1);
  }

  // Validate before clobbering the good output.
  const bytes = statSync(tmpOut).size;
  const pageCount = (await PDFDocument.load(readFileSync(tmpOut))).getPageCount();

  if (pageCount < MIN_PAGES || bytes < MIN_BYTES) {
    console.error(
      `[guide:pdf] ERROR: render looks blank/short (${pageCount} pages, ` +
        `${(bytes / 1e6).toFixed(1)}MB). Expected >${MIN_PAGES} pages and >1MB. ` +
        `Leaving existing PDF untouched. Bad render kept at: ${tmpOut}`
    );
    process.exit(1);
  }

  // Back up the previous good PDF, then move the new one into place.
  mkdirSync(dirname(OUTPUT), { recursive: true });
  if (existsSync(OUTPUT)) {
    const backup = join(tmpdir(), `level-1-prev-${process.pid}.pdf`);
    copyFileSync(OUTPUT, backup);
    console.log(`[guide:pdf] previous PDF backed up to ${backup}`);
  }
  copyFileSync(tmpOut, OUTPUT); // copy (not rename) — tmpdir and repo are on different drives on Windows
  rmSync(tmpOut, { force: true });

  console.log(
    `\n[guide:pdf] ✓ wrote ${pageCount} pages, ${(bytes / 1e6).toFixed(1)}MB\n` +
      `   ${OUTPUT}\n`
  );
}

main().catch((err) => {
  console.error("[guide:pdf] FAILED:", err.message ?? err);
  process.exit(1);
});
