import { chromium } from "playwright-core";
const url = process.argv[2] ?? "http://localhost:5180/guide/codex";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("ERR:", m.text().slice(0, 400));
  });
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(10000);

  const result = await page.evaluate(() => {
    const cells = document.querySelectorAll(".codex-cell");
    const sample = [];
    cells.forEach((cell, i) => {
      if (i < 6) {
        const svg = cell.querySelector("svg");
        const paths = cell.querySelectorAll("path");
        const lines = cell.querySelectorAll("line");
        const images = cell.querySelectorAll("image");
        const g = cell.querySelectorAll("g");
        sample.push({
          i,
          hasSvg: !!svg,
          svgChildCount: svg ? svg.children.length : 0,
          paths: paths.length,
          lines: lines.length,
          images: images.length,
          groups: g.length,
          svgHtml: svg ? svg.innerHTML.slice(0, 200) : "none"
        });
      }
    });
    return { totalCells: cells.length, sample };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
