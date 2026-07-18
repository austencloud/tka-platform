import { chromium } from "playwright-core";
const url = process.argv[2] ?? "http://localhost:5180/guide/codex";
const idx = Number(process.argv[3] ?? 0);
const out = process.argv[4] ?? "/tmp/box.png";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1300 }, deviceScaleFactor: 3 });
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(9000);
  const box = page.locator(".codex-box").nth(idx);
  await box.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await box.screenshot({ path: out });
  console.log("saved", out);
} finally { await browser.close(); }
