import { chromium } from "playwright-core";
const url = process.argv[2] ?? "http://localhost:5180/guide/codex";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const aborts = [];
  page.on("requestfailed", (r) => aborts.push(r.url().split("/").slice(-2).join("/")));
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.evaluate(async () => { window.scrollTo(0, 300); await new Promise((r) => setTimeout(r, 200)); window.scrollTo(0, 0); });
  await page.waitForTimeout(9000);
  const html = await page.evaluate(() => {
    const p = document.querySelector(".guide-pictograph");
    const svg = p?.querySelector("svg");
    return svg ? svg.outerHTML : "(no svg)";
  });
  // collapse whitespace, show structure
  console.log("ABORTED:", [...new Set(aborts)].slice(0, 8).join(", "));
  console.log("SVG (first 2600 chars):\n", html.replace(/\s+/g, " ").slice(0, 2600));
} finally { await browser.close(); }
