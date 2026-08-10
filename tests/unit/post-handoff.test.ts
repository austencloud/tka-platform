import { describe, expect, it, vi, beforeEach } from "vitest";

const detectPlatform = vi.hoisted(() => vi.fn(() => "desktop"));
const supportsNativeFileShare = vi.hoisted(() => vi.fn(() => true));
const canNativeShareFile = vi.hoisted(() => vi.fn(() => true));

vi.mock("$lib/shared/mobile/services/platform-detector", () => ({
  detectPlatform,
}));

vi.mock("$lib/shared/foundation/services/file-downloader", async () => {
  const actual = await vi.importActual<
    typeof import("$lib/shared/foundation/services/file-downloader")
  >("$lib/shared/foundation/services/file-downloader");
  return { ...actual, supportsNativeFileShare, canNativeShareFile };
});

const { buildArtifactFilename, resolveDestinations } = await import(
  "$lib/shared/share/services/post-handoff"
);

function pngBlob(): Blob {
  return new Blob(["x"], { type: "image/png" });
}

describe("post handoff destinations", () => {
  beforeEach(() => {
    detectPlatform.mockReturnValue("desktop");
    supportsNativeFileShare.mockReturnValue(true);
    canNativeShareFile.mockReturnValue(true);
  });

  it("leads with the native file share on mobile", () => {
    detectPlatform.mockReturnValue("mobile");

    const destinations = resolveDestinations({
      artifact: "video",
      blob: pngBlob(),
      filename: "FΨ.mp4",
    });

    expect(destinations[0]?.id).toBe("native-share");
    expect(destinations[0]?.primary).toBe(true);
  });

  it("never offers the native share on desktop, even though Chrome implements it", () => {
    // The gate is the DEVICE, not the capability — desktop Chrome supports
    // navigator.share and would pop the Windows share sheet for a file that
    // should just download.
    const destinations = resolveDestinations({
      artifact: "card",
      blob: pngBlob(),
      filename: "FΨ.png",
    });

    expect(destinations.map((d) => d.id)).not.toContain("native-share");
    expect(destinations[0]?.id).toBe("send-to-phone");
  });

  it("omits the clipboard-to-Facebook path for video, which cannot be copied", () => {
    const destinations = resolveDestinations({
      artifact: "video",
      blob: pngBlob(),
      filename: "FΨ.mp4",
    });

    expect(destinations.map((d) => d.id)).not.toContain("copy-image-facebook");
  });

  it("offers the clipboard-to-Facebook path for a card", () => {
    const destinations = resolveDestinations({
      artifact: "card",
      blob: pngBlob(),
      filename: "FΨ.png",
    });

    expect(destinations.map((d) => d.id)).toContain("copy-image-facebook");
  });

  it("still offers copy-caption while the video render is in flight", () => {
    const destinations = resolveDestinations({
      artifact: "video",
      blob: null,
      filename: "FΨ.mp4",
    });

    expect(destinations.map((d) => d.id)).toContain("copy-caption");
  });

  it("drops the native share when this browser cannot share the payload", () => {
    detectPlatform.mockReturnValue("mobile");
    canNativeShareFile.mockReturnValue(false);

    const destinations = resolveDestinations({
      artifact: "video",
      blob: pngBlob(),
      filename: "FΨ.mp4",
    });

    expect(destinations.map((d) => d.id)).not.toContain("native-share");
  });
});

describe("artifact filenames", () => {
  it("simplifies a repeated LOOP word", () => {
    expect(buildArtifactFilename("FΨFΨFΨFΨ", "video")).toBe("FΨ.mp4");
  });

  it("preserves Greek glyphs rather than mangling them to underscores", () => {
    expect(buildArtifactFilename("ΣΦΛ", "card")).toBe("ΣΦΛ.png");
  });

  it("falls back to a usable name when the word is empty", () => {
    expect(buildArtifactFilename("", "card")).toBe("sequence.png");
  });

  it("strips characters that are illegal in a path", () => {
    expect(buildArtifactFilename('A/B:C', "card")).toBe("A_B_C.png");
  });
});
