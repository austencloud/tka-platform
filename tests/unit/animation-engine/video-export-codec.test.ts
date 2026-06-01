// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { selectCodec } from "$lib/shared/animation-engine/workers/video-export.worker";

describe("video-export worker selectCodec", () => {
  it("uses Constrained Baseline (0x42e0) on mobile", () => {
    expect(selectCodec(1080, 1080, true)).toMatch(/^avc1\.42e0/);
  });
  it("uses High profile (0x6400) on desktop", () => {
    expect(selectCodec(1080, 1080, false)).toMatch(/^avc1\.6400/);
  });
  it("tracks resolution in the level byte", () => {
    expect(selectCodec(640, 480, false)).toBe("avc1.64001f");   // <=921600
    expect(selectCodec(1920, 1080, false)).toBe("avc1.640028"); // <=2073600
  });
});
