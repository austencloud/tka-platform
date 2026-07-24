import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { buildCoverageSummary } =
  require("../../../scripts/sync-static-thumbnails.cjs") as {
    buildCoverageSummary: (
      keys: string[]
    ) => Record<
      string,
      Record<
        string,
        Record<string, { noQr: number; qr: number; total: number }>
      >
    >;
  };

describe("static thumbnail manifest coverage", () => {
  it("groups current and legacy keys by variant, prop, mode, and QR class", () => {
    const summary = buildCoverageSummary([
      "gallery/staff/AAAA_public-1_dark",
      "gallery/staff/BBBB_public-2_qr_dark",
      "gallery/fan/CCCC_public-3_dark",
      "gallery/fan/DDDD_public-4_qr_dark",
      "gallery/fan/EEEE_public-5_light",
      "wordcard/fan/FFFF_public-6_qr_light",
      "staff/LEGACY_dark",
    ]);

    expect(summary.gallery.staff.dark).toEqual({
      noQr: 1,
      qr: 1,
      total: 2,
    });
    expect(summary.gallery.fan.dark).toEqual({
      noQr: 1,
      qr: 1,
      total: 2,
    });
    expect(summary.gallery.fan.light).toEqual({
      noQr: 1,
      qr: 0,
      total: 1,
    });
    expect(summary.wordcard.fan.light).toEqual({
      noQr: 0,
      qr: 1,
      total: 1,
    });
    expect(summary.legacy.staff.dark).toEqual({
      noQr: 1,
      qr: 0,
      total: 1,
    });
  });
});
