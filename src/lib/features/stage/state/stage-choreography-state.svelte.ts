import type {
  StageChoreography,
  Performer,
  Mark,
  FormationPresetId,
  WalkStyle,
  EasingType,
} from '../domain/stage-types';
import {
  PERFORMER_COLORS,
  PERFORMER_LABELS,
  DEFAULT_STAGE_WIDTH,
  DEFAULT_STAGE_DEPTH,
  DEFAULT_BPM,
  DEFAULT_PERFORMER_COUNT,
} from '../domain/stage-types';
import { generatePresetPositions } from './formation-presets';
import type { UnifiedPlaybackContext } from '$lib/shared/timeline/unified-playback-context';

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
  readonly interpolatedPositions: InterpolatedPosition[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  seek(progress: number): void;
  togglePlay(): void;
  toggleLoop(): void;
  onBpmChange(bpm: number): void;
  getPerformer(id: string): Performer | undefined;
  setPerformerCount(count: number): void;
  applyPreset(preset: FormationPresetId): void;
  insertFormationAtPlayhead(preset: FormationPresetId, transitionBeats?: number): void;
  addMark(performerId: string, x: number, z: number, beats?: number): void;
  beginDrag(): void;
  updateMarkPosition(markId: string, x: number, z: number): void;
  updateMarkBeats(markId: string, beats: number): void;
  updateMarkWalkStyle(markId: string, walkStyle: WalkStyle): void;
  updateMarkEasing(markId: string, easing: EasingType): void;
  deleteMark(markId: string): void;
  setBpm(bpm: number): void;
  undo(): void;
  redo(): void;
}

function createPerformer(index: number): Performer {
  return {
    id: crypto.randomUUID(),
    index,
    label: PERFORMER_LABELS[index] ?? `P${index}`,
    color: PERFORMER_COLORS[index] ?? '#888',
    marks: [],
    sequenceId: null,
  };
}

function createMark(x: number, z: number, beats = 0): Mark {
  return {
    id: crypto.randomUUID(),
    x,
    z,
    beats,
    walkStyle: 'direct',
    easing: 'linear',
  };
}

function totalBeatsForPerformer(performer: Performer): number {
  return performer.marks.reduce((sum, m) => sum + m.beats, 0);
}

function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

export function createStageChoreographyState(): StageChoreographyState {
  let choreography = $state<StageChoreography>({
    id: crypto.randomUUID(),
    name: 'Untitled Choreography',
    bpm: DEFAULT_BPM,
    stageWidth: DEFAULT_STAGE_WIDTH,
    stageDepth: DEFAULT_STAGE_DEPTH,
    performers: Array.from({ length: DEFAULT_PERFORMER_COUNT }, (_, i) => createPerformer(i)),
    sharedSequenceId: null,
  });

  // Apply default line preset
  const defaultPositions = generatePresetPositions(
    'line',
    DEFAULT_PERFORMER_COUNT,
    DEFAULT_STAGE_WIDTH,
    DEFAULT_STAGE_DEPTH
  );
  choreography.performers.forEach((performer, i) => {
    const pos = defaultPositions[i];
    if (pos) {
      performer.marks = [createMark(pos.x, pos.z, 0)];
    }
  });

  const MAX_UNDO_STACK = 50;
  let undoStack: string[] = [];
  let redoStack: string[] = [];

  function snapshotPerformers(): string {
    return JSON.stringify(
      choreography.performers.map((p) => ({
        id: p.id,
        index: p.index,
        label: p.label,
        color: p.color,
        marks: p.marks.map((m) => ({ ...m })),
        sequenceId: p.sequenceId,
      }))
    );
  }

  function pushUndo() {
    undoStack.push(snapshotPerformers());
    if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();
    redoStack = [];
  }

  function restorePerformers(json: string) {
    const restored = JSON.parse(json) as Performer[];
    choreography.performers = restored;
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotPerformers());
    const prev = undoStack.pop()!;
    restorePerformers(prev);
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotPerformers());
    const next = redoStack.pop()!;
    restorePerformers(next);
  }

  let isPlaying = $state(false);
  let elapsed = $state(0);
  let animationFrame: number | null = null;
  let lastTimestamp = 0;

  const maxTotalBeats = $derived(
    Math.max(1, ...choreography.performers.map(totalBeatsForPerformer))
  );

  const duration = $derived((maxTotalBeats * 60) / choreography.bpm);

  const overallProgress = $derived(duration > 0 ? Math.min(1, elapsed / duration) : 0);

  const currentStep = $derived.by(() => {
    const longestPerformer = choreography.performers.reduce(
      (best, p) => (totalBeatsForPerformer(p) > totalBeatsForPerformer(best) ? p : best),
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
    Math.max(1, ...choreography.performers.map((p) => Math.max(0, p.marks.length - 1)))
  );

  const beatMarkerPositions = $derived.by((): readonly number[] => {
    if (maxTotalBeats <= 0) return [];
    const longestPerformer = choreography.performers.reduce(
      (best, p) => (totalBeatsForPerformer(p) > totalBeatsForPerformer(best) ? p : best),
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

  const interpolatedPositions = $derived.by(() => {
    const currentBeat = overallProgress * maxTotalBeats;
    return choreography.performers.map((performer) => {
      if (performer.marks.length === 0) {
        return {
          performerId: performer.id,
          x: choreography.stageWidth / 2,
          z: choreography.stageDepth / 2,
          facing: 0,
        };
      }
      if (performer.marks.length === 1) {
        const m = performer.marks[0]!;
        return { performerId: performer.id, x: m.x, z: m.z, facing: 0 };
      }

      let accumulated = 0;
      for (let i = 1; i < performer.marks.length; i++) {
        const mark = performer.marks[i]!;
        const prevAccumulated = accumulated;
        accumulated += mark.beats;
        if (accumulated >= currentBeat || i === performer.marks.length - 1) {
          const fromMark = performer.marks[i - 1]!;
          const localProgress =
            mark.beats > 0 ? Math.min(1, (currentBeat - prevAccumulated) / mark.beats) : 1;
          const eased = applyEasing(localProgress, mark.easing);

          let x: number, z: number, facing: number;
          if (mark.walkStyle === 'crab') {
            x = fromMark.x + (mark.x - fromMark.x) * eased;
            z = fromMark.z + (mark.z - fromMark.z) * eased;
            facing = 0;
          } else {
            x = fromMark.x + (mark.x - fromMark.x) * eased;
            z = fromMark.z + (mark.z - fromMark.z) * eased;
            const dx = mark.x - fromMark.x;
            const dz = mark.z - fromMark.z;
            facing = Math.abs(dx) + Math.abs(dz) > 0.01 ? Math.atan2(dx, -dz) : 0;
          }
          return { performerId: performer.id, x, z, facing };
        }
      }
      const lastMark = performer.marks.at(-1)!;
      return { performerId: performer.id, x: lastMark.x, z: lastMark.z, facing: 0 };
    });
  });

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
    pushUndo();
    const clamped = Math.max(2, Math.min(8, count));
    const current = choreography.performers.length;
    if (clamped > current) {
      for (let i = current; i < clamped; i++) {
        choreography.performers.push(createPerformer(i));
      }
    } else if (clamped < current) {
      choreography.performers = choreography.performers.slice(0, clamped);
    }
  }

  function positionAtBeat(performer: Performer, targetBeat: number): { x: number; z: number } {
    if (performer.marks.length === 0) {
      return { x: choreography.stageWidth / 2, z: choreography.stageDepth / 2 };
    }
    if (performer.marks.length === 1) {
      return { x: performer.marks[0]!.x, z: performer.marks[0]!.z };
    }
    let accumulated = 0;
    for (let i = 1; i < performer.marks.length; i++) {
      const mark = performer.marks[i]!;
      const prevAccumulated = accumulated;
      accumulated += mark.beats;
      if (accumulated >= targetBeat || i === performer.marks.length - 1) {
        const fromMark = performer.marks[i - 1]!;
        const t = mark.beats > 0 ? Math.min(1, (targetBeat - prevAccumulated) / mark.beats) : 1;
        const eased = applyEasing(t, mark.easing);
        return {
          x: fromMark.x + (mark.x - fromMark.x) * eased,
          z: fromMark.z + (mark.z - fromMark.z) * eased,
        };
      }
    }
    const last = performer.marks.at(-1)!;
    return { x: last.x, z: last.z };
  }

  function insertFormationAtPlayhead(preset: FormationPresetId, transitionBeats = 4) {
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
        performer.marks.push(createMark(targetPos.x, targetPos.z, transitionBeats));
      } else {
        const currentPos = positionAtBeat(performer, currentBeat);
        let accumulated = 0;
        let insertIdx = performer.marks.length;
        for (let j = 1; j < performer.marks.length; j++) {
          accumulated += performer.marks[j]!.beats;
          if (accumulated > currentBeat) {
            const remaining = accumulated - currentBeat;
            performer.marks[j]!.beats = Math.round(currentBeat - (accumulated - performer.marks[j]!.beats));
            const splitMark = createMark(currentPos.x, currentPos.z, 0);
            performer.marks.splice(j + 1, 0, splitMark);
            insertIdx = j + 2;
            const targetMark = createMark(targetPos.x, targetPos.z, transitionBeats);
            performer.marks.splice(insertIdx, 0, targetMark);
            if (insertIdx + 1 < performer.marks.length) {
              performer.marks[insertIdx + 1]!.beats = Math.max(1, Math.round(remaining));
            }
            return;
          }
        }
        performer.marks.push(createMark(targetPos.x, targetPos.z, transitionBeats));
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

  function setBpm(bpm: number) {
    choreography.bpm = Math.max(15, Math.min(180, bpm));
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
    get playbackMode() {
      return undefined;
    },
    get interpolatedPositions() {
      return interpolatedPositions;
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
    applyPreset,
    insertFormationAtPlayhead,
    addMark,
    beginDrag,
    updateMarkPosition,
    updateMarkBeats,
    updateMarkWalkStyle,
    updateMarkEasing,
    deleteMark,
    setBpm,
    undo,
    redo,
  } satisfies StageChoreographyState;
}

// NOTE: module-level singleton with no reset path. Tests that need isolation
// must import createStageChoreographyState() directly to get a fresh instance,
// since getStageChoreographyState() shares one instance across the module's
// lifetime (and across HMR). Intentional for the app runtime; flagged for test
// authors rather than rearchitected.
let instance: StageChoreographyState | null = null;

export function getStageChoreographyState(): StageChoreographyState {
  if (!instance) {
    instance = createStageChoreographyState();
  }
  return instance;
}
