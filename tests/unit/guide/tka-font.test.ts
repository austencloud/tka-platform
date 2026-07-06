import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

/**
 * Guards the generated TKA Letters webfont (scripts/build-tka-font.mjs). Loads the
 * committed tka.ttf and asserts the real cmap + ligature contract — most
 * importantly that the ASCII-name ligatures are case-sensitive, so the word `MU`
 * (M+U) never collapses to the letter μ. See
 * docs/superpowers/specs/2026-07-06-tka-letters-font-design.md.
 */
const TTF = path.resolve(process.cwd(), "static/fonts/tka/tka.ttf");

function loadFont() {
  const buf = fs.readFileSync(TTF);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

type Lig = { seq: string; out: number; n: number; first: number };

function ligatures(font: opentype.Font, gid: (c: string) => number): Lig[] {
  const rev: Record<number, string> = {};
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-ΣΔΘΩμνΦΨΛταβγζη⊕";
  for (const c of chars) rev[gid(c)] = c;
  const out: Lig[] = [];
  for (const l of (font.tables.gsub?.lookups ?? []) as any[]) {
    if (l.lookupType !== 4) continue;
    for (const st of l.subtables) {
      const cov: number[] = st.coverage.glyphs
        ? st.coverage.glyphs
        : (st.coverage.ranges ?? []).flatMap((r: any) => {
            const a: number[] = [];
            for (let i = r.start; i <= r.end; i++) a.push(i);
            return a;
          });
      st.ligatureSets.forEach((set: any[], ci: number) => {
        const first = cov[ci]!;
        for (const L of set) {
          const comps = [first, ...L.components];
          out.push({ seq: comps.map((x) => rev[x] ?? `#${x}`).join(""), out: L.ligGlyph, n: comps.length, first });
        }
      });
    }
  }
  return out;
}

describe("TKA Letters font", () => {
  const font = loadFont();
  const gid = (c: string) => font.charToGlyphIndex(c);

  it("has a real cmap for Latin, Greek, and ⊕", () => {
    for (const ch of "AVWZ") expect(gid(ch), ch).toBeGreaterThan(0);
    for (const ch of "ΣΔΘΩμνΦΨΛταβγζη⊕") expect(gid(ch), ch).toBeGreaterThan(0);
    expect(gid("-"), "hyphen").toBeGreaterThan(0);
  });

  it("keeps lowercase letters as glyphs DISTINCT from uppercase", () => {
    // Required for case-sensitive ligatures (the MU/NU fix).
    expect(gid("m")).not.toBe(gid("M"));
    expect(gid("u")).not.toBe(gid("U"));
    expect(gid("n")).not.toBe(gid("N"));
    expect(gid("a")).not.toBe(gid("A"));
  });

  it("ligates lowercase Greek names but NOT the all-caps words", () => {
    const lig = ligatures(font, gid);
    const has = (s: string) => lig.some((l) => l.seq === s);
    // words stay literal
    expect(has("MU"), "MU must not ligate").toBe(false);
    expect(has("NU"), "NU must not ligate").toBe(false);
    expect(has("ALPHA"), "ALPHA must not ligate").toBe(false);
    // names resolve
    expect(has("mu"), "mu → μ").toBe(true);
    expect(has("nu"), "nu → ν").toBe(true);
    expect(has("alpha"), "alpha → α").toBe(true);
    expect(has("Sigma"), "Sigma → Σ").toBe(true);
    expect(has("terra"), "terra → ⊕").toBe(true);
  });

  it("ligates dash letters (base+'-' and name+'-')", () => {
    const lig = ligatures(font, gid);
    const has = (s: string) => lig.some((l) => l.seq === s);
    expect(has("W-")).toBe(true); // Latin base + hyphen
    expect(has("Sigma-")).toBe(true); // name + hyphen (Type 3)
    expect(has("Phi-")).toBe(true); // name + hyphen (Type 5)
    // NOTE: `τ-` (tau-dash) has no source SVG in letters_trimmed, so it is
    // intentionally absent until the asset is provided. See the build's [warn].
    expect(has("tau-")).toBe(false);
  });

  it("registers each shared glyph exactly once (α/β/γ, Y/Z dedupe)", () => {
    const lig = ligatures(font, gid);
    for (const name of ["alpha", "beta", "gamma"]) {
      expect(lig.filter((l) => l.seq === name).length, `${name} duplicated`).toBe(1);
    }
  });

  it("orders longer ligatures first so 'Sigma-' beats 'Sigma'", () => {
    const lig = ligatures(font, gid);
    const sSet = lig.filter((l) => l.first === gid("S"));
    const iDash = sSet.findIndex((l) => l.seq === "Sigma-");
    const iBase = sSet.findIndex((l) => l.seq === "Sigma");
    expect(iDash).toBeGreaterThanOrEqual(0);
    expect(iBase).toBeGreaterThanOrEqual(0);
    expect(iDash).toBeLessThan(iBase); // dash form comes first in the LigatureSet
  });

  it("carries the full glyph set (letters + lowercase twins + hyphen)", () => {
    expect(font.glyphs.length).toBeGreaterThanOrEqual(80);
  });
});
