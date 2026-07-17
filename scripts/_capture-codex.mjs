// Codex-specific capture: waits for SVG content to actually appear in cells.
//   node scripts/_capture-codex.mjs <url> <outPng>
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5180/guide/codex";
const out = process.argv[3] ?? "C:/tka-platform/static/test/codex-final.png";

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-web-security", "--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1700, height: 1100 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 300));
  });

  // Use domcontentloaded — avoids timing out on Firebase requests
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Wait for the Svelte app to hydrate: first cell should get an SVG inside .picto
  try {
    await page.waitForFunction(
      () => {
        const picto = document.querySelector(".codex-cell .picto svg");
        return !!picto;
      },
      { timeout: 30000 }
    );
    console.log("SVG appeared in first cell");
  } catch {
    console.log("Timeout waiting for SVG — capturing anyway");
  }

  // Let async pictograph preparer settle (prop/arrow loading is sequential per cell)
  await page.waitForTimeout(10000);

  // Report cell content
  const cellInfo = await page.evaluate(() => {
    const cells = document.querySelectorAll(".codex-cell");
    let withSvg = 0, withArrow = 0, withProp = 0;
    cells.forEach((cell) => {
      const svg = cell.querySelector("svg");
      if (svg) withSvg++;
      // Arrow SVGs contain path elements (curve shapes)
      const paths = cell.querySelectorAll("path");
      if (paths.length > 2) withArrow++;
      // Prop images are <image> tags inside the SVG
      const images = cell.querySelectorAll("image");
      if (images.length > 0) withProp++;
    });
    return { total: cells.length, withSvg, withArrow, withProp };
  });
  console.log("Cell info:", JSON.stringify(cellInfo));
  if (errors.length) console.log("Errors:", errors.slice(0, 5));

  await page.screenshot({ path: out, fullPage: true });
  console.log("saved", out);
} finally {
  await browser.close();
}
