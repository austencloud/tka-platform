/**
 * HTML Gallery Generator for Multi-Device Screenshot Testing
 *
 * Generates a self-contained HTML file grouping screenshots by screen
 * with all device captures shown side-by-side. Supports visual regression
 * diffs via pixelmatch when --compare flag is passed.
 *
 * Usage:
 *   tsx tests/screenshots/generate-gallery.ts
 *   tsx tests/screenshots/generate-gallery.ts --compare
 *   tsx tests/screenshots/generate-gallery.ts --update-baselines
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";
import { DEVICES } from "./devices";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CAPTURES_DIR = join(__dirname, "captures");
const BASELINES_DIR = join(__dirname, "baselines");
const GALLERY_PATH = join(__dirname, "gallery.html");

const args = process.argv.slice(2);
const compareMode = args.includes("--compare");
const updateBaselines = args.includes("--update-baselines");

// ─── Update Baselines ─────────────────────────────────────────────────────────

if (updateBaselines) {
  if (!existsSync(CAPTURES_DIR)) {
    console.error("No captures directory found. Run screenshots first.");
    process.exit(1);
  }

  if (!existsSync(BASELINES_DIR)) {
    mkdirSync(BASELINES_DIR, { recursive: true });
  }

  const files = readdirSync(CAPTURES_DIR).filter((f) => f.endsWith(".png"));
  for (const file of files) {
    copyFileSync(join(CAPTURES_DIR, file), join(BASELINES_DIR, file));
  }
  console.log(`Updated ${files.length} baselines.`);
  process.exit(0);
}

// ─── Parse Captures ───────────────────────────────────────────────────────────

interface CaptureInfo {
  filename: string;
  routeLabel: string;
  deviceSlug: string;
  path: string;
}

function parseCaptures(): CaptureInfo[] {
  if (!existsSync(CAPTURES_DIR)) return [];

  return readdirSync(CAPTURES_DIR)
    .filter((f) => f.endsWith(".png"))
    .map((filename) => {
      // Format: {routeLabel}--{deviceSlug}.png
      const name = basename(filename, ".png");
      const lastDash = name.lastIndexOf("--");
      if (lastDash === -1) return null;

      return {
        filename,
        routeLabel: name.substring(0, lastDash),
        deviceSlug: name.substring(lastDash + 2),
        path: join(CAPTURES_DIR, filename),
      };
    })
    .filter((c): c is CaptureInfo => c !== null);
}

function groupByRoute(
  captures: CaptureInfo[]
): Map<string, CaptureInfo[]> {
  const groups = new Map<string, CaptureInfo[]>();
  for (const cap of captures) {
    const existing = groups.get(cap.routeLabel) ?? [];
    existing.push(cap);
    groups.set(cap.routeLabel, existing);
  }
  return groups;
}

// ─── Visual Regression (pixelmatch) ───────────────────────────────────────────

interface DiffResult {
  filename: string;
  diffPixels: number;
  totalPixels: number;
  diffPercent: number;
  diffDataUrl: string | null;
}

async function computeDiffs(
  captures: CaptureInfo[]
): Promise<Map<string, DiffResult>> {
  const results = new Map<string, DiffResult>();

  if (!compareMode || !existsSync(BASELINES_DIR)) return results;

  let pixelmatch: typeof import("pixelmatch").default;
  let PNG: typeof import("pngjs").PNG;

  try {
    pixelmatch = (await import("pixelmatch")).default;
    PNG = (await import("pngjs")).PNG;
  } catch {
    console.warn(
      "pixelmatch or pngjs not installed. Run: npm install -D pixelmatch pngjs"
    );
    return results;
  }

  for (let i = 0; i < captures.length; i++) {
    const cap = captures[i];
    const baselinePath = join(BASELINES_DIR, cap.filename);
    if (!existsSync(baselinePath)) continue;

    if ((i + 1) % 10 === 0 || i === captures.length - 1) {
      console.log(`Comparing ${i + 1}/${captures.length} screenshots...`);
    }

    try {
      const baseImg = PNG.sync.read(readFileSync(baselinePath));
      const currImg = PNG.sync.read(readFileSync(cap.path));

      // Images must be same dimensions for pixelmatch
      if (
        baseImg.width !== currImg.width ||
        baseImg.height !== currImg.height
      ) {
        console.warn(
          `Dimension mismatch: ${cap.filename} (baseline: ${baseImg.width}x${baseImg.height}, current: ${currImg.width}x${currImg.height})`
        );
        results.set(cap.filename, {
          filename: cap.filename,
          diffPixels: -1,
          totalPixels: 0,
          diffPercent: 100,
          diffDataUrl: null,
        });
        continue;
      }

      const { width, height } = baseImg;
      const diff = new PNG({ width, height });
      const diffPixels = pixelmatch(
        baseImg.data,
        currImg.data,
        diff.data,
        width,
        height,
        { threshold: 0.1 }
      );

      const totalPixels = width * height;
      const diffPercent =
        totalPixels > 0
          ? Math.round((diffPixels / totalPixels) * 10000) / 100
          : 0;

      // Encode diff image as base64 data URL
      const diffBuffer = PNG.sync.write(diff);
      const diffDataUrl = `data:image/png;base64,${diffBuffer.toString("base64")}`;

      results.set(cap.filename, {
        filename: cap.filename,
        diffPixels,
        totalPixels,
        diffPercent,
        diffDataUrl,
      });
    } catch (err) {
      console.warn(
        `Skipped diff for ${cap.filename}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return results;
}

// ─── HTML Generation ──────────────────────────────────────────────────────────

const MAX_INLINE_SIZE_KB = 2048;

function imageToDataUrl(filePath: string): string {
  const buffer = readFileSync(filePath);
  const sizeKB = buffer.length / 1024;

  if (sizeKB > MAX_INLINE_SIZE_KB) {
    console.warn(
      `Large screenshot: ${basename(filePath)} is ${Math.round(sizeKB)}KB (base64 will be ~${Math.round(sizeKB * 1.37)}KB)`
    );
  }

  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function getDeviceDimensions(slug: string): { w: number; h: number } | null {
  const device = DEVICES.find((d) => d.slug === slug);
  if (!device) return null;
  return { w: device.width, h: device.height };
}

function generateHTML(
  groups: Map<string, CaptureInfo[]>,
  diffs: Map<string, DiffResult>
): string {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const totalScreenshots = Array.from(groups.values()).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  let sectionsHTML = "";
  let diffModalData: Array<{
    id: string;
    label: string;
    device: string;
    currentUrl: string;
    baselineUrl: string;
    diffUrl: string;
    percent: number;
  }> = [];

  for (const [routeLabel, captures] of groups) {
    // Sort by device category then by width (smallest first for natural phone comparison)
    const order = { phone: 0, tablet: 1, desktop: 2 };
    captures.sort((a, b) => {
      const catA = getCategory(a.deviceSlug);
      const catB = getCategory(b.deviceSlug);
      const catDiff = (order[catA] ?? 3) - (order[catB] ?? 3);
      if (catDiff !== 0) return catDiff;
      const dimA = getDeviceDimensions(a.deviceSlug);
      const dimB = getDeviceDimensions(b.deviceSlug);
      return (dimA?.w ?? 0) - (dimB?.w ?? 0);
    });

    let cardsHTML = "";
    for (const cap of captures) {
      const dataUrl = imageToDataUrl(cap.path);
      const category = getCategory(cap.deviceSlug);
      const dims = getDeviceDimensions(cap.deviceSlug);
      const dimsLabel = dims ? `${dims.w}x${dims.h}` : "";
      const diff = diffs.get(cap.filename);

      let diffBadge = "";
      if (diff) {
        const color =
          diff.diffPercent === 0
            ? "#4caf50"
            : diff.diffPercent < 1
              ? "#ff9800"
              : "#f44336";
        const diffId = `diff-${cap.filename.replace(/[^a-zA-Z0-9]/g, "-")}`;
        diffBadge = `<button class="diff-badge" style="background:${color}" onclick="event.stopPropagation(); openDiffModal('${diffId}')">${diff.diffPercent}% diff</button>`;

        if (diff.diffDataUrl) {
          diffModalData.push({
            id: diffId,
            label: routeLabel,
            device: cap.deviceSlug,
            currentUrl: dataUrl,
            baselineUrl: imageToDataUrl(join(BASELINES_DIR, cap.filename)),
            diffUrl: diff.diffDataUrl,
            percent: diff.diffPercent,
          });
        }
      }

      // Calculate proportional width based on aspect ratio at fixed row height
      const aspectRatio = dims ? dims.w / dims.h : 0.5;

      cardsHTML += `
        <div class="card" data-category="${category}" data-device="${cap.deviceSlug}"
             style="--aspect: ${aspectRatio.toFixed(4)}">
          <div class="card-header">
            <span class="device-name">${cap.deviceSlug}</span>
            <span class="device-dims">${dimsLabel}</span>
            <span class="device-cat ${category}">${category}</span>
            ${diffBadge}
          </div>
          <div class="screenshot-frame">
            <img src="${dataUrl}" class="screenshot" alt="${routeLabel} on ${cap.deviceSlug}"
                 onclick="openLightbox(this.src, '${routeLabel} — ${cap.deviceSlug} (${dimsLabel})')" />
          </div>
        </div>
      `;
    }

    sectionsHTML += `
      <section class="route-section">
        <h2>${routeLabel}</h2>
        <div class="device-row">${cardsHTML}</div>
      </section>
    `;
  }

  // Build diff modals HTML
  let diffModalsHTML = "";
  for (const dm of diffModalData) {
    const color =
      dm.percent === 0 ? "#4caf50" : dm.percent < 1 ? "#ff9800" : "#f44336";
    diffModalsHTML += `
      <div class="diff-modal" id="${dm.id}" onclick="if(event.target===this)closeDiffModal()">
        <div class="diff-modal-content">
          <div class="diff-modal-header">
            <span>${dm.label} — ${dm.device}</span>
            <span class="diff-badge-inline" style="background:${color}">${dm.percent}% diff</span>
            <button class="diff-close" onclick="closeDiffModal()">&times;</button>
          </div>
          <div class="diff-three-up">
            <div class="diff-column">
              <div class="diff-col-label">Baseline</div>
              <img src="${dm.baselineUrl}" alt="baseline" />
            </div>
            <div class="diff-column">
              <div class="diff-col-label">Current</div>
              <img src="${dm.currentUrl}" alt="current" />
            </div>
            <div class="diff-column">
              <div class="diff-col-label">Diff</div>
              <img src="${dm.diffUrl}" alt="diff" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Screenshot Gallery — ${timestamp}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #0d0d0d;
      color: #e0e0e0;
      padding: 24px;
    }

    /* ── Header ── */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid #333;
    }
    header h1 { font-size: 20px; font-weight: 600; }
    .meta { font-size: 13px; color: #888; }
    .controls {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    .filters {
      display: flex;
      gap: 6px;
    }
    .filter-btn {
      padding: 6px 14px;
      border: 1px solid #444;
      border-radius: 6px;
      background: transparent;
      color: #ccc;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }
    .filter-btn:hover { border-color: #888; }
    .filter-btn.active { background: #2a6ccf; border-color: #2a6ccf; color: #fff; }

    .size-control {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #888;
    }
    .size-control input[type="range"] {
      width: 100px;
      accent-color: #2a6ccf;
    }

    /* ── Route sections ── */
    .route-section { margin-bottom: 40px; }
    .route-section h2 {
      font-size: 15px;
      font-weight: 500;
      margin-bottom: 12px;
      padding: 6px 12px;
      background: #1a1a2a;
      border-radius: 6px;
      display: inline-block;
    }

    /* ── Device row: horizontal flex, scroll when needed ── */
    .device-row {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.15) transparent;
      align-items: flex-start;
    }
    .device-row::-webkit-scrollbar { height: 6px; }
    .device-row::-webkit-scrollbar-track { background: transparent; }
    .device-row::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.15);
      border-radius: 3px;
    }

    /* ── Card: width proportional to device aspect ratio ── */
    .card {
      flex: 0 0 auto;
      width: calc(var(--row-height, 600px) * var(--aspect, 0.5));
      min-width: 120px;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .card:hover { border-color: #444; }
    .card.hidden { display: none; }

    .card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      font-size: 12px;
      border-bottom: 1px solid #2a2a2a;
      flex-wrap: wrap;
    }
    .device-name { font-weight: 600; font-size: 12px; }
    .device-dims { color: #666; font-size: 11px; font-variant-numeric: tabular-nums; }
    .device-cat {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .device-cat.phone { background: #1a3a2a; color: #4caf50; }
    .device-cat.tablet { background: #2a2a1a; color: #ff9800; }
    .device-cat.desktop { background: #1a2a3a; color: #42a5f5; }

    .diff-badge {
      margin-left: auto;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      color: #fff;
      border: none;
      cursor: pointer;
    }
    .diff-badge:hover { filter: brightness(1.2); }

    /* ── Screenshot frame: fixed height, contains image ── */
    .screenshot-frame {
      height: var(--row-height, 600px);
      overflow: hidden;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      background: #111;
    }
    .screenshot {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: top center;
      display: block;
      cursor: pointer;
    }

    /* ── Lightbox ── */
    .lightbox {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.92);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      cursor: pointer;
    }
    .lightbox.open { display: flex; }
    .lightbox img {
      max-width: 95vw;
      max-height: 85vh;
      object-fit: contain;
      border-radius: 4px;
    }
    .lightbox .caption {
      margin-top: 12px;
      font-size: 14px;
      color: #aaa;
    }

    /* ── Diff modal: three-up comparison ── */
    .diff-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.9);
      z-index: 2000;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }
    .diff-modal.open { display: flex; }
    .diff-modal-content {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      max-width: 95vw;
      max-height: 95vh;
      overflow: auto;
    }
    .diff-modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #333;
      font-size: 14px;
      font-weight: 500;
    }
    .diff-badge-inline {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      color: #fff;
    }
    .diff-close {
      margin-left: auto;
      background: none;
      border: none;
      color: #888;
      font-size: 24px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .diff-close:hover { color: #fff; }
    .diff-three-up {
      display: flex;
      gap: 2px;
      padding: 12px;
    }
    .diff-column {
      flex: 1;
      min-width: 0;
    }
    .diff-col-label {
      text-align: center;
      font-size: 12px;
      color: #888;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .diff-column img {
      width: 100%;
      height: auto;
      border-radius: 4px;
      display: block;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Screenshot Gallery</h1>
      <div class="meta">${totalScreenshots} screenshots across ${groups.size} screens — ${timestamp}${compareMode ? " — COMPARE MODE" : ""}</div>
    </div>
    <div class="controls">
      <div class="filters">
        <button class="filter-btn active" onclick="filterDevices('all', this)">All</button>
        <button class="filter-btn" onclick="filterDevices('phone', this)">Phone</button>
        <button class="filter-btn" onclick="filterDevices('tablet', this)">Tablet</button>
        <button class="filter-btn" onclick="filterDevices('desktop', this)">Desktop</button>
      </div>
      <div class="size-control">
        <label for="row-height">Height</label>
        <input type="range" id="row-height" min="300" max="900" value="600" oninput="setRowHeight(this.value)" />
        <span id="row-height-label">600px</span>
      </div>
    </div>
  </header>

  ${sectionsHTML}

  ${diffModalsHTML}

  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" src="" alt="" />
    <div class="caption" id="lightbox-caption"></div>
  </div>

  <script>
    function filterDevices(category, btn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.card').forEach(card => {
        card.classList.toggle('hidden', category !== 'all' && card.dataset.category !== category);
      });
    }

    function setRowHeight(px) {
      document.documentElement.style.setProperty('--row-height', px + 'px');
      document.getElementById('row-height-label').textContent = px + 'px';
    }

    function openLightbox(src, caption) {
      document.getElementById('lightbox-img').src = src;
      document.getElementById('lightbox-caption').textContent = caption;
      document.getElementById('lightbox').classList.add('open');
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('open');
    }

    function openDiffModal(id) {
      document.getElementById(id).classList.add('open');
    }

    function closeDiffModal() {
      document.querySelectorAll('.diff-modal.open').forEach(m => m.classList.remove('open'));
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeDiffModal();
        closeLightbox();
      }
    });
  </script>
</body>
</html>`;
}

const DEVICE_CATEGORIES = new Map(
  DEVICES.map((d) => [d.slug, d.category])
);

function getCategory(slug: string): "phone" | "tablet" | "desktop" {
  return DEVICE_CATEGORIES.get(slug) ?? "phone";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const captures = parseCaptures();
  if (captures.length === 0) {
    console.error("No screenshots found in", CAPTURES_DIR);
    process.exit(1);
  }

  const groups = groupByRoute(captures);
  const diffs = await computeDiffs(captures);

  const html = generateHTML(groups, diffs);
  writeFileSync(GALLERY_PATH, html, "utf-8");

  console.log(
    `Gallery generated: ${GALLERY_PATH} (${captures.length} screenshots, ${groups.size} screens)`
  );

  if (diffs.size > 0) {
    let changed = 0;
    let unchanged = 0;
    for (const diff of diffs.values()) {
      if (diff.diffPercent > 0) changed++;
      else unchanged++;
    }
    console.log(
      `Visual regression: ${unchanged} unchanged, ${changed} changed`
    );
  }
}

main().catch((err) => {
  console.error("Gallery generation failed:", err);
  process.exit(1);
});
