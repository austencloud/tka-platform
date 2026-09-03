/**
 * Corrections: what displaces the camera without being part of it.
 *
 * Decision D3 of the channel architecture. Handheld drift and subject tracking
 * were never framing. They were offsets added to whatever the framing produced,
 * and they lived as two optional fields on the resolved camera that
 * `sampleFilmDirector` had to remember to apply, in the right order, after the
 * sampler had already finished. Anything that sampled a track without going
 * through that function — the sampling snapshot, the channel editor, the
 * exporters — got a camera that was on a tripod and had stopped following.
 *
 * They are corrections now: additive, stated in each channel's own unit, never
 * keyed, and composed inside the channel store where every consumer sees them.
 *
 * Design and rationale:
 * `docs/superpowers/specs/active/2026-09-02-film-director-channel-architecture-design.md`
 */
import { sampleDirectorBlockingTrack } from "./director-blocking-track";
import type {
  CameraCorrection,
  CameraCorrectionDelta,
} from "./director-camera-channels";
import type { ResolvedDirectorScene } from "./film-director-schema";

/**
 * The corrections one scene carries, in the order they apply.
 *
 * Tracking first, then handheld. That order is load-bearing rather than
 * alphabetical: handheld converts an angular envelope to metres at the current
 * shooting distance, and an "aim" track changes that distance by turning the
 * camera toward a walker without moving the rig. Drift measured before the
 * follow would be drift on a shot nobody is watching.
 *
 * A scene with neither returns an empty array, and an empty array is what makes
 * every film that stays on the tripod sample its layers alone.
 */
export function cameraCorrectionsFor(
  scene: ResolvedDirectorScene
): readonly CameraCorrection[] {
  const corrections: CameraCorrection[] = [];
  const tracking = trackingCorrection(scene);
  if (tracking) corrections.push(tracking);
  const handheld = handheldCorrection(scene);
  if (handheld) corrections.push(handheld);
  return corrections;
}

/**
 * Gap 3. The compiler framed the tracked performer at their opening mark; this
 * shifts that framing by wherever they have walked since. Aim moves only the
 * target, so the camera turns in place; follow moves target and position
 * together, so the framing travels with them. Displacement is measured from
 * the performer's resolved opening position rather than the first blocking
 * keyframe, so a scene whose blocking opens on a hold still tracks.
 */
function trackingCorrection(
  scene: ResolvedDirectorScene
): CameraCorrection | undefined {
  const tracking = scene.camera.tracking;
  if (!tracking) return undefined;
  const performer = scene.performance.performers.find(
    (candidate) => candidate.id === tracking.performerId
  );
  // A tracked performer who is not in the cast is a resolution bug, not a
  // reason to move the camera. Say nothing rather than guessing.
  if (!performer) return undefined;

  return {
    id: "tracking",
    evaluate(atSeconds: number): CameraCorrectionDelta {
      const motion = sampleDirectorBlockingTrack(performer.blocking, atSeconds);
      const dx = motion.position.x - performer.position.x;
      const dz = motion.position.z - performer.position.z;
      if (dx === 0 && dz === 0) return {};
      if (tracking.mode === "aim") {
        return { "camera.target.x": dx, "camera.target.z": dz };
      }
      return {
        "camera.position.x": dx,
        "camera.position.z": dz,
        "camera.target.x": dx,
        "camera.target.z": dz,
      };
    },
  };
}

/**
 * Three incommensurate rates, in cycles per second. Their sum never repeats
 * over a scene's length, so the drift reads as a person holding a rig rather
 * than as a loop.
 */
const HANDHELD_RATES = [0.29, 0.71, 1.63] as const;

/**
 * One noise phase, fixed by the scene's handheld seed and which of the six
 * (axis, rate) slots it belongs to. Arithmetic rather than a hash stream so a
 * frame costs nothing to sample and never depends on sampling order.
 */
function handheldPhase(seed: number, slot: number): number {
  const mixed = Math.imul((seed ^ (slot + 1)) >>> 0, 2654435761) >>> 0;
  return ((mixed % 100003) / 100003) * Math.PI * 2;
}

/** Smooth drift on one axis, always inside [-1, 1]. */
function handheldNoise(seed: number, axis: number, seconds: number): number {
  let sum = 0;
  for (let rate = 0; rate < HANDHELD_RATES.length; rate += 1) {
    const slot = axis * HANDHELD_RATES.length + rate;
    sum += Math.sin(
      2 * Math.PI * HANDHELD_RATES[rate]! * seconds + handheldPhase(seed, slot)
    );
  }
  return sum / HANDHELD_RATES.length;
}

const POSITION_CHANNELS = [
  "camera.position.x",
  "camera.position.y",
  "camera.position.z",
] as const;

const TARGET_CHANNELS = [
  "camera.target.x",
  "camera.target.y",
  "camera.target.z",
] as const;

/**
 * Gap 11. Take it off the tripod. The composed track is what the rig would do
 * on sticks; this adds the operator. Position drifts inside a metres envelope
 * and the aim drifts inside a degrees envelope, converted to metres at the
 * current shooting distance so a long lens shakes as much on screen as a wide
 * one does.
 *
 * The aim drifts by the rig's own displacement PLUS its angular envelope: the
 * first part keeps the camera pointing where it was pointing while the body
 * sways, and only the second part is a wobble in the aim itself.
 */
function handheldCorrection(
  scene: ResolvedDirectorScene
): CameraCorrection | undefined {
  const handheld = scene.camera.handheld;
  if (!handheld) return undefined;

  return {
    id: "handheld",
    evaluate(atSeconds, frame): CameraCorrectionDelta {
      const distance = Math.hypot(
        frame.position[0] - frame.target[0],
        frame.position[1] - frame.target[1],
        frame.position[2] - frame.target[2]
      );
      const aimMeters = distance * Math.tan((handheld.degrees * Math.PI) / 180);
      const drift = (axis: number): number =>
        handheldNoise(handheld.seed, axis, atSeconds);

      const delta: CameraCorrectionDelta = {};
      for (let axis = 0; axis < 3; axis += 1) {
        const sway = handheld.meters * drift(axis);
        delta[POSITION_CHANNELS[axis]!] = sway;
        delta[TARGET_CHANNELS[axis]!] = sway + aimMeters * drift(axis + 3);
      }
      return delta;
    },
  };
}
