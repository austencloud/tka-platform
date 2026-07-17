// Debug capture: forces all IntersectionObservers by setting isIntersecting = true
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5180/guide/codex";
const out = process.argv[3] ?? "/tmp/capture.png";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1700, height: 10000 },  // Very tall viewport to make everything visible
    deviceScaleFactor: 2,
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("PAGE ERROR:", m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => console.log("UNCAUGHT:", e.message.slice(0, 300)));
  
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  
  // Report how many guide-pictograph elements exist and their isVisible state
  const info = await page.evaluate(() => {
    const wrappers = document.querySelectorAll('.guide-pictograph');
    const pictRenderers = document.querySelectorAll('.pictograph-renderer, [class*="pictograph"]');
    const svgs = document.querySelectorAll('svg');
    const codexBoxes = document.querySelectorAll('.codex-box');
    return {
      wrappers: wrappers.length,
      renderers: pictRenderers.length,
      svgs: svgs.length,
      codexBoxes: codexBoxes.length,
      bodyHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });
  console.log("DOM info:", JSON.stringify(info, null, 2));
  
  await page.waitForTimeout(5000);
  await page.screenshot({ path: out, fullPage: true });
  console.log("saved", out);
} finally {
  await browser.close();
}
