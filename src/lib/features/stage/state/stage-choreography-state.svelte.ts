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

export function createStageChoreographyState() {
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

  function applyPreset(preset: FormationPresetId) {
    const positions = generatePresetPositions(
      preset,
      choreography.performers.length,
      choreography.stageWidth,
      choreography.stageDepth
    );
    choreography.performers.forEach((performer, i) => {
      const pos = positions[i];
      if (pos) {
        performer.marks = [createMark(pos.x, pos.z, 0)];
      }
    });
  }

  function addMark(performerId: string, x: number, z: number, beats = 4) {
    const performer = choreography.performers.find((p) => p.id === performerId);
    if (!performer) return;
    const clampedX = Math.max(0, Math.min(choreography.stageWidth, x));
    const clampedZ = Math.max(0, Math.min(choreography.stageDepth, z));
    performer.marks.push(createMark(clampedX, clampedZ, beats));
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
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.beats = Math.max(1, Math.min(32, beats));
        return;
      }
    }
  }

  function updateMarkWalkStyle(markId: string, walkStyle: WalkStyle) {
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.walkStyle = walkStyle;
        return;
      }
    }
  }

  function updateMarkEasing(markId: string, easing: EasingType) {
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.easing = easing;
        return;
      }
    }
  }

  function deleteMark(markId: string) {
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
    seek,
    togglePlay,
    toggleLoop,
    onBpmChange: setBpm,
    getPerformer,
    setPerformerCount,
    applyPreset,
    addMark,
    updateMarkPosition,
    updateMarkBeats,
    updateMarkWalkStyle,
    updateMarkEasing,
    deleteMark,
    setBpm,
  } satisfies UnifiedPlaybackContext & Record<string, unknown>;
}

let instance: ReturnType<typeof createStageChoreographyState> | null = null;

export function getStageChoreographyState() {
  if (!instance) {
    instance = createStageChoreographyState();
  }
  return instance;
}
