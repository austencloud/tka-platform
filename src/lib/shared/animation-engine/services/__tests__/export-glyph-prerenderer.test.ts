import { describe, it, expect, vi } from "vitest";
import { ExportGlyphPrerenderer } from "../export-glyph-prerenderer";
import { SvgImageConverter } from "$lib/shared/foundation/services/svg-image-converter";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import { getLetterImagePath } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
import {
  getTurnNumberImagePath,
  HALF_MARK_IMAGE_PATH,
} from "$lib/shared/pictograph/tka-glyph/utils/turn-tuple-parser";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

// Coverage for the halved-motion mark parity fix
// (docs/superpowers/specs/2026-07-16-half-notation-canon-design.md ledger):
// the video-export prerenderer's composite SVG string must inline the same
// half.svg mark the live TurnsColumn.svelte draws, not silently drop it.
//
// buildAndCacheGlyph is private and takes pre-fetched svgTextCache/
// svgDimsCache maps as parameters, so it can be exercised directly (no
// network fetch, no real canvas/browser image decode - just the pure
// composite-SVG-string assembly) by pre-seeding those caches and swapping in
// a stub SvgImageConverter that captures the string it was asked to convert.
describe("ExportGlyphPrerenderer - halved-motion mark", () => {
  function makeConverter(): { converter: SvgImageConverter; getCaptured: () => string } {
    const converter = new SvgImageConverter();
    let captured = "";
    vi.spyOn(converter, "convertSvgStringToImage").mockImplementation(
      async (svgString: string) => {
        captured = svgString;
        return {} as HTMLImageElement;
      }
    );
    return { converter, getCaptured: () => captured };
  }

  it("inlines the half-mark SVG content for a halved, displayed top slot", async () => {
    const { converter, getCaptured } = makeConverter();
    const prerenderer = new ExportGlyphPrerenderer(converter);

    const letterPath = getLetterImagePath(Letter.A);
    const topPath = getTurnNumberImagePath(1);
    const bottomPath = getTurnNumberImagePath(2);

    const svgTextCache = new Map<string, string>([
      [letterPath, `<svg viewBox="0 0 100 100"><path d="M0 0"/></svg>`],
      [topPath, `<svg viewBox="0 0 30 45"><path id="TOP_NUMBER" d="M1 1"/></svg>`],
      [bottomPath, `<svg viewBox="0 0 30 45"><path id="BOTTOM_NUMBER" d="M2 2"/></svg>`],
      [
        HALF_MARK_IMAGE_PATH,
        `<svg viewBox="0 0 16 45"><path id="HALF_MARK" d="M3 3"/></svg>`,
      ],
    ]);
    const svgDimsCache = new Map();

    // "(1/, 2)" -> top halved+displayed, bottom displayed+unhalved
    const buildAndCacheGlyph = (
      prerenderer as unknown as {
        buildAndCacheGlyph: (
          key: string,
          data: {
            letter: string;
            turnsTuple: string;
            topColor: string;
            bottomColor: string;
            step: StepData;
          },
          isDarkMode: boolean,
          svgTextCache: Map<string, string>,
          svgDimsCache: Map<string, unknown>
        ) => Promise<void>;
      }
    ).buildAndCacheGlyph.bind(prerenderer);

    await buildAndCacheGlyph(
      "test-key",
      {
        letter: Letter.A,
        turnsTuple: "(1/, 2)",
        topColor: "#3575E2",
        bottomColor: "#ED1C24",
        step: {} as StepData,
      },
      false,
      svgTextCache,
      svgDimsCache
    );

    expect(prerenderer.getGlyph("test-key")).not.toBeNull();

    const composite = getCaptured();
    expect(composite).toContain("HALF_MARK");
    expect(composite).toContain("TOP_NUMBER");
    expect(composite).toContain("BOTTOM_NUMBER");
  });

  it("inlines the half-mark alone (no number) for a halved 0-turn slot", async () => {
    const { converter, getCaptured } = makeConverter();
    const prerenderer = new ExportGlyphPrerenderer(converter);

    const letterPath = getLetterImagePath(Letter.A);

    const svgTextCache = new Map<string, string>([
      [letterPath, `<svg viewBox="0 0 100 100"><path d="M0 0"/></svg>`],
      [
        HALF_MARK_IMAGE_PATH,
        `<svg viewBox="0 0 16 45"><path id="HALF_MARK" d="M3 3"/></svg>`,
      ],
    ]);
    const svgDimsCache = new Map();

    const buildAndCacheGlyph = (
      prerenderer as unknown as {
        buildAndCacheGlyph: (
          key: string,
          data: {
            letter: string;
            turnsTuple: string;
            topColor: string;
            bottomColor: string;
            step: StepData;
          },
          isDarkMode: boolean,
          svgTextCache: Map<string, string>,
          svgDimsCache: Map<string, unknown>
        ) => Promise<void>;
      }
    ).buildAndCacheGlyph.bind(prerenderer);

    // "(0/, 0)" -> top halved with a 0 value (mark-alone), bottom not shown at all
    await buildAndCacheGlyph(
      "test-key-zero",
      {
        letter: Letter.A,
        turnsTuple: "(0/, 0)",
        topColor: "#3575E2",
        bottomColor: "#ED1C24",
        step: {} as StepData,
      },
      false,
      svgTextCache,
      svgDimsCache
    );

    expect(prerenderer.getGlyph("test-key-zero")).not.toBeNull();

    const composite = getCaptured();
    expect(composite).toContain("HALF_MARK");
  });
});
