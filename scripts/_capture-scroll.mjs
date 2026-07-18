// Capture a full-page screenshot after scrolling through to trigger IntersectionObserver.
//   node scripts/_capture-scroll.mjs <url> <outPng> [waitMs]
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://127.0.0.1:5173/guide/codex";
const out = process.argv[3] ?? "/tmp/capture.png";
const waitMs = Number(process.argv[4] ?? 5000);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1700, height: 1100 },
    deviceScaleFactor: 2,
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("PAGE ERROR:", m.text().slice(0, 200));
  });
  await page.goto(url, { waitUntil: "load", timeout: 120000 });

  // Scroll through the page to trigger IntersectionObservers on lazy-loaded pictographs.
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  const step = 800;
  for (let y = 0; y < pageHeight; y += step) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(200);
  }
  // Scroll back to top for the screenshot
  await page.evaluate(() => window.scrollTo(0, 0));

  // Wait for all async pictograph preparer work to settle.
  await page.waitForTimeout(waitMs);

  await page.screenshot({ path: out, fullPage: true });
  console.log("saved", out);
} finally {
  await browser.close();
}
