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
import { join, basename } from "path";
import { DEVICES } from "./devices";

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

  for (const [routeLabel, captures] of groups) {
    // Sort by device category: phones, tablets, desktops
    const order = { phone: 0, tablet: 1, desktop: 2 };
    captures.sort((a, b) => {
      const catA = getCategory(a.deviceSlug);
      const catB = getCategory(b.deviceSlug);
      return (order[catA] ?? 3) - (order[catB] ?? 3);
    });

    let cardsHTML = "";
    for (const cap of captures) {
      const dataUrl = imageToDataUrl(cap.path);
      const category = getCategory(cap.deviceSlug);
      const diff = diffs.get(cap.filename);

      let diffBadge = "";
      let diffImageHTML = "";

      if (diff) {
        const color =
          diff.diffPercent === 0
            ? "#4caf50"
            : diff.diffPercent < 1
              ? "#ff9800"
              : "#f44336";
        diffBadge = `<span class="diff-badge" style="background:${color}">${diff.diffPercent}% diff</span>`;

        if (diff.diffDataUrl) {
          diffImageHTML = `
            <div class="diff-row">
              <div class="diff-label">Baseline</div>
              <img src="${imageToDataUrl(join(BASELINES_DIR, cap.filename))}" class="diff-img" alt="baseline" />
              <div class="diff-label">Diff</div>
              <img src="${diff.diffDataUrl}" class="diff-img" alt="diff overlay" />
            </div>
          `;
        }
      }

      cardsHTML += `
        <div class="card" data-category="${category}" data-device="${cap.deviceSlug}">
          <div class="card-header">
            <span class="device-name">${cap.deviceSlug}</span>
            <span class="device-cat ${category}">${category}</span>
            ${diffBadge}
          </div>
          <img src="${dataUrl}" class="screenshot" alt="${routeLabel} on ${cap.deviceSlug}"
               onclick="openLightbox(this.src, '${routeLabel} — ${cap.deviceSlug}')" />
          ${diffImageHTML}
        </div>
      `;
    }

    sectionsHTML += `
      <section class="route-section">
        <h2>${routeLabel}</h2>
        <div class="device-grid">${cardsHTML}</div>
      </section>
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
    .filters {
      display: flex;
      gap: 8px;
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
    .route-section { margin-bottom: 48px; }
    .route-section h2 {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: #1a1a2a;
      border-radius: 6px;
      display: inline-block;
    }
    .device-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      overflow: hidden;
      transition: opacity 0.2s;
    }
    .card.hidden { display: none; }
    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      font-size: 13px;
      border-bottom: 1px solid #2a2a2a;
    }
    .device-name { font-weight: 500; }
    .device-cat {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .device-cat.phone { background: #1a3a2a; color: #4caf50; }
    .device-cat.tablet { background: #2a2a1a; color: #ff9800; }
    .device-cat.desktop { background: #1a2a3a; color: #42a5f5; }
    .diff-badge {
      margin-left: auto;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      color: #fff;
    }
    .screenshot {
      width: 100%;
      height: auto;
      display: block;
      cursor: pointer;
    }
    .diff-row {
      padding: 8px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .diff-label {
      font-size: 11px;
      color: #888;
      text-align: center;
    }
    .diff-img {
      width: 100%;
      height: auto;
      border-radius: 4px;
    }

    /* Lightbox */
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
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Screenshot Gallery</h1>
      <div class="meta">${totalScreenshots} screenshots across ${groups.size} screens — ${timestamp}${compareMode ? " — COMPARE MODE" : ""}</div>
    </div>
    <div class="filters">
      <button class="filter-btn active" onclick="filterDevices('all')">All</button>
      <button class="filter-btn" onclick="filterDevices('phone')">Phone</button>
      <button class="filter-btn" onclick="filterDevices('tablet')">Tablet</button>
      <button class="filter-btn" onclick="filterDevices('desktop')">Desktop</button>
    </div>
  </header>

  ${sectionsHTML}

  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" src="" alt="" />
    <div class="caption" id="lightbox-caption"></div>
  </div>

  <script>
    function filterDevices(category) {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');

      document.querySelectorAll('.card').forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    }

    function openLightbox(src, caption) {
      const lb = document.getElementById('lightbox');
      document.getElementById('lightbox-img').src = src;
      document.getElementById('lightbox-caption').textContent = caption;
      lb.classList.add('open');
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('open');
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeLightbox();
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
