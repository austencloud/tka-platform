import { describe, it, expect, vi } from "vitest";

// ── Block transitive imports that crash in jsdom ──────────────────────────────
vi.mock("$lib/shared/di", () => ({ container: {} }));
vi.mock("$lib/shared/di/containers/core-container", () => ({}));
vi.mock("@firebase/firestore", () => ({}));
vi.mock("@firebase/firestore/lite", () => ({}));
vi.mock("$lib/shared/application/state/app-state.svelte", () => ({
  getSettings: vi.fn(() => ({})),
}));
vi.mock(
  "$lib/shared/settings/services/implementations/FirebaseSettingsPersister",
  () => ({
    FirebaseSettingsPersister: class {},
  })
);
vi.mock(
  "$lib/shared/animation-engine/state/animation-visibility-state.svelte",
  () => ({
    getAnimationVisibilityManager: vi.fn(() => ({
      getEffortPreset: () => "linear",
    })),
  })
);
vi.mock("$lib/features/compose/utils/animation-panel-persistence", () => ({
  loadTrailSettings: vi.fn(() => ({})),
}));
vi.mock(
  "$lib/features/compose/services/implementations/Canvas2DAnimationRenderer",
  () => ({
    Canvas2DAnimationRenderer: class {},
  })
);
vi.mock("$lib/shared/animation-engine/services/animator-loader", () => ({
  loadAnimatorServices: vi.fn(),
}));
// Mock the prop-type-applier to avoid deep landing imports
vi.mock("$lib/shared/landing/services/prop-type-applier", () => ({
  applyToSequence: vi.fn((seq: unknown) => seq),
}));
// Mock gridPositionDeriver
vi.mock("$lib/shared/pictograph/grid/services/grid-position-deriver", () => ({
  getGridPositionFromLocations: vi.fn(),
}));

import { SequenceChainingOrchestrator } from "$lib/shared/animation-engine/services/sequence-chaining-orchestrator";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type {
  IEndlessSpinnerOrchestrator,
  IInfiniteSequenceGenerator,
  IBroadcastProvider,
} from "$lib/shared/animation-engine/domain/chaining-types";

// ── Mock factories ────────────────────────────────────────────────────────────

function mockSpinner(): IEndlessSpinnerOrchestrator {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    getInitialSequence: vi.fn().mockResolvedValue(null),
    getNextSequence: vi.fn().mockResolvedValue(null),
  };
}

function mockInfinite(): IInfiniteSequenceGenerator {
  return {
    generateInitial: vi.fn().mockResolvedValue(null),
    generateFromEndState: vi.fn().mockResolvedValue(null),
    getSessionCount: vi.fn().mockReturnValue(0),
  };
}

function mockBroadcast(): IBroadcastProvider {
  return {
    subscribeToBroadcast: vi.fn().mockReturnValue(() => {}),
    calculateServerTimeOffset: vi.fn().mockResolvedValue(0),
    getCurrentStepPosition: vi.fn().mockReturnValue(1),
  };
}

function mockSequence(id: string) {
  return {
    id,
    name: id,
    word: id,
    steps: [],
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: {},
  } as any;
}

function mockPlaybackController() {
  return {
    initialize: vi.fn().mockReturnValue(true),
    togglePlayback: vi.fn(),
    seekToStep: vi.fn(),
  } as any;
}

function mockAnimationState() {
  return {
    currentStep: 0,
    isPlaying: false,
    setShouldLoop: vi.fn(),
    setPlaybackMode: vi.fn(),
    setCurrentStep: vi.fn(),
  } as any;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SequenceChainingOrchestrator — propType", () => {
  it("defaults to PropType.STAFF", () => {
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite()
    );
    expect(orch.propType).toBe(PropType.STAFF);
  });

  it("setPropType changes propType", () => {
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite()
    );
    orch.setPropType(PropType.FAN);
    expect(orch.propType).toBe(PropType.FAN);
  });
});

describe("SequenceChainingOrchestrator — history", () => {
  it("starts with empty history", () => {
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite()
    );
    expect(orch.getHistory()).toEqual([]);
  });

  it("historyCapacity defaults to 30", () => {
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite()
    );
    expect(orch.historyCapacity).toBe(30);
  });

  it("accepts custom historyCapacity via constructor options", () => {
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite(),
      undefined,
      { historyCapacity: 10 }
    );
    expect(orch.historyCapacity).toBe(10);
  });

  it("does not record a sequence the animation engine rejected", async () => {
    const playbackController = mockPlaybackController();
    vi.mocked(playbackController.initialize).mockReturnValue(false);
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite()
    );
    const swapped = vi.fn();
    orch.onSequenceSwapped(swapped);
    await orch.initialize(playbackController, mockAnimationState());

    orch.hotSwapSequence(mockSequence("invalid"));

    expect(orch.getHistory()).toEqual([]);
    expect(swapped).not.toHaveBeenCalled();
  });
});

describe("SequenceChainingOrchestrator — broadcast provider", () => {
  it("constructor accepts IBroadcastProvider without error", () => {
    const broadcast = mockBroadcast();
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite(),
      broadcast,
      { convertBroadcastSequence: vi.fn(() => mockSequence("live")) }
    );
    // No error thrown — orchestrator constructed successfully
    expect(orch).toBeDefined();
  });

  it("unsubscribes from Live when another source mode starts", async () => {
    const unsubscribe = vi.fn();
    const broadcast = mockBroadcast();
    vi.mocked(broadcast.subscribeToBroadcast).mockReturnValue(unsubscribe);
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite(),
      broadcast,
      { convertBroadcastSequence: vi.fn(() => mockSequence("live")) }
    );
    await orch.initialize(mockPlaybackController(), mockAnimationState());

    await orch.startAutoMode("live");
    await orch.startAutoMode("library");

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("converts, deduplicates, and synchronizes Live sequences", async () => {
    let broadcastCallback:
      | Parameters<IBroadcastProvider["subscribeToBroadcast"]>[0]
      | undefined;
    const broadcast = mockBroadcast();
    vi.mocked(broadcast.subscribeToBroadcast).mockImplementation((callback) => {
      broadcastCallback = callback;
      return vi.fn();
    });
    vi.mocked(broadcast.getCurrentStepPosition).mockReturnValue(3);

    const converted = mockSequence("converted-live");
    const convertBroadcastSequence = vi.fn(() => converted);
    const animationState = mockAnimationState();
    const swapped = vi.fn();
    const orch = new SequenceChainingOrchestrator(
      mockSpinner(),
      mockInfinite(),
      broadcast,
      { convertBroadcastSequence }
    );
    orch.onSequenceSwapped(swapped);
    await orch.initialize(mockPlaybackController(), animationState);
    await orch.startAutoMode("live");

    const state = {
      currentSequence: { id: "raw-live", totalSteps: 8 },
      sequenceNumber: 12,
      startedAtMs: 1_000,
      durationMs: 4_000,
      beatsPerMinute: 120,
    } as any;

    broadcastCallback?.(state);
    broadcastCallback?.(state);

    expect(convertBroadcastSequence).toHaveBeenCalledTimes(1);
    expect(swapped).toHaveBeenCalledTimes(1);
    expect(swapped).toHaveBeenCalledWith(converted);
    expect(broadcast.getCurrentStepPosition).toHaveBeenCalledWith(
      1_000,
      4_000,
      8,
      120
    );
    expect(animationState.setCurrentStep).toHaveBeenCalledWith(3);

    orch.dispose();
  });
});

describe("SequenceChainingOrchestrator — live mode guards", () => {
  it("checkAndChain is a no-op for 'live' mode", () => {
    const spinner = mockSpinner();
    const orch = new SequenceChainingOrchestrator(spinner, mockInfinite());
    // Call with conditions that would normally trigger chaining
    orch.checkAndChain(0, 4, "live", true, true);
    // getNextSequence would be called if chaining proceeded — verify it wasn't
    expect(spinner.getNextSequence).not.toHaveBeenCalled();
  });

  it("checkAndPreload is a no-op for 'live' mode", () => {
    const spinner = mockSpinner();
    const infinite = mockInfinite();
    const orch = new SequenceChainingOrchestrator(spinner, infinite);
    // Call with conditions that would normally trigger preloading
    orch.checkAndPreload(3, 8, "live", true, true);
    expect(spinner.getNextSequence).not.toHaveBeenCalled();
    expect(infinite.generateFromEndState).not.toHaveBeenCalled();
  });

  it("manual skip is a no-op while Live owns playback", async () => {
    const spinner = mockSpinner();
    const infinite = mockInfinite();
    const orch = new SequenceChainingOrchestrator(
      spinner,
      infinite,
      mockBroadcast()
    );
    await orch.initialize(mockPlaybackController(), mockAnimationState());
    await orch.startAutoMode("live");

    orch.skip();
    await flushPromises();

    expect(spinner.getNextSequence).not.toHaveBeenCalled();
    expect(infinite.generateFromEndState).not.toHaveBeenCalled();
  });
});

describe("SequenceChainingOrchestrator — source isolation", () => {
  it("uses the library provider when an un-preloaded library skip occurs", async () => {
    const spinner = mockSpinner();
    const infinite = mockInfinite();
    const orch = new SequenceChainingOrchestrator(spinner, infinite);
    await orch.initialize(mockPlaybackController(), mockAnimationState());
    orch.hotSwapSequence(mockSequence("library-current"));

    orch.skip();
    await flushPromises();

    expect(spinner.getNextSequence).toHaveBeenCalled();
    expect(infinite.generateFromEndState).not.toHaveBeenCalled();
  });

  it("keeps library preloading in library mode after Infinite was used", async () => {
    const spinner = mockSpinner();
    vi.mocked(spinner.getInitialSequence).mockResolvedValue(
      mockSequence("library-initial")
    );
    vi.mocked(spinner.getNextSequence)
      .mockResolvedValueOnce(mockSequence("library-next"))
      .mockResolvedValue(null);
    const infinite = mockInfinite();
    vi.mocked(infinite.getSessionCount).mockReturnValue(4);
    const orch = new SequenceChainingOrchestrator(spinner, infinite);
    await orch.initialize(mockPlaybackController(), mockAnimationState());

    await orch.startAutoMode("library");
    await flushPromises();
    orch.skip();
    await flushPromises();

    expect(spinner.getNextSequence).toHaveBeenCalledTimes(2);
    expect(infinite.generateFromEndState).not.toHaveBeenCalled();
  });

  it("ignores a generated result that finishes after the mode changed", async () => {
    let resolveGenerated!: (value: { sequence: any }) => void;
    const generated = new Promise<{ sequence: any }>((resolve) => {
      resolveGenerated = resolve;
    });
    const spinner = mockSpinner();
    vi.mocked(spinner.getInitialSequence).mockResolvedValue(
      mockSequence("library-current")
    );
    const infinite = mockInfinite();
    vi.mocked(infinite.generateInitial).mockReturnValue(generated);
    const orch = new SequenceChainingOrchestrator(spinner, infinite);
    await orch.initialize(mockPlaybackController(), mockAnimationState());

    const infiniteStart = orch.startAutoMode("infinite");
    await orch.startAutoMode("library");
    resolveGenerated({ sequence: mockSequence("stale-infinite") });
    await infiniteStart;

    expect(orch.getHistory().map((entry) => entry.sequence.id)).toEqual([
      "library-current",
    ]);
  });
});

describe("SequenceChainingOrchestrator — chaining toggle", () => {
  it("stops automatic chaining and preloading when disabled", async () => {
    const spinner = mockSpinner();
    const infinite = mockInfinite();
    const orch = new SequenceChainingOrchestrator(spinner, infinite);
    await orch.initialize(mockPlaybackController(), mockAnimationState());
    orch.hotSwapSequence(mockSequence("paused-chain"));
    orch.setChainingEnabled(false);

    orch.checkAndChain(0, 4, "library", true, true);
    orch.checkAndPreload(3, 8, "library", true, true);
    await flushPromises();

    expect(spinner.getNextSequence).not.toHaveBeenCalled();
    expect(infinite.generateFromEndState).not.toHaveBeenCalled();
  });
});
