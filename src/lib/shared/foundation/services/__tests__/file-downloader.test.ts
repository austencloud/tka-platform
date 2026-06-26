import { describe, it, expect } from "vitest";
import {
  sanitizeFilename,
  generateTimestampedFilename,
} from "../file-downloader";

describe("sanitizeFilename — Greek glyph preservation", () => {
  it("keeps Greek letters intact (no ASCII transliteration)", () => {
    // The screenshot bug: "JΦJΦKΦJΦ" was exported as "JphiJphiKphiJphi".
    // sanitizeFilename must preserve the real glyphs.
    expect(sanitizeFilename("JΦJΦKΦJΦ")).toBe("JΦJΦKΦJΦ");
  });

  it("preserves every TKA Greek letter and the dash suffix", () => {
    expect(sanitizeFilename("ΣΔΘΩΦΨΛ-")).toBe("ΣΔΘΩΦΨΛ-");
    expect(sanitizeFilename("αβγ")).toBe("αβγ");
  });

  it("preserves case (does not lowercase)", () => {
    expect(sanitizeFilename("JphiKphi")).toBe("JphiKphi");
  });

  it("still strips illegal path characters", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe(
      "a_b_c_d_e_f_g_h_i_j"
    );
  });
});

describe("generateTimestampedFilename", () => {
  it("keeps Greek glyphs in the base name", () => {
    const name = generateTimestampedFilename("VΛ-", "mp4", false);
    expect(name).toMatch(/^VΛ-_\d{4}-\d{2}-\d{2}\.mp4$/);
  });
});
