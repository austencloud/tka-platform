import { describe, it, expect } from "vitest";
import {
  FILM_RENDER_PRESETS,
  estimateFilmRenderSeconds,
  formatFilmRenderEstimate,
  matchFilmRenderPreset,
} from "../film-render-presets";

describe("matchFilmRenderPreset", () => {
  it("names each preset from its own settings", () => {
    for (const preset of FILM_RENDER_PRESETS) {
      expect(
        matchFilmRenderPreset({
          fps: preset.fps,
          resolution: preset.resolution,
          quality: preset.quality,
        })
      ).toBe(preset.id);
    }
  });

  it("falls back to custom when the options match no preset", () => {
    expect(
      matchFilmRenderPreset({ fps: 120, resolution: 1080, quality: "standard" })
    ).toBe("custom");
    // Same numbers as Final, but the cinema pass makes it a different render.
    expect(
      matchFilmRenderPreset({ fps: 60, resolution: 1080, quality: "cinema" })
    ).toBe("custom");
  });
});

describe("estimateFilmRenderSeconds", () => {
  it("is zero for an empty recording", () => {
    expect(
      estimateFilmRenderSeconds(0, { fps: 60, resolution: 1080, quality: "standard" })
    ).toBe(0);
  });

  it("grows with duration, frame rate, resolution, and the cinema pass", () => {
    const draft = { fps: 30, resolution: 720, quality: "standard" as const };
    const final = { fps: 60, resolution: 1080, quality: "standard" as const };
    const cinema = { fps: 60, resolution: 2160, quality: "cinema" as const };
    expect(estimateFilmRenderSeconds(20, draft)).toBeLessThan(
      estimateFilmRenderSeconds(20, final)
    );
    expect(estimateFilmRenderSeconds(20, final)).toBeLessThan(
      estimateFilmRenderSeconds(20, cinema)
    );
    expect(estimateFilmRenderSeconds(40, final)).toBeCloseTo(
      estimateFilmRenderSeconds(20, final) * 2,
      5
    );
  });

  it("uses the standard-resolution cost for an unknown resolution", () => {
    expect(
      estimateFilmRenderSeconds(10, { fps: 60, resolution: 999, quality: "standard" })
    ).toBeCloseTo(30, 5);
  });
});

describe("formatFilmRenderEstimate", () => {
  it("says seconds for a short wait and minutes for a long one", () => {
    expect(formatFilmRenderEstimate(0)).toBe("");
    expect(formatFilmRenderEstimate(42)).toBe("about 42 s");
    expect(formatFilmRenderEstimate(180)).toBe("about 3 min");
  });
});
