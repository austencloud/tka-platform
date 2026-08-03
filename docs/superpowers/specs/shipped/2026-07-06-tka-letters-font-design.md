# TKA Letters Webfont — Design

**Date:** 2026-07-06
**Status:** approved ("make it so"; ASCII-name-ligature input chosen)
**Goal:** A real webfont for the TKA alphabet you can **type on a normal keyboard**
and that stays **selectable/copyable text** — "works just like a real font."

## Source

`static/images/letters_trimmed/{Type1..Type6}/*.svg` — 60 single-`<path>` fill
glyphs whose filenames already ARE the letters (`A.svg`, `Σ.svg`, `W-.svg`,
`⊕.svg`). All share a 0–100 vertical viewBox (trimmed only horizontally), so
vertical metrics are consistent; scale uniformly and baseline-align at the bottom
(no per-glyph height normalize — that would balloon the hyphen and flatten forms).
The 55 `Letter` values (`src/lib/shared/foundation/domain/models/letter.ts`) map
1:1 to these files (single-char letters + 12 two-char dash letters).

## Build pipeline — `scripts/build-tka-font.mjs`

`svgicons2svgfont` → `svg2ttf` → `ttf2woff2`. Run manually / when glyphs change
(not in the app build). Outputs `static/fonts/tka/tka.woff2` (web) + `tka.ttf`
(tooling/tests). Deps added as devDependencies: `svgicons2svgfont`, `svg2ttf`,
`ttf2woff2`, `opentype.js`.

Options: `fontHeight: 1000`, `normalize: false`, `centerHorizontally: true`,
`ascent: 1000`, `descent: 0`, `fixedWidth: false` (proportional advances).
Synthesize two glyphs the source set lacks: `space` (U+0020, empty advance) and
`hyphen-minus` (U+002D, a small centered bar) so a stray `-` isn't tofu.

## Codepoint + ligature scheme

Each glyph gets a `unicode` metadata array; single-char entries become real
`cmap` codepoints, multi-char entries become `liga` GSUB ligatures. One glyph can
carry several.

| Glyph set | Direct cmap | Ligature name(s) |
|---|---|---|
| A–V, W–Z | `U+0041…005A` | — |
| α β γ ζ η τ μ ν | real Greek cp | `alpha beta gamma zeta eta tau mu nu` |
| Σ Δ Θ Ω Φ Ψ Λ | real Greek cp | `Sigma Delta Theta Omega Phi Psi Lambda` |
| ⊕ terra | `U+2295` | `terra` |
| W- X- Y- Z- | — | base+`-` (e.g. `W`+`U+002D`) |
| Σ- Δ- Θ- Ω- Φ- Ψ- Λ- τ- | — | `Sigma-` … `phi-` `tau-`, plus real `Σ-` |

Rules:
- **Longer-first ordering:** `Sigma-` must be listed/sorted before `Sigma` so the
  dash form wins; verify the emitted GSUB honors this.
- **Case disambiguation (resolves the `MU`/`NU`-word collision):** TKA
  letter sequences are always UPPERCASE, so `MU` = M+U, `NU` = N+U, `ALPHA` =
  A+L+P+H+A — literal letters. The Greek glyphs are reached only by a
  differently-cased name: lowercase for lowercase Greek (`mu ν→nu`, `alpha`,
  `tau`, `beta`…), Capitalized for uppercase Greek (`Sigma`, not `SIGMA`). Because
  ligatures match on glyph IDs, this ONLY works if lowercase letters are **distinct
  glyphs** from uppercase.
- **Lowercase a–z are their own glyph slots** (duplicate the uppercase TKA
  artwork). This (a) keeps the `mu`/`MU` ligature case-sensitive so an all-caps
  word never ligates, and (b) shows TKA letters (not tofu) mid-typing `alph…`
  until the lowercase name completes to `α`.
- Underlying text is exactly what was typed — real selectable/copyable characters.
- A synthesized hyphen + the Latin/Greek cmap mean every keystroke has a glyph.

## Consuming the font

Global `@font-face { font-family:"TKA Letters"; src:url("/fonts/tka/tka.woff2")
format("woff2"); }` in a shared stylesheet, plus a `.tka-font` utility
(`font-family:"TKA Letters"; font-feature-settings:"liga" 1, "dlig" 1;`). Apply to
any input/text run → typing renders TKA glyphs. Existing image-glyph usages
(PositionGlyph, guide labels) are left untouched; the font is the new typeable
path, adoptable incrementally.

## Verification

- **Automated (no screenshot):** `tests/unit/guide/tka-font.test.ts` loads the
  built `tka.ttf` via `opentype.js` and asserts (a) `cmap` carries `A`, `Σ`, `α`,
  `⊕`, and distinct lowercase `m`; (b) `liga` GSUB carries the dash + name
  ligatures (`W-`, `Sigma-`, `alpha`, `mu`, …) and that `mu` is a ligature while
  the all-caps `MU` pair is NOT (case-disambiguation proof); (c) glyph count ≥ 88
  (60 letters + 26 lowercase duplicates + space + hyphen).
- **Build-time guard:** the script logs any source SVG that fails to become a
  glyph or whose viewBox height deviates from ~100, and fails loudly rather than
  silently dropping a letter.
- **Visual:** `/test/tka-font` route renders typed strings (`ABΣα`, `W-`,
  `Sigma-`, `alpha`, `terra`) in the font for eyeball confirmation.

## Non-goals

- No insert-palette component (names cover input; palette is a later add).
- No color/SVG-in-OpenType (these are monochrome outline glyphs).
- Not migrating existing image-glyph call sites this turn.

## Files

- **Create:** `scripts/build-tka-font.mjs`; `static/fonts/tka/tka.{woff2,ttf}`
  (generated); a shared `@font-face` stylesheet + `.tka-font` class;
  `src/routes/test/tka-font/+page.svelte`; `tests/unit/guide/tka-font.test.ts`.
- **Edit:** `package.json` (devDeps + a `font:build` script).
