import type { PlaneMode } from "@austencloud/scene-3d";
import type { CharacterInstanceState } from "../state/character-instance-state.svelte";
import {
  buildStanceYawTrackForSource,
  resolveTrackedUpperBodyStance,
  type StanceYawTrack,
} from "../collision/stance-yaw-track";

interface CachedStanceTrack {
  sequence: CharacterInstanceState["loadedSequence"];
  planeMode: PlaneMode;
  stepCount: number;
  loop: boolean;
  track: StanceYawTrack | null;
}

const stanceTracks = new WeakMap<CharacterInstanceState, CachedStanceTrack>();

function resolveStanceTrack(performer: CharacterInstanceState) {
  const sequence = performer.loadedSequence;
  const planeMode = performer.planeMode;
  const stepCount = performer.motionStepCount;
  const loop = performer.loop;
  const cached = stanceTracks.get(performer);
  if (
    cached &&
    cached.sequence === sequence &&
    cached.planeMode === planeMode &&
    cached.stepCount === stepCount &&
    cached.loop === loop
  ) {
    return cached.track;
  }

  const track = buildStanceYawTrackForSource(performer, planeMode);
  stanceTracks.set(performer, { sequence, planeMode, stepCount, loop, track });
  return track;
}

/**
 * One owner for the tracked torso pose consumed by both render backends.
 */
export function resolvePerformerUpperBodyStance(
  performer: CharacterInstanceState,
) {
  return resolveTrackedUpperBodyStance(
    resolveStanceTrack(performer),
    performer.scoreTime,
    performer.planeMode,
    performer.leftPropState,
    performer.rightPropState,
  );
}
