import type {
  StageChoreography,
  Performer,
  Mark,
  StageSequenceClip,
  Formation,
  FormationPresetId,
  WalkStyle,
  EasingType,
} from "../domain/stage-types";
import {
  PERFORMER_COLORS,
  PERFORMER_LABELS,
  DEFAULT_STAGE_WIDTH,
  DEFAULT_STAGE_DEPTH,
  DEFAULT_BPM,
  DEFAULT_PERFORMER_COUNT,
} from "../domain/stage-types";
import { generatePresetPositions } from "./formation-presets";
import type { UnifiedPlaybackContext } from "$lib/shared/timeline/unified-playback-context";
import {
  samplePerformerPerformance,
  sampleStagePerformance,
  type StagePerformanceFrame,
} from "../domain/stage-performance-sampler";
import { marksToFormations } from "../domain/formation-migration";
import { normalizeFormations } from "../domain/formation-invariants";
import { sampleFormationPerformance } from "../domain/stage-formation-sampler";
import { DEFAULT_STAGE_SEQUENCE_ID } from "../services/stage-sequence-loader";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { getPerformerSequenceEndBeat } from "../domain/stage-sequence-timeline";
import {
  DEFAULT_SCENE_ENVIRONMENT_ID,
  normalizeSceneEnvironmentId,
  type SceneEnvironmentId,
} from "$lib/shared/3d/environments/domain/scene-environment";

interface InterpolatedPosition {
  performerId: string;
  x: number;
  z: number;
  facing: number;
}

/**
 * Explicit shape of the stage choreography state object. Implements the shared
 * playback contract plus the stage-specific editing surface consumed by
 * StageViewer / FormationOverlay / StageTimeline.
 */
export interface StageChoreographyState extends UnifiedPlaybackContext {
  readonly choreography: StageChoreography;
  readonly bpm: number;
  readonly currentBeat: number;
  readonly maxTotalBeats: number;
  readonly performanceFrames: StagePerformanceFrame[];
  readonly interpolatedPositions: InterpolatedPosition[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  setEnvironmentId(environmentId: SceneEnvironmentId): void;
  seek(progress: number): void;
  togglePlay(): void;
  toggleLoop(): void;
  onBpmChange(bpm: number): void;
  getPerformer(id: string): Performer | undefined;
  setPerformerCount(count: number): void;
  addFormation(atBeat: number, presetId?: FormationPresetId): Formation | null;
  removeFormation(formationId: string): void;
  moveFormation(formationId: string, atBeat: number): void;
  setFormationTransitionBeats(formationId: string, beats: number): void;
  setFormationLabel(formationId: string, label: string): void;
  updateSpotPosition(
    formationId: string,
    performerId: string,
    x: number,
    z: number
  ): void;
  updateSpotWalkStyle(
    formationId: string,
    performerId: string,
    walkStyle: WalkStyle
  ): void;
  updateSpotEasing(
    formationId: string,
    performerId: string,
    easing: EasingType
  ): void;
  updateSpotFacing(
    formationId: string,
    performerId: string,
    facingAngle: number | undefined
  ): void;
  applyPresetToFormation(formationId: string, preset: FormationPresetId): void;
  applyPreset(preset: FormationPresetId): void;
  insertFormationAtPlayhead(
    preset: FormationPresetId,
    transitionBeats?: number
  ): void;
  addMark(performerId: string, x: number, z: number, beats?: number): void;
  beginDrag(): void;
  updateMarkPosition(markId: string, x: number, z: number): void;
  updateMarkBeats(markId: string, beats: number): void;
  updateMarkWalkStyle(markId: string, walkStyle: WalkStyle): void;
  updateMarkEasing(markId: string, easing: EasingType): void;
  deleteMark(markId: string): void;
  addSequenceClip(
    performerId: string,
    sequence: SequenceData,
    startBeat?: number
  ): StageSequenceClip | null;
  removeSequenceClip(clipId: string): void;
  moveSequenceClip(clipId: string, startBeat: number): void;
  resizeSequenceClip(clipId: string, durationBeats: number): void;
  toggleSequenceClipLoop(clipId: string): void;
  setBpm(bpm: number): void;
  undo(): void;
  redo(): void;
  destroy(): void;
}

function createPerformer(index: number): Performer {
  return {
    id: crypto.randomUUID(),
    index,
    label: PERFORMER_LABELS[index] ?? `P${index}`,
    color: PERFORMER_COLORS[index] ?? "#888",
    marks: [],
    sequenceClips: [
      createSequenceClip({
        sequenceId: DEFAULT_STAGE_SEQUENCE_ID,
        label: "Opening phrase",
        startBeat: 0,
        durationBeats: 8,
        sourceBeatCount: 8,
        loop: false,
      }),
      createSequenceClip({
        sequenceId: DEFAULT_STAGE_SEQUENCE_ID,
        label: "Second phrase",
        startBeat: 8,
        durationBeats: 8,
        sourceBeatCount: 8,
        loop: false,
      }),
    ],
  };
}

function createSequenceClip(
  input: Omit<StageSequenceClip, "id">
): StageSequenceClip {
  return { id: crypto.randomUUID(), ...input };
}

function createMark(x: number, z: number, beats = 0): Mark {
  return {
    id: crypto.randomUUID(),
    x,
    z,
    beats,
    walkStyle: "direct",
    easing: "linear",
  };
}

function totalBeatsForPerformer(performer: Performer): number {
  return Math.max(
    performer.marks.reduce((sum, m) => sum + m.beats, 0),
    getPerformerSequenceEndBeat(performer)
  );
}

export interface StageChoreographyStateOptions {
  initialEnvironmentId?: SceneEnvironmentId;
}

export function createStageChoreographyState(
  options: StageChoreographyStateOptions = {}
): StageChoreographyState {
  let choreography = $state<StageChoreography>({
    id: crypto.randomUUID(),
    name: "Untitled Choreography",
    bpm: DEFAULT_BPM,
    stageWidth: DEFAULT_STAGE_WIDTH,
    stageDepth: DEFAULT_STAGE_DEPTH,
    environmentId: options.initialEnvironmentId ?? DEFAULT_SCENE_ENVIRONMENT_ID,
    performers: Array.from({ length: DEFAULT_PERFORMER_COUNT }, (_, i) =>
      createPerformer(i)
    ),
    formations: [],
    sharedSequenceId: DEFAULT_STAGE_SEQUENCE_ID,
  });

  // The Stage opens on a real authored move, so the first press of Play proves
  // the same thing users came here to build: performers travel while their TKA
  // sequence continues. Both formations still use the ordinary mark model.
  const defaultPositions = generatePresetPositions(
    "line",
    DEFAULT_PERFORMER_COUNT,
    DEFAULT_STAGE_WIDTH,
    DEFAULT_STAGE_DEPTH
  );
  const defaultTargetPositions = generatePresetPositions(
    "v-shape",
    DEFAULT_PERFORMER_COUNT,
    DEFAULT_STAGE_WIDTH,
    DEFAULT_STAGE_DEPTH
  );
  choreography.performers.forEach((performer, i) => {
    const pos = defaultPositions[i];
    const target = defaultTargetPositions[i];
    if (pos && target) {
      performer.marks = [
        createMark(pos.x, pos.z, 0),
        createMark(target.x, target.z, 8),
      ];
    }
  });

  // A choreography always has a formation at beat 0, so derive the formation
  // track from the marks that were just authored rather than starting empty.
  choreography.formations = marksToFormations(
    choreography.performers,
    choreography
  );

  const MAX_UNDO_STACK = 50;
  let undoStack: string[] = [];
  let redoStack: string[] = [];

  function snapshotHistory(): string {
    return JSON.stringify({
      environmentId: choreography.environmentId,
      performers: choreography.performers.map((p) => ({
        id: p.id,
        index: p.index,
        label: p.label,
        color: p.color,
        marks: p.marks.map((m) => ({ ...m })),
        sequenceClips: p.sequenceClips.map((clip) => ({ ...clip })),
      })),
      formations: choreography.formations.map((formation) => ({
        ...formation,
        spots: Object.fromEntries(
          Object.entries(formation.spots).map(([performerId, spot]) => [
            performerId,
            { ...spot },
          ])
        ),
      })),
    });
  }

  function pushUndo() {
    undoStack.push(snapshotHistory());
    if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();
    redoStack = [];
  }

  function restoreHistory(json: string) {
    const restored = JSON.parse(json) as {
      environmentId?: string;
      performers: Performer[];
      formations: Formation[];
    };
    choreography.environmentId = normalizeSceneEnvironmentId(
      restored.environmentId,
      choreography.environmentId
    );
    choreography.performers = restored.performers;
    choreography.formations = normalizeFormations(
      restored.formations,
      restored.performers.map((performer) => performer.id),
      choreography.stageWidth,
      choreography.stageDepth
    );
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotHistory());
    const prev = undoStack.pop()!;
    restoreHistory(prev);
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotHistory());
    const next = redoStack.pop()!;
    restoreHistory(next);
  }

  function setEnvironmentId(environmentId: SceneEnvironmentId) {
    if (environmentId === choreography.environmentId) return;
    pushUndo();
    choreography.environmentId = environmentId;
  }

  let isPlaying = $state(false);
  let elapsed = $state(0);
  let animationFrame: number | null = null;
  let lastTimestamp = 0;

  const maxTotalBeats = $derived(
    Math.max(1, ...choreography.performers.map(totalBeatsForPerformer))
  );

  const duration = $derived((maxTotalBeats * 60) / choreography.bpm);

  const overallProgress = $derived(
    duration > 0 ? Math.min(1, elapsed / duration) : 0
  );
  const currentBeat = $derived(overallProgress * maxTotalBeats);

  const currentStep = $derived.by(() => {
    const longestPerformer = choreography.performers.reduce(
      (best, p) =>
        totalBeatsForPerformer(p) > totalBeatsForPerformer(best) ? p : best,
      choreography.performers[0]!
    );
    const currentBeat = overallProgress * maxTotalBeats;
    let accumulated = 0;
    for (let i = 1; i < longestPerformer.marks.length; i++) {
      accumulated += longestPerformer.marks[i]!.beats;
      if (accumulated >= currentBeat) return i - 1;
    }
    return Math.max(0, longestPerformer.marks.length - 2);
  });

  const totalSteps = $derived(
    Math.max(
      1,
      ...choreography.performers.map((p) => Math.max(0, p.marks.length - 1))
    )
  );

  const beatMarkerPositions = $derived.by((): readonly number[] => {
    if (maxTotalBeats <= 0) return [];
    const longestPerformer = choreography.performers.reduce(
      (best, p) =>
        totalBeatsForPerformer(p) > totalBeatsForPerformer(best) ? p : best,
      choreography.performers[0]!
    );
    const positions: number[] = [];
    let accumulated = 0;
    for (let i = 1; i < longestPerformer.marks.length; i++) {
      accumulated += longestPerformer.marks[i]!.beats;
      positions.push(accumulated / maxTotalBeats);
    }
    return positions;
  });

  const performanceFrames = $derived(
    sampleStagePerformance(choreography, currentBeat)
  );

  const interpolatedPositions = $derived(
    performanceFrames.map((frame) => ({
      performerId: frame.performerId,
      x: frame.stagePosition.x,
      z: frame.stagePosition.z,
      facing: frame.bodyFacing,
    }))
  );

  function tick() {
    if (!isPlaying) return;
    const now = performance.now();
    const dt = (now - lastTimestamp) / 1000;
    lastTimestamp = now;
    elapsed = Math.min(elapsed + dt, duration);
    if (elapsed >= duration) {
      isPlaying = false;
      elapsed = duration;
      animationFrame = null;
      return;
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function togglePlay() {
    if (isPlaying) {
      isPlaying = false;
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    } else {
      if (elapsed >= duration) elapsed = 0;
      isPlaying = true;
      lastTimestamp = performance.now();
      tick();
    }
  }

  function seek(progress: number) {
    elapsed = Math.max(0, Math.min(1, progress)) * duration;
  }

  function toggleLoop() {
    // v1: no loop support
  }

  function getPerformer(id: string): Performer | undefined {
    return choreography.performers.find((p) => p.id === id);
  }

  function setPerformerCount(count: number) {
    const clamped = Math.max(2, Math.min(8, count));
    const current = choreography.performers.length;
    if (clamped === current) return;
    pushUndo();
    if (clamped > current) {
      const defaultPositions = generatePresetPositions(
        "line",
        clamped,
        choreography.stageWidth,
        choreography.stageDepth
      );
      for (let i = current; i < clamped; i++) {
        const performer = createPerformer(i);
        choreography.performers.push(performer);
        const position = defaultPositions[i] ?? {
          x: choreography.stageWidth / 2,
          z: choreography.stageDepth / 2,
        };
        choreography.formations = choreography.formations.map((formation) => ({
          ...formation,
          spots: {
            ...formation.spots,
            [performer.id]: {
              ...position,
              walkStyle: "direct",
              easing: "linear",
            },
          },
        }));
      }
    } else if (clamped < current) {
      choreography.performers = choreography.performers.slice(0, clamped);
    }
    normalizeFormationTrack();
  }

  function normalizeFormationTrack() {
    choreography.formations = normalizeFormations(
      choreography.formations,
      choreography.performers.map((performer) => performer.id),
      choreography.stageWidth,
      choreography.stageDepth
    );
  }

  function findFormation(formationId: string): Formation | undefined {
    return choreography.formations.find(
      (formation) => formation.id === formationId
    );
  }

  function addFormation(
    atBeat: number,
    presetId?: FormationPresetId
  ): Formation | null {
    const snappedBeat = Number.isFinite(atBeat)
      ? Math.max(0, Math.round(atBeat))
      : 0;
    if (
      choreography.formations.some(
        (formation) => formation.atBeat === snappedBeat
      )
    ) {
      return null;
    }

    const presetPositions = presetId
      ? generatePresetPositions(
          presetId,
          choreography.performers.length,
          choreography.stageWidth,
          choreography.stageDepth
        )
      : null;
    const spots: Formation["spots"] = {};
    choreography.performers.forEach((performer, index) => {
      const sampled = sampleFormationPerformance(
        choreography,
        performer.id,
        snappedBeat
      ).stagePosition;
      const position = presetPositions?.[index] ?? sampled;
      spots[performer.id] = {
        x: position.x,
        z: position.z,
        walkStyle: "direct",
        easing: "linear",
      };
    });

    pushUndo();
    const formation: Formation = {
      id: crypto.randomUUID(),
      atBeat: snappedBeat,
      transitionBeats: 8,
      spots,
      presetId,
    };
    choreography.formations = [...choreography.formations, formation];
    normalizeFormationTrack();
    return findFormation(formation.id) ?? null;
  }

  function removeFormation(formationId: string) {
    const index = choreography.formations.findIndex(
      (formation) => formation.id === formationId
    );
    if (index <= 0) return;
    pushUndo();
    choreography.formations = choreography.formations.filter(
      (formation) => formation.id !== formationId
    );
    normalizeFormationTrack();
  }

  function moveFormation(formationId: string, atBeat: number) {
    const index = choreography.formations.findIndex(
      (formation) => formation.id === formationId
    );
    if (index <= 0) return;
    const formation = choreography.formations[index];
    if (!formation) return;
    const snappedBeat = Number.isFinite(atBeat)
      ? Math.max(1, Math.round(atBeat))
      : 1;
    if (
      choreography.formations.some(
        (candidate) =>
          candidate.id !== formationId && candidate.atBeat === snappedBeat
      )
    ) {
      return;
    }
    pushUndo();
    formation.atBeat = snappedBeat;
    normalizeFormationTrack();
  }

  function setFormationTransitionBeats(formationId: string, beats: number) {
    const formation = findFormation(formationId);
    if (!formation) return;
    pushUndo();
    formation.transitionBeats = beats;
    normalizeFormationTrack();
  }

  function setFormationLabel(formationId: string, label: string) {
    const formation = findFormation(formationId);
    if (!formation) return;
    pushUndo();
    const trimmed = label.trim();
    formation.label = trimmed || undefined;
    normalizeFormationTrack();
  }

  function updateSpotPosition(
    formationId: string,
    performerId: string,
    x: number,
    z: number
  ) {
    const formation = findFormation(formationId);
    const spot = formation?.spots[performerId];
    if (!formation || !spot) return;
    // Dragging calls this on every pointermove, so history is pushed once by
    // beginDrag() the way mark dragging already does it. Pushing here would
    // spend the whole undo stack on one drag.
    spot.x = x;
    spot.z = z;
    formation.presetId = "custom";
    normalizeFormationTrack();
  }

  function updateSpotWalkStyle(
    formationId: string,
    performerId: string,
    walkStyle: WalkStyle
  ) {
    const spot = findFormation(formationId)?.spots[performerId];
    if (!spot) return;
    pushUndo();
    spot.walkStyle = walkStyle;
    normalizeFormationTrack();
  }

  function updateSpotEasing(
    formationId: string,
    performerId: string,
    easing: EasingType
  ) {
    const spot = findFormation(formationId)?.spots[performerId];
    if (!spot) return;
    pushUndo();
    spot.easing = easing;
    normalizeFormationTrack();
  }

  function updateSpotFacing(
    formationId: string,
    performerId: string,
    facingAngle: number | undefined
  ) {
    const spot = findFormation(formationId)?.spots[performerId];
    if (!spot) return;
    pushUndo();
    spot.facingAngle = facingAngle;
    normalizeFormationTrack();
  }

  function applyPresetToFormation(
    formationId: string,
    preset: FormationPresetId
  ) {
    const formation = findFormation(formationId);
    if (!formation) return;
    const positions = generatePresetPositions(
      preset,
      choreography.performers.length,
      choreography.stageWidth,
      choreography.stageDepth
    );
    pushUndo();
    choreography.performers.forEach((performer, index) => {
      const position = positions[index];
      const spot = formation.spots[performer.id];
      if (!position || !spot) return;
      formation.spots[performer.id] = { ...spot, ...position };
    });
    formation.presetId = preset;
    normalizeFormationTrack();
  }

  function positionAtBeat(
    performer: Performer,
    targetBeat: number
  ): { x: number; z: number } {
    return samplePerformerPerformance(performer, choreography, targetBeat)
      .stagePosition;
  }

  function insertFormationAtPlayhead(
    preset: FormationPresetId,
    transitionBeats = 4
  ) {
    pushUndo();
    const currentBeat = overallProgress * maxTotalBeats;
    const positions = generatePresetPositions(
      preset,
      choreography.performers.length,
      choreography.stageWidth,
      choreography.stageDepth
    );

    choreography.performers.forEach((performer, i) => {
      const targetPos = positions[i];
      if (!targetPos) return;

      const totalPerformerBeats = totalBeatsForPerformer(performer);

      if (currentBeat <= 0 && performer.marks.length <= 1) {
        performer.marks = [createMark(targetPos.x, targetPos.z, 0)];
        return;
      }

      if (currentBeat >= totalPerformerBeats) {
        performer.marks.push(
          createMark(targetPos.x, targetPos.z, transitionBeats)
        );
      } else {
        const currentPos = positionAtBeat(performer, currentBeat);
        let accumulated = 0;
        let insertIdx = performer.marks.length;
        for (let j = 1; j < performer.marks.length; j++) {
          accumulated += performer.marks[j]!.beats;
          if (accumulated > currentBeat) {
            const remaining = accumulated - currentBeat;
            performer.marks[j]!.beats = Math.round(
              currentBeat - (accumulated - performer.marks[j]!.beats)
            );
            const splitMark = createMark(currentPos.x, currentPos.z, 0);
            performer.marks.splice(j + 1, 0, splitMark);
            insertIdx = j + 2;
            const targetMark = createMark(
              targetPos.x,
              targetPos.z,
              transitionBeats
            );
            performer.marks.splice(insertIdx, 0, targetMark);
            if (insertIdx + 1 < performer.marks.length) {
              performer.marks[insertIdx + 1]!.beats = Math.max(
                1,
                Math.round(remaining)
              );
            }
            return;
          }
        }
        performer.marks.push(
          createMark(targetPos.x, targetPos.z, transitionBeats)
        );
      }
    });
  }

  function applyPreset(preset: FormationPresetId) {
    insertFormationAtPlayhead(preset);
  }

  function addMark(performerId: string, x: number, z: number, beats = 4) {
    pushUndo();
    const performer = choreography.performers.find((p) => p.id === performerId);
    if (!performer) return;
    const clampedX = Math.max(0, Math.min(choreography.stageWidth, x));
    const clampedZ = Math.max(0, Math.min(choreography.stageDepth, z));
    performer.marks.push(createMark(clampedX, clampedZ, beats));
  }

  function beginDrag() {
    pushUndo();
  }

  function updateMarkPosition(markId: string, x: number, z: number) {
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.x = Math.max(0, Math.min(choreography.stageWidth, x));
        mark.z = Math.max(0, Math.min(choreography.stageDepth, z));
        return;
      }
    }
  }

  function updateMarkBeats(markId: string, beats: number) {
    pushUndo();
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.beats = Math.max(1, Math.min(32, beats));
        return;
      }
    }
  }

  function updateMarkWalkStyle(markId: string, walkStyle: WalkStyle) {
    pushUndo();
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.walkStyle = walkStyle;
        return;
      }
    }
  }

  function updateMarkEasing(markId: string, easing: EasingType) {
    pushUndo();
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.easing = easing;
        return;
      }
    }
  }

  function deleteMark(markId: string) {
    pushUndo();
    for (const performer of choreography.performers) {
      const idx = performer.marks.findIndex((m) => m.id === markId);
      if (idx > 0) {
        performer.marks.splice(idx, 1);
        return;
      }
    }
  }

  function addSequenceClip(
    performerId: string,
    sequence: SequenceData,
    startBeat = currentBeat
  ): StageSequenceClip | null {
    const performer = choreography.performers.find(
      (candidate) => candidate.id === performerId
    );
    if (!performer) return null;

    pushUndo();
    const sourceBeatCount = Math.max(1, sequence.steps.length);
    const latestEnd = getPerformerSequenceEndBeat(performer);
    const snappedStart = Math.max(0, Math.round(startBeat * 4) / 4);
    const clip = createSequenceClip({
      sequenceId: sequence.id,
      label: sequence.word || sequence.name || "Untitled sequence",
      startBeat: performer.sequenceClips.some(
        (candidate) =>
          snappedStart >= candidate.startBeat &&
          snappedStart < candidate.startBeat + candidate.durationBeats
      )
        ? latestEnd
        : snappedStart,
      durationBeats: sourceBeatCount,
      sourceBeatCount,
      loop: sequence.isCircular === true,
    });
    performer.sequenceClips = [...performer.sequenceClips, clip].sort(
      (a, b) => a.startBeat - b.startBeat
    );
    return clip;
  }

  function findSequenceClip(
    clipId: string
  ): { performer: Performer; clip: StageSequenceClip } | null {
    for (const performer of choreography.performers) {
      const clip = performer.sequenceClips.find(
        (candidate) => candidate.id === clipId
      );
      if (clip) return { performer, clip };
    }
    return null;
  }

  function removeSequenceClip(clipId: string) {
    const match = findSequenceClip(clipId);
    if (!match) return;
    pushUndo();
    match.performer.sequenceClips = match.performer.sequenceClips.filter(
      (clip) => clip.id !== clipId
    );
  }

  function moveSequenceClip(clipId: string, startBeat: number) {
    const match = findSequenceClip(clipId);
    if (!match) return;
    pushUndo();
    match.clip.startBeat = Math.max(0, Math.round(startBeat * 4) / 4);
    match.performer.sequenceClips = [...match.performer.sequenceClips].sort(
      (a, b) => a.startBeat - b.startBeat
    );
  }

  function resizeSequenceClip(clipId: string, durationBeats: number) {
    const match = findSequenceClip(clipId);
    if (!match) return;
    pushUndo();
    match.clip.durationBeats = Math.max(
      0.25,
      Math.round(durationBeats * 4) / 4
    );
  }

  function toggleSequenceClipLoop(clipId: string) {
    const match = findSequenceClip(clipId);
    if (!match) return;
    pushUndo();
    match.clip.loop = !match.clip.loop;
  }

  function setBpm(bpm: number) {
    choreography.bpm = Math.max(15, Math.min(180, bpm));
  }

  function destroy() {
    isPlaying = false;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  return {
    get choreography() {
      return choreography;
    },
    get overallProgress() {
      return overallProgress;
    },
    get currentStep() {
      return currentStep;
    },
    get totalSteps() {
      return totalSteps;
    },
    get isPlaying() {
      return isPlaying;
    },
    get isLooping() {
      return undefined;
    },
    get duration() {
      return duration;
    },
    get elapsed() {
      return elapsed;
    },
    get beatMarkerPositions() {
      return beatMarkerPositions;
    },
    get bpm() {
      return choreography.bpm;
    },
    get currentBeat() {
      return currentBeat;
    },
    get maxTotalBeats() {
      return maxTotalBeats;
    },
    get playbackMode() {
      return undefined;
    },
    get interpolatedPositions() {
      return interpolatedPositions;
    },
    get performanceFrames() {
      return performanceFrames;
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    seek,
    togglePlay,
    toggleLoop,
    onBpmChange: setBpm,
    getPerformer,
    setPerformerCount,
    addFormation,
    removeFormation,
    moveFormation,
    setFormationTransitionBeats,
    setFormationLabel,
    updateSpotPosition,
    updateSpotWalkStyle,
    updateSpotEasing,
    updateSpotFacing,
    applyPresetToFormation,
    applyPreset,
    insertFormationAtPlayhead,
    addMark,
    beginDrag,
    updateMarkPosition,
    updateMarkBeats,
    updateMarkWalkStyle,
    updateMarkEasing,
    deleteMark,
    addSequenceClip,
    removeSequenceClip,
    moveSequenceClip,
    resizeSequenceClip,
    toggleSequenceClipLoop,
    setBpm,
    setEnvironmentId,
    undo,
    redo,
    destroy,
  } satisfies StageChoreographyState;
}
