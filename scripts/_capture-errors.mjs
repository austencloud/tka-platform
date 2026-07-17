import { chromium } from "playwright-core";
const url = process.argv[2] ?? "http://localhost:5180/guide/codex";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  const requests500 = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      errors.push(m.type() + ": " + m.text().slice(0, 500));
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 400) requests500.push(r.status() + " " + r.url().slice(0, 120));
  });
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(8000);
  console.log("ERRORS:", JSON.stringify(errors, null, 2));
  console.log("FAILED_REQS:", JSON.stringify(requests500, null, 2));
} finally {
  await browser.close();
}
