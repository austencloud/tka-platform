import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFuseState,
  type FuseStateDeps,
} from "$lib/features/fuse/state/fuse-state.svelte";
import { fuseSequences } from "$lib/features/fuse/services/sequence-fuser";
import { PLAYBACK_MAX_BPM } from "$lib/shared/animation-engine/domain/constants/timing";
import type { HandPathData } from "$lib/shared/foundation/domain/models/hand-path-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { GeneratedSoloLoop } from "$lib/features/fuse/services/solo-loop-generator";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeHandPath(id: string, length: number): HandPathData {
  const locations = [
    GridLocation.NORTH,
    GridLocation.EAST,
    GridLocation.SOUTH,
    GridLocation.WEST,
  ];
  const path = Array.from(
    { length: length + 1 },
    (_, index) => locations[index % locations.length]!
  );

  return {
    id,
    locations: path,
    contentHash: id,
    startLocation: path[0]!,
    endLocation: path[path.length - 1]!,
    length,
    bigrams: [],
    uniqueLocations: [...new Set(path)],
    impliedGridMode: GridMode.DIAMOND,
    isClosed: path[0] === path[path.length - 1],
  };
}

function makeSequence(id: string, length: number): SequenceData {
  return {
    ...fuseSequences(
      makeHandPath(`${id}-blue`, length),
      makeHandPath(`${id}-red`, length)
    ),
    id,
    name: id,
    displayName: id,
    word: id.toUpperCase(),
    sequenceLength: length,
  };
}

function metadataOnly(sequence: SequenceData): SequenceData {
  return { ...sequence, steps: [] };
}

function blueOnly(sequence: SequenceData): SequenceData {
  const { redSoloProp: _redSoloProp, ...rest } = sequence;
  return rest;
}

function redOnly(sequence: SequenceData): SequenceData {
  const { blueSoloProp: _blueSoloProp, ...rest } = sequence;
  return rest;
}

function letterEveryStep(sequence: SequenceData): SequenceData {
  const letter = "A" as StepData["letter"];
  const steps = sequence.steps.map((step) => ({ ...step, letter }));
  return {
    ...sequence,
    steps,
    word: "A".repeat(steps.length),
    stepPairings: sequence.stepPairings?.map((pair) => ({ ...pair, letter })),
  };
}

function createLoader(
  metadata: SequenceData[],
  loadFullSequenceData: FuseStateDeps["browseLoader"]["loadFullSequenceData"] = async (
    _name,
    id
  ) => metadata.find((sequence) => sequence.id === id) ?? null
): FuseStateDeps["browseLoader"] {
  return {
    loadSequenceMetadata: vi.fn(async () => metadata),
    loadFullSequenceData: vi.fn(loadFullSequenceData),
  };
}

function createState(
  browseLoader: FuseStateDeps["browseLoader"],
  overrides: Partial<FuseStateDeps> = {}
) {
  return createFuseState({
    browseLoader,
    deriveLetters: async (sequence) => letterEveryStep(sequence),
    errorHandler: { showUserError: vi.fn(() => "fuse-test-error") },
    initialLength: 8,
    random: () => 0.999,
    prefersReducedMotion: () => true,
    ...overrides,
  });
}

function createSoloGenerator() {
  let generation = 0;
  return vi.fn(async (length: number): Promise<GeneratedSoloLoop> => {
    generation += 1;
    const sequence = makeSequence(`generated-${generation}`, length);
    return {
      solo: sequence.blueSoloProp!,
      loopSpec: { rewound: { period: 2 } },
    };
  });
}

describe("Fuse state", () => {
  // createFuseState persists the selected pair to localStorage ("fuse-tab-state",
  // fuse-state.svelte.ts:50) and initialize() restores it on mount, re-hydrating
  // those exact ids through browseLoader. Without this reset each test inherits
  // the previous test's pair and its state's first act is an unexpected
  // loadFullSequenceData for a foreign sequence.
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates independent one-hand LOOPs without loading the sequence gallery", async () => {
    const loader = createLoader([]);
    const generator = createSoloGenerator();
    const state = createState(loader, { generateSoloLoop: generator });

    await state.initialize();

    expect(generator).toHaveBeenCalledTimes(2);
    expect(generator).toHaveBeenNthCalledWith(1, 8);
    expect(loader.loadSequenceMetadata).not.toHaveBeenCalled();
    expect(loader.loadFullSequenceData).not.toHaveBeenCalled();
    expect(state.blue.sequence?.blueSoloProp).toBeDefined();
    expect(state.red.sequence?.redSoloProp).toBeDefined();
    expect(state.canFuse).toBe(true);

    const redHash = state.red.sequence?.redSoloProp?.contentHash;
    await state.shuffle("blue");

    expect(generator).toHaveBeenCalledTimes(3);
    expect(state.red.sequence?.redSoloProp?.contentHash).toBe(redHash);
    expect(state.blue.canGoBack).toBe(true);
  });

  it("chooses a new first step on one LOOP without changing its partner", async () => {
    const generator = createSoloGenerator();
    const state = createState(createLoader([]), {
      generateSoloLoop: generator,
    });
    await state.initialize();

    const originalBlueStart = state.blue.sequence?.blueSoloProp?.startLocation;
    const originalRedHash = state.red.sequence?.redSoloProp?.contentHash;
    await state.adjustSource("blue", { kind: "first-step", step: 2 });

    expect(state.error).toBeNull();
    expect(state.blue.sequence?.blueSoloProp?.startLocation).not.toBe(
      originalBlueStart
    );
    expect(state.red.sequence?.redSoloProp?.contentHash).toBe(originalRedHash);
    expect(state.canFuse).toBe(true);
  });

  it("keeps one-hand LOOP closure through every independent source transform", async () => {
    const state = createState(createLoader([]), {
      generateSoloLoop: createSoloGenerator(),
    });
    await state.initialize();

    const adjustments = [
      { kind: "rotate", quarterTurns: 1 },
      { kind: "rotate", quarterTurns: -1 },
      { kind: "mirror" },
      { kind: "flip" },
      { kind: "invert" },
      { kind: "reset" },
    ] as const;

    for (const adjustment of adjustments) {
      await state.adjustSource("blue", adjustment);
      expect(state.error, adjustment.kind).toBeNull();
      expect(state.canFuse, adjustment.kind).toBe(true);
    }
  });

  it("applies a symmetry relationship as one state transition", async () => {
    const state = createState(createLoader([]), {
      generateSoloLoop: createSoloGenerator(),
    });
    await state.initialize();

    expect(state.mode).toBe("shuffle");
    expect(state.driverSide).toBe("blue");
    expect(state.transformId).toBe("mirror");

    state.setRelationship("red", "rotate90");

    expect(state.mode).toBe("symmetry");
    expect(state.driverSide).toBe("red");
    expect(state.transformId).toBe("rotate90");
    await vi.waitFor(() => {
      expect(state.statusMessage).toBe("Blue follows Red (Rotate 90).");
    });
    expect(state.canFuse).toBe(true);
  });

  it("distinguishes a catalog failure from an exact-length empty pool", async () => {
    const showUserError = vi.fn(() => "catalog-error");
    const loader = createLoader([]);
    vi.mocked(loader.loadSequenceMetadata).mockRejectedValueOnce(
      new Error("catalog offline")
    );
    const state = createState(loader, { errorHandler: { showUserError } });

    await state.initialize();

    expect(state.error?.kind).toBe("catalog");
    expect(state.statusMessage).toBe("Couldn't load paths. Try again.");
    expect(state.canRetry).toBe(true);
    expect(state.blue.sequence).toBeNull();
    expect(state.red.sequence).toBeNull();
    expect(showUserError).toHaveBeenCalledOnce();
  });

  it("keeps exact-length empty data empty instead of falling back", async () => {
    const eight = makeSequence("eight", 8);
    const loader = createLoader([eight]);
    const state = createState(loader);

    await state.initialize();
    expect(state.appliedLength).toBe(8);
    expect(state.blue.sequence?.id).toBe("eight");

    await state.setLength(12);

    expect(state.requestedLength).toBe(12);
    expect(state.appliedLength).toBeNull();
    expect(state.blue.sequence).toBeNull();
    expect(state.red.sequence).toBeNull();
    expect(state.previewSequence).toBeNull();
    expect(state.error?.kind).toBe("empty");
    expect(state.statusMessage).toBe(
      "No 12-step paths are available. Choose another length."
    );
  });

  it("commits both sources and the preview atomically after a length load", async () => {
    const blue = blueOnly(makeSequence("blue-four", 4));
    const red = redOnly(makeSequence("red-four", 4));
    const blueRequest = deferred<SequenceData | null>();
    const redRequest = deferred<SequenceData | null>();
    const metadata = [metadataOnly(blue), metadataOnly(red)];
    const loader = createLoader(metadata, async (_name, id) => {
      return id === blue.id ? blueRequest.promise : redRequest.promise;
    });
    const state = createState(loader, { initialLength: 4 });

    const loading = state.initialize();
    await vi.waitFor(() => {
      expect(loader.loadFullSequenceData).toHaveBeenCalledWith(
        blue.word,
        blue.id
      );
    });

    blueRequest.resolve(blue);
    await vi.waitFor(() => {
      expect(loader.loadFullSequenceData).toHaveBeenCalledWith(
        red.word,
        red.id
      );
    });

    expect(state.blue.sequence).toBeNull();
    expect(state.red.sequence).toBeNull();
    expect(state.previewSequence).toBeNull();

    redRequest.resolve(red);
    await loading;

    expect(state.blue.sequence?.id).toBe(blue.id);
    expect(state.red.sequence?.id).toBe(red.id);
    expect(state.previewSequence?.sequenceLength).toBe(4);
    expect(state.appliedLength).toBe(4);
    expect(state.canFuse).toBe(true);
  });

  it("deduplicates hydration shared by the Blue and Red decks", async () => {
    const fullSequence = makeSequence("shared", 8);
    const loader = createLoader(
      [metadataOnly(fullSequence)],
      async () => fullSequence
    );
    const state = createState(loader);

    await state.initialize();

    expect(loader.loadFullSequenceData).toHaveBeenCalledOnce();
    expect(state.blue.sequence?.id).toBe(fullSequence.id);
    expect(state.red.sequence?.id).toBe(fullSequence.id);
    expect(state.canFuse).toBe(true);
  });

  it("retries a hydration that previously resolved without data", async () => {
    const fullSequence = makeSequence("retryable", 8);
    let attempts = 0;
    const loader = createLoader([metadataOnly(fullSequence)], async () => {
      attempts += 1;
      return attempts === 1 ? null : fullSequence;
    });
    const state = createState(loader);

    await state.initialize();
    expect(state.error?.kind).toBe("empty");
    expect(loader.loadFullSequenceData).toHaveBeenCalledOnce();

    await state.setLength(8);

    expect(loader.loadFullSequenceData).toHaveBeenCalledTimes(2);
    expect(state.canFuse).toBe(true);
    expect(state.blue.sequence?.id).toBe(fullSequence.id);
    expect(state.red.sequence?.id).toBe(fullSequence.id);
  });

  it("ignores an older length request that resolves after a newer one", async () => {
    const four = makeSequence("four", 4);
    const eight = makeSequence("eight", 8);
    const fourRequest = deferred<SequenceData | null>();
    const eightRequest = deferred<SequenceData | null>();
    const metadata = [metadataOnly(four), metadataOnly(eight)];
    const loader = createLoader(metadata, async (_name, id) => {
      return id === four.id ? fourRequest.promise : eightRequest.promise;
    });
    const state = createState(loader, { initialLength: 4 });

    const olderLoad = state.initialize();
    await vi.waitFor(() => {
      expect(loader.loadFullSequenceData).toHaveBeenCalledWith(
        four.word,
        four.id
      );
    });

    const newerLoad = state.setLength(8);
    await vi.waitFor(() => {
      expect(loader.loadFullSequenceData).toHaveBeenCalledWith(
        eight.word,
        eight.id
      );
    });

    eightRequest.resolve(eight);
    await newerLoad;
    expect(state.appliedLength).toBe(8);

    fourRequest.resolve(four);
    await olderLoad;

    expect(state.appliedLength).toBe(8);
    expect(state.blue.sequence?.id).toBe(eight.id);
    expect(state.red.sequence?.id).toBe(eight.id);
    expect(state.previewSequence?.sequenceLength).toBe(8);
  });

  it("ignores a side replacement that resolves after the length changes", async () => {
    const firstEight = makeSequence("first-eight", 8);
    const secondEight = metadataOnly(makeSequence("second-eight", 8));
    const four = makeSequence("four", 4);
    const olderSideRequest = deferred<SequenceData | null>();
    const loader = createLoader(
      [firstEight, secondEight, four],
      async (_name, id) =>
        id === secondEight.id ? olderSideRequest.promise : four
    );
    const state = createState(loader);

    await state.initialize();
    const olderShuffle = state.shuffle("blue");
    await vi.waitFor(() => {
      expect(loader.loadFullSequenceData).toHaveBeenCalledWith(
        secondEight.word,
        secondEight.id
      );
    });

    await state.setLength(4);
    expect(state.appliedLength).toBe(4);

    olderSideRequest.resolve(makeSequence("second-eight", 8));
    await olderShuffle;

    expect(state.appliedLength).toBe(4);
    expect(state.blue.sequence?.id).toBe(four.id);
    expect(state.red.sequence?.id).toBe(four.id);
    expect(state.previewSequence?.sequenceLength).toBe(4);
  });

  it("skips candidates that do not carry the required side data", async () => {
    const redCandidate = redOnly(makeSequence("red-candidate", 8));
    const blueCandidate = blueOnly(makeSequence("blue-candidate", 8));
    const loader = createLoader([redCandidate, blueCandidate]);
    const state = createState(loader);

    await state.initialize();

    expect(state.blue.sequence?.id).toBe(blueCandidate.id);
    expect(state.red.sequence?.id).toBe(redCandidate.id);
    expect(state.blue.poolPosition).toBe(2);
    expect(state.red.poolPosition).toBe(1);
  });

  it("returns to a hydrated previous source without loading it again", async () => {
    const first = makeSequence("first", 8);
    const second = makeSequence("second", 8);
    const third = makeSequence("third", 8);
    const loader = createLoader([first, second, third]);
    const state = createState(loader);

    await state.initialize();
    await state.shuffle("blue");
    expect(state.blue.sequence?.id).toBe(second.id);
    expect(state.blue.canGoBack).toBe(true);

    state.previous("blue");

    expect(state.blue.sequence?.id).toBe(first.id);
    expect(loader.loadFullSequenceData).not.toHaveBeenCalled();
  });

  it("keeps the shared playback phase through Shuffle and Back", async () => {
    let scheduledFrame: FrameRequestCallback | null = null;
    let frameId = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        scheduledFrame = callback;
        frameId += 1;
        return frameId;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const first = makeSequence("first", 8);
    const second = makeSequence("second", 8);
    const replacement = deferred<SequenceData | null>();
    const loader = createLoader(
      [first, metadataOnly(second)],
      async (_name, id) => (id === second.id ? replacement.promise : first)
    );
    const state = createState(loader);

    try {
      await state.initialize();
      state.startClock();

      const firstTick = scheduledFrame;
      expect(firstTick).not.toBeNull();
      firstTick!(1_000);

      const secondTick = scheduledFrame;
      expect(secondTick).not.toBeNull();
      secondTick!(2_500);
      const phaseBeforeShuffle = state.currentStep;
      expect(phaseBeforeShuffle).toBeCloseTo(1.5);

      const shuffle = state.shuffle("blue");
      await vi.waitFor(() => {
        expect(loader.loadFullSequenceData).toHaveBeenCalledWith(
          second.word,
          second.id
        );
      });

      const pendingTick = scheduledFrame;
      expect(pendingTick).not.toBeNull();
      pendingTick!(3_500);
      expect(state.currentStep).toBeGreaterThan(phaseBeforeShuffle);

      replacement.resolve(second);
      await shuffle;
      const phaseAfterShuffle = state.currentStep;
      expect(phaseAfterShuffle).toBeCloseTo(2.5);

      state.previous("blue");
      expect(state.currentStep).toBeCloseTo(phaseAfterShuffle);
      expect(state.clockRunning).toBe(true);
    } finally {
      state.dispose();
      vi.unstubAllGlobals();
    }
  });

  it("keeps the primary action unavailable during a source replacement", async () => {
    const first = makeSequence("first", 8);
    const second = metadataOnly(makeSequence("second", 8));
    const secondRequest = deferred<SequenceData | null>();
    const loader = createLoader(
      [first, second],
      async () => secondRequest.promise
    );
    const state = createState(loader);

    await state.initialize();
    const shuffle = state.shuffle("blue");

    expect(state.pendingSide).toBe("blue");
    expect(state.canFuse).toBe(false);
    expect(state.blue.sequence?.id).toBe(first.id);
    expect(state.statusMessage).toBe("Loading another Blue path...");

    secondRequest.resolve(makeSequence("second", 8));
    await shuffle;
    expect(state.canFuse).toBe(true);
    expect(state.blue.sequence?.id).toBe("second");
    expect(state.statusMessage).toContain("Blue path second is ready");
  });

  it("blocks an incomplete derived result and keeps the selected pair", async () => {
    const source = makeSequence("source", 8);
    const showUserError = vi.fn(() => "derivation-error");
    const state = createState(createLoader([source]), {
      deriveLetters: async (sequence) => ({
        ...sequence,
        steps: sequence.steps.map((step, index) => ({
          ...step,
          letter: index === 0 ? ("A" as StepData["letter"]) : null,
        })),
        word: "A",
      }),
      errorHandler: { showUserError },
    });

    await state.initialize();
    const blueId = state.blue.sequence?.id;
    const redId = state.red.sequence?.id;

    const result = await state.buildFusedSequence();

    expect(result).toBeNull();
    expect(state.error?.kind).toBe("derivation");
    expect(state.blue.sequence?.id).toBe(blueId);
    expect(state.red.sequence?.id).toBe(redId);
    expect(state.isFusing).toBe(false);
    expect(showUserError).toHaveBeenCalledOnce();
  });

  it("locks final-action re-entry while derivation is pending", async () => {
    const source = makeSequence("source", 8);
    const derivation = deferred<SequenceData>();
    const deriveLetters = vi.fn(async () => derivation.promise);
    const state = createState(createLoader([source]), { deriveLetters });

    await state.initialize();
    const firstBuild = state.buildFusedSequence();
    const secondBuild = state.buildFusedSequence();

    expect(state.isFusing).toBe(true);
    expect(await secondBuild).toBeNull();
    expect(deriveLetters).toHaveBeenCalledOnce();

    derivation.resolve(letterEveryStep(state.previewSequence!));
    const result = await firstBuild;

    expect(result).not.toBeNull();
    expect(result?.stepPairings?.every((pair) => pair.letter === "A")).toBe(
      true
    );
    expect(state.isFusing).toBe(false);
  });

  it("invalidates pending work when disposed", async () => {
    const source = makeSequence("source", 8);
    const request = deferred<SequenceData | null>();
    const loader = createLoader(
      [metadataOnly(source)],
      async () => request.promise
    );
    const state = createState(loader);

    const loading = state.initialize();
    await vi.waitFor(() =>
      expect(loader.loadFullSequenceData).toHaveBeenCalled()
    );
    state.dispose();
    request.resolve(source);
    await loading;

    expect(state.blue.sequence).toBeNull();
    expect(state.red.sequence).toBeNull();
    expect(state.previewSequence).toBeNull();
  });

  it("starts paused for reduced motion and only autoplays without it", async () => {
    const requestFrame = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const source = makeSequence("source", 8);

    try {
      const reducedState = createState(createLoader([source]), {
        prefersReducedMotion: () => true,
      });
      await reducedState.initialize();

      expect(reducedState.clockRunning).toBe(false);
      expect(requestFrame).not.toHaveBeenCalled();
      reducedState.dispose();

      const animatedState = createState(createLoader([source]), {
        prefersReducedMotion: () => false,
      });
      await animatedState.initialize();

      expect(animatedState.clockRunning).toBe(true);
      expect(requestFrame).toHaveBeenCalledOnce();
      animatedState.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("validates and clamps persisted tempo before using it", () => {
    try {
      localStorage.setItem("fuse-tab-state", JSON.stringify({ bpm: "fast" }));
      const malformedState = createState(createLoader([]));
      expect(malformedState.bpm).toBe(60);
      malformedState.dispose();

      localStorage.setItem("fuse-tab-state", JSON.stringify({ bpm: 999 }));
      const clampedState = createState(createLoader([]));
      expect(clampedState.bpm).toBe(PLAYBACK_MAX_BPM);
      clampedState.dispose();
    } finally {
      localStorage.removeItem("fuse-tab-state");
    }
  });
});
