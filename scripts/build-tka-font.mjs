/**
 * Build the "TKA Letters" webfont from the trimmed letter glyph SVGs.
 *
 *   static/images/letters_trimmed/{Type1..Type6}/*.svg
 *      → svgicons2svgfont (SVG font, real cmap + ligature metadata)
 *      → svg2ttf (TTF: cmap + liga GSUB)
 *      → ttf2woff2 (WOFF2 for the web)
 *      → static/fonts/tka/tka.{ttf,woff2}
 *
 * Typing story (see docs/superpowers/specs/2026-07-06-tka-letters-font-design.md):
 *   - A–V, W–Z type directly (real Latin cmap).
 *   - Greek reached by ASCII name — lowercase for lowercase Greek (`alpha`, `mu`),
 *     Capitalized for uppercase Greek (`Sigma`) — via `liga` ligatures.
 *   - Dash letters ligate base + `-` (`W-`) or name + `-` (`Sigma-`).
 *   - Case disambiguates the MU/NU-word collision: ALL-CAPS is always literal
 *     letters, so `MU` = M+U while lowercase `mu` = μ. That requires lowercase
 *     a–z to be DISTINCT glyphs (same uppercase artwork, own glyph IDs) so the
 *     ligature is case-sensitive.
 *
 * Run: `node scripts/build-tka-font.mjs` (or `pnpm font:build`). Not part of the
 * app build — regenerate only when glyphs change.
 */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { SVGIcons2SVGFontStream } from "svgicons2svgfont";
import svg2ttf from "svg2ttf";
import ttf2woff2 from "ttf2woff2";
import opentype from "opentype.js";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const SRC_DIR = path.join(ROOT, "static/images/letters_trimmed");
const OUT_DIR = path.join(ROOT, "static/fonts/tka");
const FONT_NAME = "TKA Letters";
const FONT_HEIGHT = 1000;

// Greek char → ASCII ligature name. Lowercase Greek gets a lowercase name;
// uppercase Greek a Capitalized one; ⊕ is `terra`.
const GREEK_NAME = {
  α: "alpha", β: "beta", γ: "gamma", ζ: "zeta", η: "eta", τ: "tau", μ: "mu", ν: "nu",
  Σ: "Sigma", Δ: "Delta", Θ: "Theta", Ω: "Omega", Φ: "Phi", Ψ: "Psi", Λ: "Lambda",
  "⊕": "terra",
};

const isLatinUpper = (ch) => ch >= "A" && ch <= "Z";

function makeGlyphFromSvg(name, svg, unicode) {
  const stream = Readable.from(svg);
  stream.metadata = { name, unicode };
  return stream;
}

/** One glyph to feed the font stream. `unicode` = cmap codepoints + ligatures.
 *  `perturb` bumps the viewBox height 0.02% so a lowercase twin keeps a DISTINCT
 *  glyph ID (svg2ttf dedupes byte-identical outlines, which would collapse `a`
 *  onto `A` and re-break the case-sensitive `mu`/`MU` ligature). Imperceptible. */
function makeGlyph(name, svgPath, unicode, perturb = false) {
  let svg = fs.readFileSync(svgPath, "utf8");
  if (perturb) {
    svg = svg.replace(/viewBox="([^"]+)"/, (_, vb) => {
      const p = vb.split(/\s+/).map(Number);
      p[3] = p[3] * 1.0002; // negligible vertical rescale → distinct outline
      return `viewBox="${p.join(" ")}"`;
    });
  }
  return makeGlyphFromSvg(name, svg, unicode);
}

/** Synthesized hyphen (no source SVG). Needed as a real glyph so the `W-`/`Σ-`
 *  ligatures have a component, and so a stray `-` isn't tofu. Same 0–100 vertical
 *  canvas as the letters; a centred bar. */
function makeHyphenGlyph() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100"><path d="M6 44 H54 V56 H6 Z"/></svg>`;
  return makeGlyphFromSvg("hyphen", svg, ["-"]);
}

// Every TKA letter that should be in the font (canonical alphabet, minus any the
// asset set is missing — currently τ-). Used to flag missing source glyphs loudly.
const EXPECTED = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Σ Δ Θ Ω μ ν W- X- Y- Z- Σ- Δ- Θ- Ω- Φ Ψ Λ τ- Φ- Ψ- Λ- α β γ ζ η τ ⊕".split(" ");

// The same value appears in more than one type dir (α/β/γ in Type1 & Type6, Y/Z
// in Type2 & Type3). Dedupe by value with a canonical dir priority so each glyph
// (and thus each ligature) is registered exactly once.
const DIR_PRIORITY = ["Type6", "Type2", "Type1", "Type3", "Type4", "Type5"];

function collectGlyphs() {
  const glyphs = [];
  const byValue = new Map();
  for (const type of DIR_PRIORITY) {
    const dir = path.join(SRC_DIR, type);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".svg")) continue;
      const value = f.slice(0, -4);
      if (!byValue.has(value)) byValue.set(value, path.join(dir, f)); // priority wins
    }
  }
  const files = [...byValue].map(([value, file]) => ({ value, file }));

  const missing = EXPECTED.filter((v) => !byValue.has(v));
  if (missing.length) console.warn(`[warn] no source SVG for: ${missing.join(", ")} (skipped — provide the asset to include)`);

  // Guard: warn on any glyph whose vertical canvas deviates from the shared 0–100.
  for (const { value, file } of files) {
    const vb = /viewBox="([^"]+)"/.exec(fs.readFileSync(file, "utf8"));
    if (vb) {
      const [, , , h] = vb[1].split(/\s+/).map(Number);
      if (Math.abs(h - 100) > 5) console.warn(`[warn] ${value}: viewBox height ${h} ≠ ~100 (baseline may drift)`);
    }
  }

  // Emit DASH letters first so `Sigma-` is registered before `Sigma` in the
  // shared first-glyph LigatureSet (longest-match wins).
  const dash = files.filter((f) => f.value.length === 2 && f.value[1] === "-");
  const single = files.filter((f) => !(f.value.length === 2 && f.value[1] === "-"));

  let n = 0;
  for (const { value, file } of dash) {
    const base = value[0];
    const unicode = [value]; // ligature: base + '-' (e.g. "W-", "Σ-")
    if (GREEK_NAME[base]) unicode.push(`${GREEK_NAME[base]}-`); // e.g. "Sigma-"
    glyphs.push(makeGlyph(`g${n++}_${GREEK_NAME[base] ?? base}dash`, file, unicode));
  }
  for (const { value, file } of single) {
    const unicode = [value]; // real cmap codepoint (Latin or Greek or ⊕)
    if (GREEK_NAME[value]) unicode.push(GREEK_NAME[value]); // name ligature
    glyphs.push(makeGlyph(`g${n++}_${GREEK_NAME[value] ?? value}`, file, unicode));
    // Lowercase Latin twin: distinct glyph (same artwork) so ligatures stay
    // case-sensitive and mid-typing a Greek name shows letters, not tofu.
    if (isLatinUpper(value)) {
      glyphs.push(makeGlyph(`g${n++}_${value}_lc`, file, [value.toLowerCase()], true));
    }
  }
  glyphs.push(makeHyphenGlyph());
  return glyphs;
}

function buildSvgFont(glyphs) {
  return new Promise((resolve, reject) => {
    const stream = new SVGIcons2SVGFontStream({
      fontName: FONT_NAME,
      fontHeight: FONT_HEIGHT,
      normalize: false,
      centerHorizontally: true,
      ascent: FONT_HEIGHT,
      descent: 0,
      fixedWidth: false,
      log: () => {},
    });
    let out = "";
    stream.on("data", (c) => (out += c)).on("end", () => resolve(out)).on("error", reject);
    for (const g of glyphs) stream.write(g);
    stream.end();
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const glyphs = collectGlyphs();
  console.log(`Collected ${glyphs.length} glyphs.`);

  const svgFont = await buildSvgFont(glyphs);
  const ttf = Buffer.from(svg2ttf(svgFont, { description: "TKA Kinetic Alphabet letters" }).buffer);
  fs.writeFileSync(path.join(OUT_DIR, "tka.ttf"), ttf);
  const woff2 = ttf2woff2(ttf);
  fs.writeFileSync(path.join(OUT_DIR, "tka.woff2"), woff2);

  // Self-verify: reload the TTF and confirm cmap + ligatures landed.
  const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
  const cp = (ch) => font.charToGlyphIndex(ch);
  const need = { A: cp("A"), Σ: cp("Σ"), α: cp("α"), "⊕": cp("⊕"), m: cp("m") };
  const missing = Object.entries(need).filter(([, i]) => !i).map(([c]) => c);
  const ligCount = (font.tables.gsub?.lookups ?? [])
    .filter((l) => l.lookupType === 4)
    .reduce((s, l) => s + l.subtables.reduce((a, st) => a + (st.ligatureSets?.flat().length ?? 0), 0), 0);

  console.log(`TTF ${ttf.length}B, WOFF2 ${woff2.length}B, glyphs ${font.glyphs.length}, liga ${ligCount}`);
  console.log(`cmap check → A:${need.A} Σ:${need.Σ} α:${need.α} ⊕:${need["⊕"]} m:${need.m}`);
  if (missing.length) throw new Error(`Missing cmap glyphs: ${missing.join(", ")}`);
  if (ligCount < 20) throw new Error(`Too few ligatures (${ligCount}) — expected the dash + name set`);
  console.log(`✔ wrote ${path.relative(ROOT, OUT_DIR)}/tka.{ttf,woff2}`);
}

main().catch((e) => {
  console.error("build-tka-font failed:", e);
  process.exit(1);
});
