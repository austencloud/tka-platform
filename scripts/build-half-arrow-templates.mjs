// Run: npx tsx scripts/build-half-arrow-templates.mjs [baseUrl]
//      (default baseUrl https://localhost:5173 — the dev server must be up)
//
// Generates one Illustrator-ready template per MISSING half-arrow glyph (the
// orange holes on /test/half-movements) into assets/half-arrow-templates/.
//
// Fidelity is guaranteed by construction: each template's background is the
// LIVE pictograph the production pipeline renders for that family's canonical
// seed motion — captured from /test/half-movements with headless chromium,
// not re-derived. What you draw against is exactly what the app shows.
//
// Template anatomy (see assets/half-arrow-templates/README.md):
//   REFERENCE__notes      — instructions + seed facts (locked, ignored by ingest)
//   REFERENCE__pictograph — the captured render: grid, hand points, staff at
//                           the halfway pose, and the current FALLBACK arrow
//                           dimmed to 35% as a weight/anchor ghost
//   ARROW                 — empty layer to draw into (ingest takes everything
//                           outside REFERENCE groups, so drawing loose is fine)
//
// Post-capture fixups for Illustrator compatibility:
//   - CSS `style="transform: ...px ...deg"` -> SVG `transform` attributes
//     (Illustrator ignores CSS transforms; props and arrows both use them)
//   - halo <defs>/filter attributes stripped (AI renders them unreliably)
import { writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { JSDOM } from "jsdom";
import { allFamilySeeds, turnsKey } from "./half-arrow-seeds.mjs";

const BASE = process.argv[2] ?? "https://localhost:5173";
const OUT_DIR = resolve(process.cwd(), "assets/half-arrow-templates");
const LOC_WORD = { n: "North", e: "East", s: "South", w: "West" };

/** Which families already have real art (from the asset files on disk) —
 *  templates are only generated for the holes. */
function hasArt(seed) {
  const dir = resolve(process.cwd(), `static/images/arrows/${seed.mt}_half/from_radial`);
  return existsSync(dir) && readdirSync(dir).includes(`${seed.asset}.svg`);
}

/** CSS transform value ("translate(10px, 20px) rotate(45deg) scale(1, -1)")
 *  -> SVG transform attribute ("translate(10, 20) rotate(45) scale(1, -1)"). */
function cssTransformToSvg(css) {
  return css
    .replace(/\s+/g, " ")
    .replace(/(-?\d*\.?\d+)(px|deg)/g, "$1")
    .trim();
}

function postProcess(capturedSvgMarkup) {
  const doc = new JSDOM(`<body>${capturedSvgMarkup}</body>`).window.document;
  const svg = doc.querySelector("svg");

  // CSS style transforms -> SVG attributes (props + arrows use CSS style).
  for (const el of svg.querySelectorAll("[style]")) {
    const style = el.getAttribute("style") ?? "";
    const m = style.match(/(?:^|;)\s*transform\s*:\s*([^;]+)/);
    if (m) {
      el.setAttribute("transform", cssTransformToSvg(m[1]));
      const rest = style.replace(/(?:^|;)\s*transform\s*:\s*[^;]+/, "").trim();
      if (rest) el.setAttribute("style", rest);
      else el.removeAttribute("style");
    }
  }

  // Strip halo filters + their defs (Illustrator renders them unreliably).
  for (const el of svg.querySelectorAll("[filter]")) el.removeAttribute("filter");
  for (const d of svg.querySelectorAll("defs")) {
    if (d.querySelector("filter")) d.remove();
  }

  // Dim the fallback arrow into a ghost reference.
  for (const g of svg.querySelectorAll("g.arrow-svg")) {
    g.setAttribute("opacity", "0.35");
    g.setAttribute("data-ghost", "current fallback glyph — weight/anchor reference only");
  }

  return svg.innerHTML;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function templateSvg(seed, pictographInner) {
  const t = turnsKey(seed.turns);
  const motionDesc =
    seed.mt === "static"
      ? `static at ${LOC_WORD[seed.start] ?? seed.start}`
      : `${LOC_WORD[seed.start] ?? seed.start} → ${LOC_WORD[seed.end] ?? seed.end}`;
  const lines = [
    `${seed.asset}.svg — halved ${seed.mt}, ${t === "fl" ? "float" : t} turns`,
    `Seed motion: ${motionDesc}, prop ${seed.rot === "cw" ? "clockwise" : "counter-clockwise"} · halfway pose shown (staff + grid)`,
    `Draw the halfway arrow at the ghost's weight. Ghost (35% opacity) = wrong-turns fallback art: correct anchor + stroke weight, wrong arc.`,
    `Use FILLED shapes (Object > Path > Outline Stroke before saving). Keep everything else — ingest ignores REFERENCE groups.`,
    `Then: npx tsx scripts/ingest-half-arrows.mjs`,
  ];
  const notes = lines
    .map(
      (line, i) =>
        `<text x="12" y="${-132 + i * 26}" font-family="system-ui, sans-serif" font-size="${i === 0 ? 24 : 17}" fill="${i === 0 ? "#111" : "#555"}"${i === 0 ? ' font-weight="700"' : ""}>${esc(line)}</text>`
    )
    .join("\n    ");

  // Anchor crosshair at the hand point the glyph is placed on.
  const { x, y } = seed.H;
  const cross =
    `<g stroke="#a855f7" stroke-width="2" opacity="0.9">` +
    `<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}"/>` +
    `<line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y + 14}"/>` +
    `<circle cx="${x}" cy="${y}" r="9" fill="none"/></g>` +
    `<text x="${x + 18}" y="${y - 12}" font-family="system-ui, sans-serif" font-size="15" fill="#a855f7">anchor</text>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="950" height="1105" viewBox="0 -155 950 1105">
  <g id="REFERENCE__notes">
    <rect x="0" y="-155" width="950" height="155" fill="#f5f3ff"/>
    ${notes}
  </g>
  <g id="REFERENCE__pictograph">
    <rect x="0" y="0" width="950" height="950" fill="#ffffff"/>
    ${pictographInner}
    ${cross}
  </g>
  <g id="ARROW"><!-- Draw the halved arrow here (anywhere outside REFERENCE groups works) --></g>
</svg>
`;
}

const seeds = allFamilySeeds();
const holes = seeds.filter((s) => !hasArt(s));
console.log(`${holes.length} art holes to template (of ${seeds.length} families). Capturing from ${BASE} ...`);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1700, height: 1100 },
    ignoreHTTPSErrors: true,
  });
  await page.goto(`${BASE}/test/half-movements`, { waitUntil: "load", timeout: 120000 });

  // Every legal family's mini must have its (fallback) arrow populated.
  await page.waitForFunction(
    (count) =>
      [...document.querySelectorAll(".mcell .mini svg")].filter((s) =>
        s.querySelector("g.arrow-svg")
      ).length >= count,
    seeds.length,
    { timeout: 90000 }
  );

  mkdirSync(OUT_DIR, { recursive: true });
  for (const seed of holes) {
    const title = `${seed.mt} · ${seed.turns === "fl" ? "fl" : seed.turns} turns`;
    const markup = await page.evaluate((t) => {
      const cell = [...document.querySelectorAll(".mcell")].find((b) =>
        (b.getAttribute("title") ?? "").startsWith(t)
      );
      return cell?.querySelector(".mini svg")?.outerHTML ?? null;
    }, title);
    if (!markup) throw new Error(`no matrix cell found for "${title}"`);
    const svg = templateSvg(seed, postProcess(markup));
    const out = resolve(OUT_DIR, `${seed.asset}.svg`);
    writeFileSync(out, svg, "utf8");
    console.log(`wrote ${out}`);
  }
} finally {
  await browser.close();
}
console.log(`\nDone. Open any file in assets/half-arrow-templates/ in Illustrator, draw, save,`);
console.log(`then run: npx tsx scripts/ingest-half-arrows.mjs`);
