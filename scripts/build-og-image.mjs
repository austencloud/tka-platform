// Renders static/branding/og-image.html to static/branding/og-image.png at
// exactly 1200x630 (the Open Graph / Twitter summary_large_image size declared
// sitewide as og:image:width/height). Uses Playwright's Chromium so the template
// gets real system-font rendering (the app-name is Palatino Linotype italic,
// which a canvas rasterizer can't reproduce).
//
//   node scripts/build-og-image.mjs
//
// Re-run whenever og-image.html changes. The PNG is committed (build inputs
// shouldn't require a browser at deploy time).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(here, "../static/branding/og-image.html");
const outPath = path.resolve(here, "../static/branding/og-image.png");

if (!existsSync(htmlPath)) {
  console.error(`[og-image] template missing: ${htmlPath}`);
  process.exit(1);
}

const WIDTH = 1200;
const HEIGHT = 630;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const fileUrl = "file://" + htmlPath.replace(/\\/g, "/");
  await page.goto(fileUrl, { waitUntil: "networkidle" });
  // Let the gradient stack + web-safe fonts settle before capture.
  await page.waitForTimeout(250);
  await page.screenshot({
    path: outPath,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
  console.log(`[og-image] wrote ${outPath} (${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
}
