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
import {
  createSequenceData,
  updateSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/solo-prop-data";
import type { SoloPropStepData } from "$lib/shared/foundation/domain/models/solo-prop-step-data";
import {
  extractBlueSoloProp,
  extractRedSoloProp,
} from "$lib/shared/foundation/services/sequence-decomposer";
import { createSoloProp } from "$lib/shared/foundation/services/solo-prop-factory";
import { getSequenceDisplayName } from "$lib/shared/foundation/services/word-deriver";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionColor,
  type Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { swapMotionColor } from "$lib/shared/create/services/motion-transforms";
import {
  flipSequence,
  invertSequence,
  mirrorSequence,
  rewindSequence,
  rotateSequence,
} from "$lib/shared/create/services/sequence-transformer";
import { fusedDisplayName, fuseSequences } from "../services/sequence-fuser";
import {
  createFuseShufflePool,
  type FuseBrowseLoader,
  type FuseShufflePool,
  type FuseSide,
} from "./fuse-shuffle-pool.svelte";

const STORAGE_KEY = "fuse-tab-state";
const DEFAULT_BPM = 60;
// Persist the live playback step at most this often while the clock runs, so a
// remount can resume near where playback was without writing on every frame.
const STEP_PERSIST_INTERVAL_MS = 1000;

export const FUSE_LENGTHS = [2, 4, 8, 12, 16, 24, 32] as const;
export type FuseLength = (typeof FUSE_LENGTHS)[number];

/** Top-of-tab Fuse mode. `shuffle` = two independent paths (the original
 * behavior); `symmetry` = one driver path with the follower derived from it via
 * a transform. Persisted per-device. */
export type FuseMode = "shuffle" | "symmetry";

/** The transforms the symmetry follower can derive through: the six LOOP-family
 * singles plus three curated pairs. One is always active (default `mirror`). */
export type FuseTransformId =
  | "mirror"
  | "flip"
  | "rotate90"
  | "rotate180"
  | "invert"
  | "rewind"
  | "rotate-mirror"
  | "mirror-invert"
  | "rotate-invert";

export interface FuseTransformOption {
  id: FuseTransformId;
  label: string;
}

/** Display catalog for the transform picker — a single source of truth shared by
 * the picker UI and this state's apply logic (keyed by the same id union). */
export const FUSE_TRANSFORMS: readonly FuseTransformOption[] = [
  { id: "mirror", label: "Mirror" },
  { id: "flip", label: "Flip" },
  { id: "rotate90", label: "Rotate 90" },
  { id: "rotate180", label: "Rotate 180" },
  { id: "invert", label: "Invert" },
  { id: "rewind", label: "Rewind" },
  { id: "rotate-mirror", label: "Rotate + Mirror" },
  { id: "mirror-invert", label: "Mirror + Invert" },
  { id: "rotate-invert", label: "Rotate + Invert" },
];

function isFuseTransformId(value: unknown): value is FuseTransformId {
  return (
    typeof value === "string" &&
    FUSE_TRANSFORMS.some((option) => option.id === value)
  );
}

function fuseTransformLabel(id: FuseTransformId): string {
  return FUSE_TRANSFORMS.find((option) => option.id === id)?.label ?? "Mirror";
}

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

/** Kind of a non-shuffle source injected via {@link setSource}. */
export type FuseSourceKind = "library" | "vtg" | "custom";

/** Where an injected (non-shuffle) source came from. Persisted per-side so a
 * restored injected source can be labeled and, for future producers, re-derived.
 * `id`/`word`/`name` identify a library pick; `label` names a VTG/custom path. */
export interface SourceOrigin {
  kind: FuseSourceKind;
  id?: string;
  word?: string;
  name?: string;
  label?: string;
}

/** The injected side's solo path serialized for a self-contained restore — no
 * library round-trip or producer dependency needed to rebuild it after HMR. */
interface PersistedSolo {
  steps: SoloPropStepData[];
  startLocation: GridLocation;
  startOrientation: Orientation;
}

/** Identity of one persisted source pick. The three identity fields are kept so
 * restore can hydrate a shuffled pick by id (the disambiguating key) and fall
 * back to word/name. An injected source additionally carries its `origin` and
 * the serialized `solo`, which together restore it without the browse pool. */
interface FusePersistedSelection {
  id: string;
  word: string;
  name: string;
  origin?: SourceOrigin;
  solo?: PersistedSolo;
}

interface PersistedFuseState {
  bpm?: number;
  length?: number;
  blue?: FusePersistedSelection;
  red?: FusePersistedSelection;
  currentStep?: number;
  mode?: FuseMode;
  driverSide?: FuseSide;
  transformId?: FuseTransformId;
}

/** What initialize() hands setLength so a persisted pair is restored only on the
 * mount-time load, never on a deliberate length change. */
interface FuseRestoreRequest {
  blue?: FusePersistedSelection;
  red?: FusePersistedSelection;
  length?: number;
  currentStep?: number;
}

function parseSourceOrigin(value: unknown): SourceOrigin | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (kind !== "library" && kind !== "vtg" && kind !== "custom") {
    return undefined;
  }
  const origin: SourceOrigin = { kind };
  if (typeof record.id === "string") origin.id = record.id;
  if (typeof record.word === "string") origin.word = record.word;
  if (typeof record.name === "string") origin.name = record.name;
  if (typeof record.label === "string") origin.label = record.label;
  return origin;
}

function parsePersistedSolo(value: unknown): PersistedSolo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const { steps, startLocation, startOrientation } = record;
  // Enum values are strings; the steps array is stored verbatim (all its fields
  // are enum/number/null, so the round-trip is lossless).
  if (
    !Array.isArray(steps) ||
    steps.length === 0 ||
    typeof startLocation !== "string" ||
    typeof startOrientation !== "string"
  ) {
    return undefined;
  }
  return {
    steps: steps as SoloPropStepData[],
    startLocation: startLocation as GridLocation,
    startOrientation: startOrientation as Orientation,
  };
}

function parsePersistedSelection(
  value: unknown
): FusePersistedSelection | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const word = typeof record.word === "string" ? record.word : "";
  const name = typeof record.name === "string" ? record.name : "";
  const origin = parseSourceOrigin(record.origin);
  const solo = parsePersistedSolo(record.solo);
  // Need at least one identifier to hydrate the sequence later — unless an
  // injected solo makes the selection self-contained.
  if (!id && !word && !name && !solo) return undefined;
  const selection: FusePersistedSelection = { id, word, name };
  if (origin) selection.origin = origin;
  if (solo) selection.solo = solo;
  return selection;
}

function readPersistedState(): PersistedFuseState {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Record<string, unknown>;

    // Every field is optional, so an older store holding only { bpm } still
    // parses cleanly into this widened shape.
    const result: PersistedFuseState = {};
    if (typeof record.bpm === "number") result.bpm = record.bpm;
    if (typeof record.length === "number") result.length = record.length;
    if (typeof record.currentStep === "number") {
      result.currentStep = record.currentStep;
    }
    if (record.mode === "shuffle" || record.mode === "symmetry") {
      result.mode = record.mode;
    }
    if (record.driverSide === "blue" || record.driverSide === "red") {
      result.driverSide = record.driverSide;
    }
    if (isFuseTransformId(record.transformId)) {
      result.transformId = record.transformId;
    }
    const blue = parsePersistedSelection(record.blue);
    if (blue) result.blue = blue;
    const red = parsePersistedSelection(record.red);
    if (red) result.red = red;
    return result;
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
  let persisted = readPersistedState();
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

  // A side that was fed a non-shuffle source (library / VTG / custom) holds its
  // origin plus the live solo here, so persistSelection can write the source
  // back and a following shuffle knows to drop it. Null = the side is on the
  // random pool. Not reactive: only persistence and shuffle read it.
  let blueOrigin: { origin: SourceOrigin; solo: SoloPropData } | null = null;
  let redOrigin: { origin: SourceOrigin; solo: SoloPropData } | null = null;

  function injectedOriginFor(side: FuseSide) {
    return side === "blue" ? blueOrigin : redOrigin;
  }

  function setInjectedOrigin(
    side: FuseSide,
    origin: SourceOrigin,
    solo: SoloPropData
  ): void {
    if (side === "blue") blueOrigin = { origin, solo };
    else redOrigin = { origin, solo };
  }

  function clearInjectedOrigin(side: FuseSide): void {
    if (side === "blue") blueOrigin = null;
    else redOrigin = null;
  }

  // Symmetry mode: one driver side keeps a source, the follower is derived from
  // it via a transform. `symmetryPreview` is the fused derived result rendered by
  // the follower card and animated (it is also assigned to previewSequence while
  // symmetry is active). The pools underneath stay untouched, so exiting symmetry
  // just rebuilds the independent preview from them.
  let mode = $state<FuseMode>(persisted.mode ?? "shuffle");
  let driverSide = $state<FuseSide>(persisted.driverSide ?? "blue");
  let transformId = $state<FuseTransformId>(persisted.transformId ?? "mirror");
  let symmetryPreview = $state<SequenceData | null>(null);
  let symmetryGeneration = 0;

  let currentStep = $state(0);
  let clockRunning = $state(false);
  let clockFrame: number | null = null;
  let lastClockTimestamp: number | null = null;
  let lastStepPersistAt: number | null = null;

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

  /**
   * The pool sequence committed for an injected side must have exactly `length`
   * steps (canFuseNow checks it) and carry the length-tiled solo (so a later
   * counterpart shuffle re-derives from the full-length path, not the shorter
   * source). Take both from the freshly-built preview, keeping the source's
   * identity fields (id/word/name) for display and persistence.
   */
  function lengthMatchedInjectedSide(
    side: FuseSide,
    injected: SequenceData,
    preview: SequenceData,
    length: FuseLength
  ): SequenceData {
    return {
      ...injected,
      steps: preview.steps,
      sequenceLength: length,
      ...(side === "blue"
        ? { blueSoloProp: preview.blueSoloProp }
        : { redSoloProp: preview.redSoloProp }),
    };
  }

  /** Prepare one side's restored pool sequence. An injected selection re-arms
   * its origin (so persistence and a later shuffle behave) and commits the
   * length-matched solo; a shuffled selection clears any origin and commits its
   * hydrated library sequence unchanged. */
  function commitRestoredSide(
    side: FuseSide,
    selection: FusePersistedSelection,
    rebuilt: SequenceData,
    preview: SequenceData,
    length: FuseLength
  ): SequenceData {
    if (selection.origin && selection.solo) {
      const solo =
        side === "blue" ? rebuilt.blueSoloProp : rebuilt.redSoloProp;
      if (solo) setInjectedOrigin(side, selection.origin, solo);
      return lengthMatchedInjectedSide(side, rebuilt, preview, length);
    }
    clearInjectedOrigin(side);
    return rebuilt;
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

  function serializeSolo(solo: SoloPropData): PersistedSolo {
    return {
      steps: solo.steps.map((step) => ({ ...step })),
      startLocation: solo.startLocation,
      startOrientation: solo.startOrientation,
    };
  }

  function persistedSelectionFor(
    side: FuseSide,
    sequence: SequenceData
  ): FusePersistedSelection {
    const selection: FusePersistedSelection = {
      id: sequence.id,
      word: sequence.word,
      name: sequence.name,
    };
    const injected = injectedOriginFor(side);
    if (injected) {
      selection.origin = injected.origin;
      selection.solo = serializeSolo(injected.solo);
    }
    return selection;
  }

  function persistSelection(
    blueSequence: SequenceData,
    redSequence: SequenceData,
    length: FuseLength
  ): void {
    // Merge into the current store so writing the pair never drops bpm or the
    // persisted step. Each side carries its injected origin when it has one.
    persisted = {
      ...persisted,
      length,
      blue: persistedSelectionFor("blue", blueSequence),
      red: persistedSelectionFor("red", redSequence),
    };
    writePersistedState(persisted);
  }

  function persistStep(): void {
    // Merge so the step write never drops the persisted pair, length, or bpm.
    persisted = { ...persisted, currentStep };
    writePersistedState(persisted);
  }

  function persistModeState(): void {
    // Merge so the mode write never drops the persisted pair, length, or step.
    persisted = { ...persisted, mode, driverSide, transformId };
    writePersistedState(persisted);
  }

  /** Rebuild an injected side from its persisted solo alone — self-contained,
   * so a picked/built path survives HMR without the browse pool or a producer.
   * The returned sequence carries only the side's soloProp; the restore path
   * length-matches it against the freshly-built preview before committing. */
  function rebuildInjectedSide(
    side: FuseSide,
    persistedSolo: PersistedSolo
  ): SequenceData | null {
    try {
      const solo = createSoloProp(
        persistedSolo.steps,
        persistedSolo.startLocation,
        persistedSolo.startOrientation
      );
      return createSequenceData(
        side === "blue" ? { blueSoloProp: solo } : { redSoloProp: solo }
      );
    } catch {
      return null;
    }
  }

  async function hydrateRestoredSide(
    side: FuseSide,
    selection: FusePersistedSelection,
    length: FuseLength
  ): Promise<SequenceData | null> {
    // An injected source (library / VTG / custom) restores from its serialized
    // solo, self-contained — no browse hydrate needed.
    if (selection.origin && selection.solo) {
      return rebuildInjectedSide(side, selection.solo);
    }

    let hydrated: SequenceData | null;
    try {
      hydrated = await cachedBrowseLoader.loadFullSequenceData(
        selection.word || selection.name,
        selection.id || undefined
      );
    } catch {
      // Restore is best-effort; a failed hydrate falls back to a random pick.
      return null;
    }
    if (!hydrated) return null;

    const matchesLength =
      hydrated.steps.length === length || hydrated.sequenceLength === length;
    const hasSideData =
      side === "blue" ? !!hydrated.blueSoloProp : !!hydrated.redSoloProp;
    return matchesLength && hasSideData ? hydrated : null;
  }

  async function hydrateRestoredPair(
    blueSelection: FusePersistedSelection,
    redSelection: FusePersistedSelection,
    length: FuseLength
  ): Promise<{ blue: SequenceData; red: SequenceData } | null> {
    const [blue, red] = await Promise.all([
      hydrateRestoredSide("blue", blueSelection, length),
      hydrateRestoredSide("red", redSelection, length),
    ]);
    return blue && red ? { blue, red } : null;
  }

  function tickClock(now: number): void {
    if (!clockRunning) return;
    if (lastClockTimestamp !== null) {
      const elapsed = now - lastClockTimestamp;
      currentStep += elapsed * (bpm / 60_000);
    }
    lastClockTimestamp = now;
    if (
      lastStepPersistAt === null ||
      now - lastStepPersistAt >= STEP_PERSIST_INTERVAL_MS
    ) {
      lastStepPersistAt = now;
      persistStep();
    }
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
    // Don't persist here: setLength resets currentStep to 0 and then calls
    // stopClock, so persisting in this path would clobber the stored step
    // before restore can read it. Callers that mean "pause" persist explicitly.
    lastStepPersistAt = null;
  }

  function toggleClock(): void {
    if (clockRunning) {
      stopClock();
      // Capture where playback paused so a remount resumes near it.
      persistStep();
    } else startClock();
  }

  async function setLength(
    length: FuseLength,
    restore?: FuseRestoreRequest
  ): Promise<void> {
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
    // A length change reloads from the random pool; drop any injected origins.
    // The restore path below re-sets them for a side it rehydrates as injected.
    blueOrigin = null;
    redOrigin = null;
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

      // Mount-time restore: when the requested length matches the persisted one
      // and a persisted pair exists, hydrate those exact two sources instead of
      // landing on a fresh random pick. A deliberate length change passes no
      // restore request and always loads fresh. Any miss (hydrate returns null,
      // wrong length, missing side data, or the preview can't be built) falls
      // through to the random path below.
      if (restore && restore.length === length && restore.blue && restore.red) {
        const restoredPair = await hydrateRestoredPair(
          restore.blue,
          restore.red,
          length
        );
        if (!isCurrentLengthGeneration(generation)) return;

        if (restoredPair) {
          try {
            const preview = createPreview(
              restoredPair.blue,
              restoredPair.red,
              length
            );
            if (!isCurrentLengthGeneration(generation)) return;

            // Re-establish per-side injected origins and length-match an
            // injected side (its rebuilt sequence carries only the solo, so
            // canFuseNow needs the tiled preview steps). A shuffled side commits
            // its full library sequence unchanged.
            const blueRestored = commitRestoredSide(
              "blue",
              restore.blue,
              restoredPair.blue,
              preview,
              length
            );
            const redRestored = commitRestoredSide(
              "red",
              restore.red,
              restoredPair.red,
              preview,
              length
            );

            bluePool.commitRestored(blueRestored);
            redPool.commitRestored(redRestored);
            previewSequence = preview;
            appliedLength = length;
            hasLoadedPair = true;
            persistSelection(blueRestored, redRestored, length);
            // The Fuse clock is a local rAF accumulator (see tickClock); its
            // step value is just this `currentStep` state, so assigning it here
            // IS the seek — FuseAnimationPreview's reactive effect re-derives the
            // visible beat from currentStep. No separate clock/seek API exists.
            if (
              typeof restore.currentStep === "number" &&
              Number.isFinite(restore.currentStep)
            ) {
              currentStep = restore.currentStep;
            }
            // Warm the next Shuffle for both sides so the first tap is instant.
            bluePool.prefetchNext();
            redPool.prefetchNext();
            // A persisted symmetry session derives the follower over the restored
            // independent pair once both pools are committed.
            if (mode === "symmetry") void deriveFollower();
            if (resumeAfterLoad) startClock();
            return;
          } catch {
            if (!isCurrentLengthGeneration(generation)) return;
            // Restore is best-effort: if the persisted sources can no longer
            // form a valid preview, fall through to a fresh random pair.
          }
        }
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
      persistSelection(blueCandidate.sequence, redCandidate.sequence, length);
      // Warm the next Shuffle for both sides so the first tap is instant.
      bluePool.prefetchNext();
      redPool.prefetchNext();
      if (mode === "symmetry") void deriveFollower();
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
    // Only the mount-time load restores a persisted pair. Snapshot the persisted
    // fields by value now (setLength resets currentStep before it reads them, so
    // passing them as an argument protects them from that reset).
    return (initialLoadPromise ??= setLength(requestedLength, {
      blue: persisted.blue,
      red: persisted.red,
      length: persisted.length,
      currentStep: persisted.currentStep,
    }));
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
      // A shuffle replaces any injected source on this side; return it to the
      // random pool before persisting so the injected origin isn't written back.
      clearInjectedOrigin(side);
      previewSequence = preview;
      persistSelection(blue, red, appliedLength);
      // Warm the following candidate so the next Shuffle stays instant.
      pool.prefetchNext();
      // Shuffling changes one path at the beat already on screen. Resetting the
      // shared beat here made both props jump back to the start of the loop.
      readyMessage = sourceReadyMessage(side, candidate.sequence, false);
      // In symmetry, a new driver source re-derives the follower over the top of
      // the independent preview shuffle just published.
      if (mode === "symmetry" && side === driverSide) void deriveFollower();
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

  /**
   * Inject a non-shuffle source into one side: a library pick, a VTG path, or a
   * custom-built solo. The side's solo is extracted (a two-hand source is
   * decomposed; a single-hand source already carries the field), fused against
   * the counterpart's current path via createPreview (which tiles to the applied
   * length), committed through the pool's restore seam, and persisted with its
   * origin so it survives an HMR restore. A later shuffle(side) drops it and
   * returns the side to the random pool.
   */
  async function setSource(
    side: FuseSide,
    source: SequenceData,
    origin: SourceOrigin
  ): Promise<void> {
    if (
      disposed ||
      isLoadingLength ||
      pendingSide !== null ||
      isFusing ||
      appliedLength === null
    ) {
      return;
    }

    const length = appliedLength;
    const counterpart = otherPool(side);
    const counterpartSeq = counterpart.sequence;
    if (!counterpartSeq) return;

    const generation = incrementSideGeneration(side);
    const pool = poolFor(side);
    pendingSide = side;
    error = null;

    try {
      // Extract this side's solo. A two-hand source is decomposed; a single-hand
      // source already carries the field.
      const solo =
        side === "blue"
          ? (source.blueSoloProp ?? extractBlueSoloProp(source))
          : (source.redSoloProp ?? extractRedSoloProp(source));

      const injected: SequenceData =
        side === "blue"
          ? { ...source, blueSoloProp: solo }
          : { ...source, redSoloProp: solo };

      const blueSeq = side === "blue" ? injected : counterpartSeq;
      const redSeq = side === "red" ? injected : counterpartSeq;
      const preview = createPreview(blueSeq, redSeq, length);
      if (!isCurrentSideGeneration(side, generation)) return;

      const committed = lengthMatchedInjectedSide(
        side,
        injected,
        preview,
        length
      );
      pool.commitRestored(committed);
      // Record the origin before persisting so the injected solo is written.
      setInjectedOrigin(side, origin, solo);
      previewSequence = preview;
      const blueForPersist = side === "blue" ? committed : counterpartSeq;
      const redForPersist = side === "red" ? committed : counterpartSeq;
      persistSelection(blueForPersist, redForPersist, length);
      readyMessage = sourceReadyMessage(side, committed, false);
      // A newly injected driver source re-derives the symmetry follower.
      if (mode === "symmetry" && side === driverSide) void deriveFollower();
    } catch (sourceError) {
      if (!isCurrentSideGeneration(side, generation)) return;
      const label = side === "blue" ? "Blue" : "Red";
      error = {
        kind: "candidate",
        side,
        message: `Couldn't use that ${label} path. Shuffle a path and try again.`,
      };
      reportUnexpected(error.message, sourceError, `set-source-${side}`);
    } finally {
      if (isCurrentSideGeneration(side, generation) && pendingSide === side) {
        pendingSide = null;
      }
    }
  }

  /** Apply one transform (single or curated pair) to just the driver hand. The
   * pair transforms rotate 90° then compose with the second op, matching the
   * curated symmetry set (Rotate+Mirror, Mirror+Invert, Rotate+Invert). */
  async function applyDriverTransform(
    sequence: SequenceData,
    id: FuseTransformId,
    hand: FuseSide
  ): Promise<SequenceData> {
    switch (id) {
      case "mirror":
        return mirrorSequence(sequence, hand);
      case "flip":
        return flipSequence(sequence, hand);
      case "rotate90":
        return rotateSequence(sequence, 2, hand);
      case "rotate180":
        return rotateSequence(sequence, 4, hand);
      case "invert":
        return invertSequence(sequence, hand);
      case "rewind":
        return rewindSequence(sequence, hand);
      case "rotate-mirror":
        return mirrorSequence(await rotateSequence(sequence, 2, hand), hand);
      case "mirror-invert":
        return invertSequence(await mirrorSequence(sequence, hand), hand);
      case "rotate-invert":
        return invertSequence(await rotateSequence(sequence, 2, hand), hand);
    }
  }

  /**
   * Derive the follower's solo path from the driver's sequence: transform the
   * driver hand in place, recolor those transformed motions to the follower via
   * swapMotionColor, then extract the follower solo from the recolored steps. The
   * resulting solo path is color-agnostic; fuseSequences re-stamps the color when
   * it fuses, but recoloring here keeps the extraction reading the right slot.
   */
  async function deriveFollowerSolo(
    driverSequence: SequenceData,
    driver: FuseSide,
    id: FuseTransformId
  ): Promise<SoloPropData> {
    const follower: FuseSide = driver === "blue" ? "red" : "blue";
    const transformed = await applyDriverTransform(driverSequence, id, driver);

    // Only the driver hand was transformed, so `transformed`'s start position and
    // its other-color (follower-color) motions still hold the original source's
    // untouched follower hand. Recolor the transformed driver motions into the
    // follower slot on every step, and drop the start position so extraction
    // reads the path start from the recolored first step (not the stale source
    // follower hand that would otherwise sit in startPosition.motions[follower]).
    const recolored = updateSequenceData(transformed, {
      steps: transformed.steps.map((step) => {
        const driverMotion = step.motions[driver];
        if (!isVisibleMotion(driverMotion)) return step;
        const followerMotion = swapMotionColor(
          driverMotion,
          follower as MotionColor
        );
        return {
          ...step,
          motions: {
            blue: driver === "blue" ? driverMotion : followerMotion,
            red: driver === "red" ? driverMotion : followerMotion,
          },
        };
      }),
      startPosition: undefined,
      startingPosition: undefined,
    });

    return follower === "blue"
      ? extractBlueSoloProp(recolored)
      : extractRedSoloProp(recolored);
  }

  function symmetryReadyMessage(): string {
    const followerLabel = driverSide === "blue" ? "Red" : "Blue";
    const driverLabel = driverSide === "blue" ? "Blue" : "Red";
    return `${followerLabel} follows ${driverLabel} (${fuseTransformLabel(
      transformId
    )}).`;
  }

  /**
   * Recompute the symmetry follower from the current driver source + transform,
   * fuse it against the driver, and publish the result as both the follower
   * card's rendered sequence and the live preview. A generation guard drops a
   * stale derive if the driver, transform, or mode changed while it awaited.
   */
  async function deriveFollower(): Promise<void> {
    if (disposed || mode !== "symmetry" || appliedLength === null) return;
    const length = appliedLength;
    const driverSequence = poolFor(driverSide).sequence;
    const driverSolo =
      driverSide === "blue"
        ? driverSequence?.blueSoloProp
        : driverSequence?.redSoloProp;
    if (!driverSequence || !driverSolo) return;

    const generation = ++symmetryGeneration;
    try {
      const followerSolo = await deriveFollowerSolo(
        driverSequence,
        driverSide,
        transformId
      );
      if (disposed || generation !== symmetryGeneration || mode !== "symmetry") {
        return;
      }

      const blueSolo = driverSide === "blue" ? driverSolo : followerSolo;
      const redSolo = driverSide === "blue" ? followerSolo : driverSolo;
      const preview = fuseSequences(blueSolo, redSolo, { maxSteps: length });
      if (preview.steps.length !== length) return;
      if (disposed || generation !== symmetryGeneration || mode !== "symmetry") {
        return;
      }

      symmetryPreview = preview;
      previewSequence = preview;
      error = null;
      readyMessage = symmetryReadyMessage();
    } catch (deriveError) {
      if (disposed || generation !== symmetryGeneration) return;
      error = {
        kind: "derivation",
        message:
          "Couldn't derive the symmetric path. Shuffle the driver and try again.",
      };
      reportUnexpected(error.message, deriveError, "derive-symmetry");
    }
  }

  /** Rebuild the independent (shuffle-mode) preview from the two pools, used when
   * leaving symmetry — the pools were never clobbered, so this restores exactly
   * the two-path state that was showing before symmetry took over the preview. */
  function restoreIndependentPreview(): void {
    const blueSequence = bluePool.sequence;
    const redSequence = redPool.sequence;
    if (!blueSequence || !redSequence || appliedLength === null) return;
    try {
      previewSequence = createPreview(blueSequence, redSequence, appliedLength);
      error = null;
      readyMessage = "Both paths are ready.";
    } catch (restoreError) {
      reportPreviewFailure(restoreError);
    }
  }

  function setMode(next: FuseMode): void {
    if (next === mode) return;
    mode = next;
    persistModeState();
    if (next === "symmetry") {
      void deriveFollower();
    } else {
      // Cancel any in-flight derive and return to the independent two-path view.
      symmetryGeneration += 1;
      symmetryPreview = null;
      restoreIndependentPreview();
    }
  }

  function setDriver(side: FuseSide): void {
    if (side === driverSide) return;
    driverSide = side;
    persistModeState();
    if (mode === "symmetry") void deriveFollower();
  }

  function setTransform(id: FuseTransformId): void {
    if (id === transformId) return;
    transformId = id;
    persistModeState();
    if (mode === "symmetry") void deriveFollower();
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
      persistSelection(blue, red, appliedLength);
      // Back uses the same in-place swap as Shuffle, so playback stays on beat.
      error = null;
      readyMessage = sourceReadyMessage(side, previousEntry.sequence, true);
      if (mode === "symmetry" && side === driverSide) void deriveFollower();
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
    // Merge so the bpm write never drops the persisted pair, length, or step.
    persisted = { ...persisted, bpm };
    writePersistedState(persisted);
  }

  function handleDocumentVisibility(hidden: boolean): void {
    if (hidden) {
      stopClock();
      // Tab hidden is an implicit pause; capture the step before we lose frames.
      persistStep();
    }
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
      get nextSequence() {
        return pool.nextSequence;
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
    get mode() {
      return mode;
    },
    get driverSide() {
      return driverSide;
    },
    get transformId() {
      return transformId;
    },
    get symmetryPreview() {
      return symmetryPreview;
    },
    blue,
    red,
    initialize,
    setLength,
    shuffle,
    setSource,
    previous,
    retry,
    setMode,
    setDriver,
    setTransform,
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
