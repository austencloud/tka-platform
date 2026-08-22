import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
  cache: vi.fn(),
  paths: {
    blue: [{ d: "M 10 0 C 10 0, 20 0, 30 0", tipIndex: 0 }],
    red: [{ d: "M -10 0 C -10 0, -20 0, -30 0", tipIndex: 0 }],
    purple: [],
  },
}));

vi.mock("$app/navigation", () => ({ goto: mocks.goto }));
vi.mock("$lib/shared/mandala/services/mandala-geometry-calculator", () => ({
  calculate: vi.fn(() => mocks.paths),
}));
vi.mock("$lib/features/sticker-lab/get-sticker-sheet-repository", () => ({
  getStickerSheetRepository: () => ({
    load: mocks.load,
    save: mocks.save,
    clear: vi.fn(),
  }),
}));
vi.mock("$lib/features/sticker-lab/state/mandala-paths-cache.svelte", () => ({
  cachePrimitivePaths: mocks.cache,
}));

import { sendToStickerLab } from "$lib/shared/sequence-viewer/services/send-to-sticker-lab";

describe("sendToStickerLab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockReturnValue(null);
  });

  it("persists geometric identity and keeps the sequence only as the path source", () => {
    sendToStickerLab({
      id: "sequence-1",
      word: "ALPHA",
      loopType: "rotated-loop",
      steps: [{}],
    } as unknown as SequenceData);

    const saved = mocks.save.mock.calls[0]![0];
    expect(saved.stickers[0].primitiveRef).toMatchObject({
      identityKind: "geometry-v1",
      representativeSequenceId: "sequence-1",
      sourceLoop: {
        sequenceId: "sequence-1",
        word: "ALPHA",
        loopType: "rotated-loop",
      },
    });
    expect(saved.stickers[0].primitiveRef.shapeHash).not.toBe("sequence-1");
    expect(mocks.cache).toHaveBeenCalledWith(
      saved.stickers[0].primitiveRef.shapeHash,
      mocks.paths
    );
    expect(mocks.goto).toHaveBeenCalledWith("/lab/stickers");
  });
});
