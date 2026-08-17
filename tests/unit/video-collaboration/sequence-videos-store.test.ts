import { beforeEach, describe, expect, it, vi } from "vitest";

const getVideosForSequence = vi.fn();

vi.mock(
  "$lib/shared/video-collaboration/services/collaborative-video-manager",
  () => ({
    getVideosForSequence: (id: string) => getVideosForSequence(id),
    deleteVideo: vi.fn(),
    saveVideo: vi.fn(),
    updateStepMap: vi.fn(),
  })
);

const { getSequenceVideosStore, resetSequenceVideoStores } = await import(
  "$lib/shared/video-collaboration/state/sequence-videos-store.svelte"
);

describe("sequence videos store", () => {
  beforeEach(() => {
    resetSequenceVideoStores();
    getVideosForSequence.mockReset();
  });

  it("reports a failed load as an error, not an empty gallery", async () => {
    // The surface renders "No videos yet" beside an upload button whenever the
    // list is empty and no error is held. A denied read that resolves to []
    // therefore tells a performer their footage does not exist.
    getVideosForSequence.mockRejectedValue(
      new Error("Missing or insufficient permissions.")
    );

    const store = getSequenceVideosStore("X-BΦ-θ-");
    await store.load();

    expect(store.videos).toEqual([]);
    expect(store.error).toBe("Missing or insufficient permissions.");
    expect(store.loading).toBe(false);
  });

  it("retries after a failure instead of holding the empty list", async () => {
    getVideosForSequence.mockRejectedValueOnce(new Error("offline"));
    const store = getSequenceVideosStore("X-BΦ-θ-");
    await store.load();
    expect(store.error).toBe("offline");

    getVideosForSequence.mockResolvedValueOnce([{ id: "video-1" }]);
    await store.load();

    expect(store.error).toBe("");
    expect(store.videos).toHaveLength(1);
  });

  it("keeps a genuine empty list free of any error", async () => {
    getVideosForSequence.mockResolvedValue([]);
    const store = getSequenceVideosStore("no-videos-here");
    await store.load();

    expect(store.videos).toEqual([]);
    expect(store.error).toBe("");
  });
});
