import { describe, expect, it } from "vitest";
import { shouldEnableAssemblyPlayback } from "../../../src/routes/landing/components/how-tka-assembly-model";

describe("How TKA playback model", () => {
  it("enables playback only when visible and motion is allowed", () => {
    expect(
      shouldEnableAssemblyPlayback({
        active: true,
        sectionVisible: true,
        documentVisible: true,
        reducedMotion: false,
      })
    ).toBe(true);
    expect(
      shouldEnableAssemblyPlayback({
        active: false,
        sectionVisible: true,
        documentVisible: true,
        reducedMotion: false,
      })
    ).toBe(false);
    expect(
      shouldEnableAssemblyPlayback({
        active: true,
        sectionVisible: false,
        documentVisible: true,
        reducedMotion: false,
      })
    ).toBe(false);
    expect(
      shouldEnableAssemblyPlayback({
        active: true,
        sectionVisible: true,
        documentVisible: false,
        reducedMotion: false,
      })
    ).toBe(false);
    expect(
      shouldEnableAssemblyPlayback({
        active: true,
        sectionVisible: true,
        documentVisible: true,
        reducedMotion: true,
      })
    ).toBe(false);
  });
});
