import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import {
  encodeLetterVariants,
  bakeOgImage,
  loadCsv,
  pictographDataForLetter,
} from "../../scripts/bake-notation-images";

// A committed, already-rendered pictograph PNG stands in for the canvas render
// step (which needs the native `canvas` binding). The encode + OG pipeline it
// feeds is what these tests exercise, live, via sharp.
const SOURCE_PNG = resolve(process.cwd(), "static/images/grant-feature/pictograph-B.png");

let outDir: string;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), "bake-test-"));
});
afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("bake-notation-images encode pipeline", () => {
  it("encodes a letter into full WebP, small WebP, and PNG with slugged names", async () => {
    const png = readFileSync(SOURCE_PNG);
    const v = await encodeLetterVariants(png, "Σ-", outDir);

    expect(v.webp).toContain("kinetic-alphabet-letter-sigma-dash.webp");
    expect(v.webpSmall).toContain("kinetic-alphabet-letter-sigma-dash-small.webp");
    expect(v.png).toContain("kinetic-alphabet-letter-sigma-dash.png");

    for (const p of Object.values(v)) expect(existsSync(p)).toBe(true);

    const full = await sharp(v.webp).metadata();
    expect(full.format).toBe("webp");
    expect(full.width).toBe(950);
    expect(full.height).toBe(950);

    const small = await sharp(v.webpSmall).metadata();
    expect(small.format).toBe("webp");
    expect(small.width).toBe(400);

    const fallback = await sharp(v.png).metadata();
    expect(fallback.format).toBe("png");
  });

  it("bakes a 1200x630 social-share og-image", async () => {
    const out = join(outDir, "og.png");
    await bakeOgImage(out, [SOURCE_PNG]);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("reads the representative pictograph row for a letter from the dataframe", () => {
    const csv = loadCsv();
    const data = pictographDataForLetter("A", csv);
    expect(data.letter).toBe("A");
    expect(data.motions.blue.motionType).toBeTruthy();
    expect(data.motions.red.motionType).toBeTruthy();
  });
});
