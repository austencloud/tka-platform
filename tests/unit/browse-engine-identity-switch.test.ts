import { tick } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

interface PendingLoad {
  readonly userId: string | null;
  readonly resolve: (sequences: SequenceData[]) => void;
}

const mocks = vi.hoisted(() => ({
  pending: [] as PendingLoad[],
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", async () => {
  const { browseEngineAuthTestState } =
    await import("./browse-engine-auth-test-state.svelte");
  return { authState: browseEngineAuthTestState };
});

vi.mock("$lib/shared/debug/state/user-preview-state.svelte", () => ({
  isPreviewReadOnly: () => false,
}));

vi.mock("$lib/shared/browse/get-browse-loader", () => ({
  getBrowseLoader: () => ({
    loadSequenceMetadata: vi.fn(async () => []),
    refreshFromFirestore: vi.fn(async () => []),
    removeFromCache: vi.fn(),
  }),
}));

vi.mock("$lib/shared/library/get-library-repository", async () => {
  const { browseEngineAuthTestState } =
    await import("./browse-engine-auth-test-state.svelte");
  return {
    getLibraryRepository: () => ({
      getSequences: () =>
        new Promise<SequenceData[]>((resolve) => {
          mocks.pending.push({
            userId: browseEngineAuthTestState.effectiveUserId,
            resolve,
          });
        }),
    }),
  };
});

vi.mock("$lib/shared/settings/state/settings-state.svelte", () => ({
  settingsService: {
    settings: { gridZoomByBucket: {} },
    updateSetting: vi.fn(),
  },
}));

vi.mock("$lib/shared/library/library-events", () => ({
  onLibraryMutated: () => () => {},
  onLibrarySequenceAdded: () => () => {},
}));

vi.mock("$lib/shared/library/services/collection-manager", () => ({
  toggleFavorite: vi.fn(),
}));

vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { browseEngineAuthTestState } from "./browse-engine-auth-test-state.svelte";
import { createBrowseEngineForTest } from "./browse-engine-test-helpers.svelte";

function sequence(id: string): SequenceData {
  return {
    id,
    name: id,
    word: "",
    steps: [],
    thumbnails: [],
    tags: [],
    metadata: {},
    isFavorite: false,
    isCircular: false,
  };
}

describe("BrowseEngine effective identity switching", () => {
  beforeEach(() => {
    mocks.pending = [];
    browseEngineAuthTestState.effectiveUserId = "owner";
  });

  it("reloads for preview and exit without accepting stale account rows", async () => {
    const { engine, dispose } = createBrowseEngineForTest({
      persistKey: null,
      initialSource: "my-library",
    });

    const initialLoad = engine.initialize();
    expect(mocks.pending.map((request) => request.userId)).toEqual(["owner"]);

    browseEngineAuthTestState.effectiveUserId = "preview-user";
    await tick();
    expect(mocks.pending.map((request) => request.userId)).toEqual([
      "owner",
      "preview-user",
    ]);

    mocks.pending[1]!.resolve([sequence("preview-row")]);
    await tick();
    expect(engine.allSequences.map((item) => item.id)).toEqual(["preview-row"]);

    mocks.pending[0]!.resolve([sequence("stale-owner-row")]);
    await initialLoad;
    await tick();
    expect(engine.allSequences.map((item) => item.id)).toEqual(["preview-row"]);

    browseEngineAuthTestState.effectiveUserId = "owner";
    await tick();
    expect(mocks.pending[2]?.userId).toBe("owner");
    mocks.pending[2]!.resolve([sequence("restored-owner-row")]);
    await tick();
    expect(engine.allSequences.map((item) => item.id)).toEqual([
      "restored-owner-row",
    ]);

    engine.destroy();
    dispose();
  });
});
