// Diagnostic: why do codex pictographs render grids but no arrows/props?
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5180/guide/codex";
const browser = await chromium.launch({ headless: true });
const errors = [];
const failed = [];
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 240)); });
  page.on("requestfailed", (r) => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 120)}`));
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 120)}`); });

  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  // scroll through the page so IntersectionObservers fire for every cell
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(8000);

  const stats = await page.evaluate(() => {
    const pics = [...document.querySelectorAll(".guide-pictograph")];
    const sample = pics.slice(0, 3).map((p) => {
      const html = p.innerHTML;
      return {
        len: html.length,
        svgs: p.querySelectorAll("svg").length,
        paths: p.querySelectorAll("path").length,
        images: p.querySelectorAll("image").length,
        hasArrow: /arrow/i.test(html),
        hasProp: /prop|staff/i.test(html),
        hasFallbackImg: !!p.querySelector("img.fallback-img"),
      };
    });
    return {
      total: pics.length,
      withSvg: pics.filter((p) => p.querySelector("svg")).length,
      withImage: pics.filter((p) => p.querySelector("image")).length,
      withFallback: pics.filter((p) => p.querySelector("img.fallback-img")).length,
      sample,
    };
  });

  console.log("URL:", url);
  console.log("STATS:", JSON.stringify(stats, null, 2));
  console.log("CONSOLE ERRORS (" + errors.length + "):");
  errors.slice(0, 12).forEach((e) => console.log("  •", e));
  console.log("FAILED REQUESTS (" + failed.length + "):");
  [...new Set(failed)].slice(0, 15).forEach((f) => console.log("  •", f));
} finally {
  await browser.close();
}
