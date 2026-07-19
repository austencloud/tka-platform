/**
 * Fuse state factory.
 *
 * Owns the two discovery decks as one pair. Loads are prepared off-screen and
 * committed with their combined preview, so a late request can never leave the
 * page showing a Blue path, Red path, and preview from different moments.
 */

import {
  PLAYBACK_MAX_BPM,
  PLAYBACK_MIN_BPM,
} from "$lib/shared/animation-engine/domain/constants/timing";
import type { ErrorHandler } from "$lib/shared/application/services/error-handler";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { getSequenceDisplayName } from "$lib/shared/foundation/services/word-deriver";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { fusedDisplayName, fuseSequences } from "../services/sequence-fuser";
import {
  createFuseShufflePool,
  type FuseBrowseLoader,
  type FuseShufflePool,
  type FuseSide,
} from "./fuse-shuffle-pool.svelte";

const STORAGE_KEY = "fuse-tab-state";
const DEFAULT_BPM = 60;

export const FUSE_LENGTHS = [2, 4, 8, 12, 16, 24, 32] as const;
export type FuseLength = (typeof FUSE_LENGTHS)[number];

export type FuseErrorKind =
  | "catalog"
  | "empty"
  | "candidate"
  | "preview"
  | "derivation"
  | "viewer";

export interface FuseErrorState {
  kind: FuseErrorKind;
  message: string;
  side?: FuseSide;
}

export interface FuseStateDeps {
  browseLoader: FuseBrowseLoader;
  deriveLetters: (sequence: SequenceData) => Promise<SequenceData>;
  errorHandler: Pick<ErrorHandler, "showUserError">;
  initialLength?: FuseLength;
  random?: () => number;
  prefersReducedMotion?: () => boolean;
}

interface PersistedFuseState {
  bpm?: number;
}

function readPersistedState(): PersistedFuseState {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const bpm = (parsed as { bpm?: unknown }).bpm;
    return typeof bpm === "number" ? { bpm } : {};
  } catch {
    return {};
  }
}

function writePersistedState(data: PersistedFuseState): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // A private or full browser store should not stop the current session.
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function normalizeBpm(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_BPM;
  return Math.max(PLAYBACK_MIN_BPM, Math.min(PLAYBACK_MAX_BPM, value));
}

function createHydrationCache(
  browseLoader: FuseBrowseLoader
): FuseBrowseLoader {
  const hydratedSequences = new Map<string, Promise<SequenceData | null>>();

  return {
    loadSequenceMetadata: () => browseLoader.loadSequenceMetadata(),
    loadFullSequenceData: (sequenceName, sequenceId) => {
      const key = sequenceId ? `id:${sequenceId}` : `name:${sequenceName}`;
      const existing = hydratedSequences.get(key);
      if (existing) return existing;

      const request = browseLoader
        .loadFullSequenceData(sequenceName, sequenceId)
        .then((sequence) => {
          // The loader reports both a missing document and a transient read
          // failure as null. Keep the in-flight deduplication, but let a later
          // length change retry either case.
          if (!sequence) hydratedSequences.delete(key);
          return sequence;
        })
        .catch((loadError) => {
          hydratedSequences.delete(key);
          throw loadError;
        });
      hydratedSequences.set(key, request);
      return request;
    },
  };
}

function sourceReadyMessage(
  side: FuseSide,
  sequence: SequenceData,
  restored: boolean
): string {
  const label = side === "blue" ? "Blue" : "Red";
  const name = simplifyRepeatedWord(getSequenceDisplayName(sequence)).trim();
  if (!name) {
    return restored ? `${label} path restored.` : `${label} path is ready.`;
  }
  return restored
    ? `${label} path ${name} restored.`
    : `${label} path ${name} is ready.`;
}

export function createFuseState({
  browseLoader,
  deriveLetters,
  errorHandler,
  initialLength = 8,
  random = Math.random,
  prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
}: FuseStateDeps) {
  const persisted = readPersistedState();
  const cachedBrowseLoader = createHydrationCache(browseLoader);
  const bluePool = createFuseShufflePool({
    browseLoader: cachedBrowseLoader,
    side: "blue",
    random,
  });
  const redPool = createFuseShufflePool({
    browseLoader: cachedBrowseLoader,
    side: "red",
    random,
  });

  let requestedLength = $state<FuseLength>(initialLength);
  let appliedLength = $state<FuseLength | null>(null);
  let bpm = $state(normalizeBpm(persisted.bpm));
  let previewSequence = $state<SequenceData | null>(null);
  let isLoadingLength = $state(false);
  let pendingSide = $state<FuseSide | null>(null);
  let isFusing = $state(false);
  let error = $state<FuseErrorState | null>(null);
  let readyMessage = $state("Both paths are ready.");

  let catalog: SequenceData[] | null = null;
  let catalogPromise: Promise<SequenceData[]> | null = null;
  let initialLoadPromise: Promise<void> | null = null;
  let lengthGeneration = 0;
  let buildGeneration = 0;
  let blueGeneration = 0;
  let redGeneration = 0;
  let disposed = false;
  let hasLoadedPair = false;

  let currentStep = $state(0);
  let clockRunning = $state(false);
  let clockFrame: number | null = null;
  let lastClockTimestamp: number | null = null;

  function poolFor(side: FuseSide): FuseShufflePool {
    return side === "blue" ? bluePool : redPool;
  }

  function otherPool(side: FuseSide): FuseShufflePool {
    return side === "blue" ? redPool : bluePool;
  }

  function sideGeneration(side: FuseSide): number {
    return side === "blue" ? blueGeneration : redGeneration;
  }

  function incrementSideGeneration(side: FuseSide): number {
    if (side === "blue") return ++blueGeneration;
    return ++redGeneration;
  }

  async function getCatalog(): Promise<SequenceData[]> {
    if (catalog) return catalog;
    if (catalogPromise) return catalogPromise;

    catalogPromise = browseLoader.loadSequenceMetadata();
    try {
      catalog = await catalogPromise;
      return catalog;
    } finally {
      catalogPromise = null;
    }
  }

  function createPreview(
    blue: SequenceData,
    red: SequenceData,
    length: FuseLength
  ): SequenceData {
    if (!blue.blueSoloProp || !red.redSoloProp) {
      throw new Error(
        "The selected sources are missing compositional path data"
      );
    }

    const preview = fuseSequences(blue.blueSoloProp, red.redSoloProp, {
      maxSteps: length,
    });
    if (preview.steps.length !== length) {
      throw new Error(
        `Combined preview has ${preview.steps.length} steps instead of ${length}`
      );
    }
    return preview;
  }

  function reportUnexpected(
    message: string,
    technicalError: unknown,
    action: string
  ): void {
    const cause = asError(technicalError);
    errorHandler.showUserError({
      message,
      technicalDetails: cause.message,
      error: cause,
      severity: "warning",
      context: { module: "create", tab: "fuse", action },
    });
  }

  function isCurrentLengthGeneration(generation: number): boolean {
    return !disposed && generation === lengthGeneration;
  }

  function isCurrentSideGeneration(
    side: FuseSide,
    generation: number
  ): boolean {
    return !disposed && generation === sideGeneration(side);
  }

  function canFuseNow(): boolean {
    const blueSequence = bluePool.sequence;
    const redSequence = redPool.sequence;
    const preview = previewSequence;

    return (
      !!blueSequence?.blueSoloProp &&
      !!redSequence?.redSoloProp &&
      !!preview &&
      appliedLength !== null &&
      blueSequence.steps.length === appliedLength &&
      redSequence.steps.length === appliedLength &&
      preview.steps.length === appliedLength &&
      !isLoadingLength &&
      pendingSide === null &&
      !isFusing &&
      (error === null || error.kind === "viewer")
    );
  }

  function statusMessage(): string {
    if (isFusing) return "Building the fused sequence...";
    if (isLoadingLength) return `Loading ${requestedLength}-step paths...`;
    if (pendingSide) {
      const label = pendingSide === "blue" ? "Blue" : "Red";
      return `Loading another ${label} path...`;
    }
    if (error) return error.message;
    if (canFuseNow()) return readyMessage;
    return "Choose a length to load two paths.";
  }

  function tickClock(now: number): void {
    if (!clockRunning) return;
    if (lastClockTimestamp !== null) {
      const elapsed = now - lastClockTimestamp;
      currentStep += elapsed * (bpm / 60_000);
    }
    lastClockTimestamp = now;
    clockFrame = requestAnimationFrame(tickClock);
  }

  function startClock(): void {
    if (
      clockRunning ||
      !previewSequence ||
      typeof requestAnimationFrame === "undefined"
    ) {
      return;
    }
    clockRunning = true;
    lastClockTimestamp = null;
    clockFrame = requestAnimationFrame(tickClock);
  }

  function stopClock(): void {
    clockRunning = false;
    if (clockFrame !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(clockFrame);
    }
    clockFrame = null;
    lastClockTimestamp = null;
  }

  function toggleClock(): void {
    if (clockRunning) stopClock();
    else startClock();
  }

  async function setLength(length: FuseLength): Promise<void> {
    const generation = ++lengthGeneration;
    blueGeneration += 1;
    redGeneration += 1;
    buildGeneration += 1;
    requestedLength = length;
    appliedLength = null;
    isLoadingLength = true;
    pendingSide = null;
    isFusing = false;
    error = null;
    readyMessage = "Both paths are ready.";
    previewSequence = null;
    bluePool.reset([], length);
    redPool.reset([], length);
    currentStep = 0;

    const resumeAfterLoad =
      clockRunning || (!hasLoadedPair && !prefersReducedMotion());
    stopClock();

    try {
      const sequences = await getCatalog();
      if (!isCurrentLengthGeneration(generation)) return;

      bluePool.reset(sequences, length);
      redPool.reset(sequences, length);
      if (bluePool.poolSize === 0 || redPool.poolSize === 0) {
        error = {
          kind: "empty",
          message: `No ${length}-step paths are available. Choose another length.`,
        };
        return;
      }

      const [blueCandidate, redCandidate] = await Promise.all([
        bluePool.stageNext(),
        redPool.stageNext(),
      ]);
      if (!isCurrentLengthGeneration(generation)) return;

      if (!blueCandidate || !redCandidate) {
        error = {
          kind: "empty",
          message: `No ${length}-step paths are available. Choose another length.`,
        };
        return;
      }

      const preview = createPreview(
        blueCandidate.sequence,
        redCandidate.sequence,
        length
      );
      if (!isCurrentLengthGeneration(generation)) return;

      bluePool.commit(blueCandidate, true);
      redPool.commit(redCandidate, true);
      previewSequence = preview;
      appliedLength = length;
      hasLoadedPair = true;
      if (resumeAfterLoad) startClock();
    } catch (loadError) {
      if (!isCurrentLengthGeneration(generation)) return;
      error = { kind: "catalog", message: "Couldn't load paths. Try again." };
      reportUnexpected(error.message, loadError, "load-paths");
    } finally {
      if (isCurrentLengthGeneration(generation)) isLoadingLength = false;
    }
  }

  function initialize(): Promise<void> {
    return (initialLoadPromise ??= setLength(requestedLength));
  }

  async function shuffle(side: FuseSide): Promise<void> {
    if (
      disposed ||
      isLoadingLength ||
      pendingSide !== null ||
      isFusing ||
      appliedLength === null
    ) {
      return;
    }

    const generation = incrementSideGeneration(side);
    const pool = poolFor(side);
    const counterpart = otherPool(side);
    pendingSide = side;
    error = null;

    try {
      const candidate = await pool.stageNext();
      if (!isCurrentSideGeneration(side, generation)) return;

      if (!candidate || !counterpart.sequence) {
        const label = side === "blue" ? "Blue" : "Red";
        error = {
          kind: "candidate",
          side,
          message: `Couldn't load another ${label} path. Try again.`,
        };
        return;
      }

      const blue = side === "blue" ? candidate.sequence : counterpart.sequence;
      const red = side === "red" ? candidate.sequence : counterpart.sequence;
      const preview = createPreview(blue, red, appliedLength);
      if (!isCurrentSideGeneration(side, generation)) return;

      pool.commit(candidate, false);
      previewSequence = preview;
      currentStep = 0;
      readyMessage = sourceReadyMessage(side, candidate.sequence, false);
    } catch (shuffleError) {
      if (!isCurrentSideGeneration(side, generation)) return;
      const label = side === "blue" ? "Blue" : "Red";
      error = {
        kind: "candidate",
        side,
        message: `Couldn't load another ${label} path. Try again.`,
      };
      reportUnexpected(error.message, shuffleError, `shuffle-${side}`);
    } finally {
      if (isCurrentSideGeneration(side, generation) && pendingSide === side) {
        pendingSide = null;
      }
    }
  }

  function previous(side: FuseSide): void {
    if (
      disposed ||
      isLoadingLength ||
      pendingSide !== null ||
      isFusing ||
      appliedLength === null
    ) {
      return;
    }

    const pool = poolFor(side);
    const counterpart = otherPool(side);
    const previousEntry = pool.peekPrevious();
    if (!previousEntry || !counterpart.sequence) return;

    try {
      const blue =
        side === "blue" ? previousEntry.sequence : counterpart.sequence;
      const red =
        side === "red" ? previousEntry.sequence : counterpart.sequence;
      const preview = createPreview(blue, red, appliedLength);
      pool.commitPrevious();
      previewSequence = preview;
      currentStep = 0;
      error = null;
      readyMessage = sourceReadyMessage(side, previousEntry.sequence, true);
    } catch (previewError) {
      error = {
        kind: "preview",
        message:
          "Couldn't build the combined preview. Shuffle a path and try again.",
      };
      reportUnexpected(error.message, previewError, `previous-${side}`);
    }
  }

  async function retry(): Promise<void> {
    if (!error || isLoadingLength || pendingSide || isFusing) return;
    if (error.side) {
      await shuffle(error.side);
      return;
    }
    await setLength(requestedLength);
  }

  async function buildFusedSequence(): Promise<SequenceData | null> {
    if (!canFuseNow()) return null;

    const snapshot = previewSequence;
    if (!snapshot) return null;
    const generation = ++buildGeneration;
    isFusing = true;
    error = null;
    stopClock();

    try {
      const derived = await deriveLetters(snapshot);
      if (disposed || generation !== buildGeneration) return null;

      const missingLetters = derived.steps.filter(
        (step) => !step.letter
      ).length;
      if (missingLetters > 0) {
        const message =
          "Couldn't identify every fused step. Shuffle a path and try again.";
        error = { kind: "derivation", message };
        reportUnexpected(
          message,
          new Error(
            `${missingLetters}/${derived.steps.length} fused steps have no letter`
          ),
          "derive-fused-word"
        );
        return null;
      }

      const word = derived.steps
        .map((step) => step.letter)
        .join("")
        .toUpperCase();
      const name = fusedDisplayName(word);
      const stepPairings = derived.stepPairings?.map((pair, index) => ({
        ...pair,
        letter: derived.steps[index]?.letter ?? null,
      }));

      return {
        ...derived,
        word,
        name,
        displayName: name,
        ...(stepPairings && { stepPairings }),
      };
    } catch (deriveError) {
      if (disposed || generation !== buildGeneration) return null;
      const message =
        "Couldn't identify every fused step. Shuffle a path and try again.";
      error = { kind: "derivation", message };
      reportUnexpected(message, deriveError, "derive-fused-word");
      return null;
    } finally {
      if (!disposed && generation === buildGeneration) isFusing = false;
    }
  }

  function reportPreviewFailure(technicalError: unknown): void {
    if (!previewSequence || error?.kind === "preview") return;
    const message =
      "Couldn't build the combined preview. Shuffle a path and try again.";
    error = { kind: "preview", message };
    stopClock();
    reportUnexpected(message, technicalError, "initialize-preview");
  }

  function reportViewerFailure(technicalError: unknown): void {
    const message = "Couldn't open the fused sequence. Try again.";
    error = { kind: "viewer", message };
    reportUnexpected(message, technicalError, "open-viewer");
  }

  function setBpm(value: number): void {
    if (!Number.isFinite(value)) return;
    bpm = Math.max(PLAYBACK_MIN_BPM, Math.min(PLAYBACK_MAX_BPM, value));
    writePersistedState({ bpm });
  }

  function handleDocumentVisibility(hidden: boolean): void {
    if (hidden) stopClock();
  }

  function dispose(): void {
    disposed = true;
    lengthGeneration += 1;
    blueGeneration += 1;
    redGeneration += 1;
    buildGeneration += 1;
    stopClock();
  }

  function sourceState(side: FuseSide, pool: FuseShufflePool) {
    return {
      get sequence() {
        return pool.sequence;
      },
      get poolSize() {
        return pool.poolSize;
      },
      get poolPosition() {
        return pool.poolPosition;
      },
      get canGoBack() {
        return pool.canGoBack;
      },
      get isLoading() {
        return isLoadingLength || pendingSide === side;
      },
      get revision() {
        return pool.revision;
      },
    };
  }

  const blue = sourceState("blue", bluePool);
  const red = sourceState("red", redPool);

  return {
    get requestedLength() {
      return requestedLength;
    },
    get appliedLength() {
      return appliedLength;
    },
    get bpm() {
      return bpm;
    },
    get currentStep() {
      return currentStep;
    },
    get clockRunning() {
      return clockRunning;
    },
    get previewSequence() {
      return previewSequence;
    },
    get isLoadingLength() {
      return isLoadingLength;
    },
    get pendingSide() {
      return pendingSide;
    },
    get isFusing() {
      return isFusing;
    },
    get error() {
      return error;
    },
    get statusMessage() {
      return statusMessage();
    },
    get canFuse() {
      return canFuseNow();
    },
    get canRetry() {
      return (
        !!error &&
        error.kind !== "empty" &&
        error.kind !== "derivation" &&
        error.kind !== "viewer"
      );
    },
    blue,
    red,
    initialize,
    setLength,
    shuffle,
    previous,
    retry,
    buildFusedSequence,
    reportPreviewFailure,
    reportViewerFailure,
    setBpm,
    startClock,
    stopClock,
    toggleClock,
    handleDocumentVisibility,
    dispose,
  };
}

export type FuseState = ReturnType<typeof createFuseState>;
