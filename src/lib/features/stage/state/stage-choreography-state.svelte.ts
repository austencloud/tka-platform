import type {
  StageChoreography,
  FormationKeyframe,
  PerformerPose,
  TransitionConfig,
  FormationPresetId,
} from "../domain/stage-types";
import {
  PERFORMER_COLORS,
  DEFAULT_STAGE_WIDTH,
  DEFAULT_STAGE_DEPTH,
  DEFAULT_BPM,
} from "../domain/stage-types";
import { generateFormation } from "./formation-presets";
import {
  interpolateFormation,
  type InterpolatedPose,
} from "./formation-interpolator";

function createPerformerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `p${i + 1}`);
}

export function createStageChoreographyState() {
  const performerIds = createPerformerIds(4);

  let choreography = $state<StageChoreography>({
    id: crypto.randomUUID(),
    name: "Untitled Choreography",
    bpm: DEFAULT_BPM,
    stageWidth: DEFAULT_STAGE_WIDTH,
    stageDepth: DEFAULT_STAGE_DEPTH,
    performers: performerIds.map((id, i) => ({
      id,
      index: i,
      color: PERFORMER_COLORS[i] ?? "#888",
    })),
    formations: [],
  });

  let activeFormationIndex = $state(0);
  let isPlaying = $state(false);
  let playProgress = $state(0);
  let selectedPerformerIndex = $state<number | null>(null);

  const activeFormation = $derived(
    choreography.formations[activeFormationIndex] ?? null
  );

  const nextFormation = $derived(
    choreography.formations[activeFormationIndex + 1] ?? null
  );

  const interpolatedPositions = $derived.by(() => {
    if (!activeFormation || !nextFormation || !isPlaying) {
      return (activeFormation?.positions ?? []).map((p) => ({
        ...p,
        speed: 0,
      })) as InterpolatedPose[];
    }
    const transition: TransitionConfig = nextFormation.transition ?? {
      interpolation: "linear",
      easing: "easeInOut",
    };
    return interpolateFormation(
      activeFormation,
      nextFormation,
      playProgress,
      transition
    );
  });

  function setPerformerCount(count: number) {
    const ids = createPerformerIds(count);
    choreography.performers = ids.map((id, i) => ({
      id,
      index: i,
      color: PERFORMER_COLORS[i] ?? "#888",
    }));
    choreography.formations = choreography.formations.map((f) => ({
      ...f,
      positions: f.positions.slice(0, count),
    }));
  }

  function applyPreset(preset: FormationPresetId) {
    const ids = choreography.performers.map((p) => p.id);
    const positions = generateFormation(
      preset,
      choreography.performers.length,
      choreography.stageWidth,
      choreography.stageDepth,
      ids
    );
    const current = choreography.formations[activeFormationIndex];
    if (current) {
      current.positions = positions;
    } else {
      choreography.formations.push({
        id: crypto.randomUUID(),
        beat: activeFormationIndex * 4,
        positions,
      });
    }
  }

  function addFormation(beat: number, preset?: FormationPresetId) {
    const ids = choreography.performers.map((p) => p.id);
    const positions = preset
      ? generateFormation(
          preset,
          choreography.performers.length,
          choreography.stageWidth,
          choreography.stageDepth,
          ids
        )
      : ids.map((id) => ({
          performerId: id,
          x: choreography.stageWidth / 2,
          z: choreography.stageDepth / 2,
          facing: 0,
        }));

    choreography.formations.push({
      id: crypto.randomUUID(),
      beat,
      positions,
      transition: { interpolation: "linear", easing: "easeInOut" },
    });
    choreography.formations.sort((a, b) => a.beat - b.beat);
  }

  function updatePerformerPosition(
    formationIndex: number,
    performerId: string,
    x: number,
    z: number
  ) {
    const formation = choreography.formations[formationIndex];
    if (!formation) return;
    const pose = formation.positions.find(
      (p) => p.performerId === performerId
    );
    if (pose) {
      pose.x = Math.max(0, Math.min(choreography.stageWidth, x));
      pose.z = Math.max(0, Math.min(choreography.stageDepth, z));
    }
  }

  function setTransition(
    formationIndex: number,
    config: TransitionConfig
  ) {
    const formation = choreography.formations[formationIndex];
    if (formation) {
      formation.transition = config;
    }
  }

  let animationFrame: number | null = null;
  let lastTimestamp = 0;

  function play() {
    if (choreography.formations.length < 2) return;
    isPlaying = true;
    playProgress = 0;
    activeFormationIndex = 0;
    lastTimestamp = performance.now();
    tick();
  }

  function stop() {
    isPlaying = false;
    playProgress = 0;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function tick() {
    if (!isPlaying) return;
    const now = performance.now();
    const dt = (now - lastTimestamp) / 1000;
    lastTimestamp = now;

    const current = choreography.formations[activeFormationIndex];
    const next = choreography.formations[activeFormationIndex + 1];
    if (!current || !next) {
      stop();
      return;
    }

    const beatDuration = next.beat - current.beat;
    const secondsPerBeat = 60 / choreography.bpm;
    const transitionDuration = beatDuration * secondsPerBeat;

    playProgress += dt / transitionDuration;

    if (playProgress >= 1) {
      activeFormationIndex++;
      playProgress = 0;
      if (activeFormationIndex >= choreography.formations.length - 1) {
        stop();
        return;
      }
    }

    animationFrame = requestAnimationFrame(tick);
  }

  return {
    get choreography() { return choreography; },
    get activeFormationIndex() { return activeFormationIndex; },
    set activeFormationIndex(v: number) { activeFormationIndex = v; },
    get activeFormation() { return activeFormation; },
    get nextFormation() { return nextFormation; },
    get interpolatedPositions() { return interpolatedPositions; },
    get isPlaying() { return isPlaying; },
    get playProgress() { return playProgress; },
    get selectedPerformerIndex() { return selectedPerformerIndex; },
    set selectedPerformerIndex(v: number | null) { selectedPerformerIndex = v; },
    setPerformerCount,
    applyPreset,
    addFormation,
    updatePerformerPosition,
    setTransition,
    play,
    stop,
  };
}

let instance: ReturnType<typeof createStageChoreographyState> | null = null;

export function getStageChoreographyState() {
  if (!instance) {
    instance = createStageChoreographyState();
  }
  return instance;
}
