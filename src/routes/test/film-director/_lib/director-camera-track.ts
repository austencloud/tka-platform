import { computeFramingShot } from "$lib/shared/3d/camera/compute-framing-shot";

import {
  buildCameraChannels,
  sampleCameraFrame,
  type CameraChannelStore,
  type DirectorCameraFrame,
} from "./director-camera-channels";
import {
  compileCameraMoves,
  compileCameraShots,
  computeCameraFraming,
  directorFloorY,
  subjectAnchorHeight,
} from "./camera-language";
import {
  fitPresetKeyframes,
  measureCastGeometry,
} from "./director-camera-fit";
import {
  resolvePresetForFormation,
  type DirectorFormation,
} from "./director-camera-presets";
import { axisSeedValue, resolveFilmSeed, type FilmSeed } from "./directive-random";
import type {
  DirectorCameraInput,
  DirectorCameraPreset,
  DirectorCameraTargetInput,
  DirectorEasing,
  ResolvedDirectorCameraKeyframe,
  ResolvedDirectorHandheld,
  ResolvedDirectorPerformer,
} from "./film-director-schema";

export type { DirectorCameraFrame } from "./director-camera-channels";

export function getPreviewCameraFov(
  filmFovDeg: number,
  filmAspectRatio: number,
  viewportAspectRatio: number
): number {
  if (
    !Number.isFinite(filmFovDeg) ||
    !Number.isFinite(filmAspectRatio) ||
    !Number.isFinite(viewportAspectRatio) ||
    filmFovDeg <= 0 ||
    filmAspectRatio <= 0 ||
    viewportAspectRatio <= 0
  ) {
    return filmFovDeg;
  }
  if (viewportAspectRatio >= filmAspectRatio) return filmFovDeg;

  const filmHalfFovRad = (filmFovDeg * Math.PI) / 360;
  const previewFovDeg =
    (Math.atan(
      Math.tan(filmHalfFovRad) * (filmAspectRatio / viewportAspectRatio)
    ) *
      360) /
    Math.PI;
  return Math.min(82, previewFovDeg);
}

interface CameraTrackContext {
  durationSeconds: number;
  aspectRatio: number;
  groundOffset: number;
  performers: readonly ResolvedDirectorPerformer[];
  formation: DirectorFormation;
  /** The owning scene's id, for error messages and the handheld seed. */
  sceneId: string;
  /**
   * The film's seed, so handheld noise is stable per (film, scene) and
   * rerollable through `seed.axes.handheld`. Optional: a caller that resolves
   * a camera outside a film (tests, tooling) falls back to seeding from the
   * scene id alone, which is still deterministic.
   */
  filmSeed?: FilmSeed;
}

/** Drift envelopes for the three spoken handheld rigs. */
const HANDHELD_PRESETS: Record<
  "subtle" | "steady" | "rough",
  { meters: number; degrees: number }
> = {
  subtle: { meters: 0.02, degrees: 0.4 },
  steady: { meters: 0.05, degrees: 1 },
  rough: { meters: 0.12, degrees: 2.5 },
};

function resolveHandheld(
  input: DirectorCameraInput["handheld"],
  context: CameraTrackContext
): ResolvedDirectorHandheld | undefined {
  if (!input) return undefined;
  const envelope =
    typeof input === "string" ? HANDHELD_PRESETS[input] : input;
  return {
    meters: envelope.meters,
    degrees: envelope.degrees,
    seed: axisSeedValue(
      context.filmSeed ?? resolveFilmSeed(context.sceneId),
      context.sceneId,
      "handheld"
    ),
  };
}

export interface ResolvedDirectorCameraTrack {
  preset: DirectorCameraPreset;
  substitutedFor: DirectorCameraPreset | null;
  keyframes: ResolvedDirectorCameraKeyframe[];
  /**
   * Present only when the scene's subject asked to be tracked. The compiler
   * frames the walker at their opening mark; the sampler shifts that framing
   * by wherever they have walked since. Absent (not null) otherwise, so films
   * that never track resolve byte-identically to their earlier snapshots.
   */
  tracking?: { performerId: string; mode: "aim" | "follow" };
  /**
   * Present only when the scene came off the tripod. The sampler adds drift
   * inside these envelopes after tracking; absent (not null) otherwise, so
   * films that stay on the tripod resolve byte-identically.
   */
  handheld?: ResolvedDirectorHandheld;
}

function vec3(value: {
  x: number;
  y: number;
  z: number;
}): [number, number, number] {
  return [value.x, value.y, value.z];
}

function resolveTarget(
  input: DirectorCameraTargetInput | undefined,
  performers: readonly ResolvedDirectorPerformer[],
  groupTarget: [number, number, number],
  groundOffset: number
): [number, number, number] {
  if (!input || input.kind === "group") return [...groupTarget];
  if (input.kind === "point") return [...input.position];

  const performer = performers.find(
    (candidate) => candidate.id === input.performerId
  );
  if (!performer) {
    throw new Error(
      `Camera target references missing performer "${input.performerId}".`
    );
  }
  // Gap 12. A hand or a prop tip names its own height above the floor; a
  // performer target takes the one the director stated, or the group's.
  const anchorHeight = subjectAnchorHeight(input.kind);
  const height =
    anchorHeight !== null
      ? anchorHeight
      : input.kind === "performer"
        ? input.height
        : undefined;
  return [
    performer.position.x,
    height !== undefined ? directorFloorY(groundOffset) + height : groupTarget[1],
    performer.position.z,
  ];
}

function keyframe(
  atSeconds: number,
  position: [number, number, number],
  target: [number, number, number],
  fovDeg: number,
  interpolation: ResolvedDirectorCameraKeyframe["interpolation"] = "smooth",
  easing: ResolvedDirectorCameraKeyframe["easing"] = "ease-in-out",
  rollDeg?: number
): ResolvedDirectorCameraKeyframe {
  return {
    atSeconds,
    position,
    target,
    fovDeg,
    interpolation,
    easing,
    ...(rollDeg !== undefined ? { rollDeg } : {}),
  };
}

export function resolveDirectorCameraTrack(
  input: DirectorCameraInput | undefined,
  context: CameraTrackContext
): ResolvedDirectorCameraTrack {
  const usesGrammar = Boolean(
    input &&
      (input.shotSize ||
        input.angle ||
        input.position ||
        input.moves ||
        input.subject ||
        input.shots)
  );
  if (usesGrammar && input?.keyframes?.length) {
    throw new Error(
      "Raw keyframes and framing grammar are exclusive — use one."
    );
  }
  if (usesGrammar && input?.preset && input.preset !== "custom") {
    throw new Error("A preset and framing grammar are exclusive — use one.");
  }

  const { durationSeconds, aspectRatio, groundOffset, performers, sceneId } =
    context;
  // Handheld is a modifier on the sampled frame, not a framing, so it rides
  // along with whichever of the four camera spellings below resolves.
  const handheld = resolveHandheld(input?.handheld, context);
  const shake = handheld ? { handheld } : {};
  const baseShot = computeFramingShot({
    performers: performers.map((performer) => performer.position),
    plane: "wall",
    groundOffset,
    fovDeg: 50,
    aspectRatio,
    paddingMult: 1.18,
    elevationDeg: 12,
  });
  const groupTarget = vec3(baseShot.target);

  if (input?.keyframes?.length) {
    const resolved = input.keyframes
      .map((frame) => {
        // Defensive: convertSceneBeatTimes rewrites every atBeats into
        // atSeconds at the top of resolveScene, so resolution can never see an
        // unconverted frame. If it does, the converter was skipped.
        const atSeconds = frame.atSeconds;
        if (atSeconds === undefined) {
          throw new Error(
            `Scene "${sceneId}": camera keyframes must be converted to seconds before resolution — convertSceneBeatTimes was skipped.`
          );
        }
        return keyframe(
          atSeconds,
          [...frame.position],
          resolveTarget(
            frame.target ?? input.target,
            performers,
            groupTarget,
            groundOffset
          ),
          frame.fovDeg ?? 50,
          frame.interpolation ?? "smooth",
          frame.easing ?? "ease-in-out",
          frame.rollDeg
        );
      })
      .sort((left, right) => left.atSeconds - right.atSeconds);

    if (resolved[0]?.atSeconds !== 0) {
      throw new Error("The first camera keyframe must start at 0 seconds.");
    }
    if (resolved.at(-1)!.atSeconds > durationSeconds) {
      throw new Error("A camera keyframe falls after the scene has ended.");
    }
    for (let index = 1; index < resolved.length; index += 1) {
      if (resolved[index]!.atSeconds === resolved[index - 1]!.atSeconds) {
        throw new Error("Camera keyframes cannot share the same time.");
      }
    }
    return { preset: "custom", substitutedFor: null, keyframes: resolved, ...shake };
  }

  if (input?.shots) {
    // Tracking offsets the whole resolved track by one walker's displacement,
    // which cannot describe a walker followed in one shot and dropped in the
    // next. The schema rejects it too; this is the resolver's own guard.
    if (
      input.shots.some(
        (shot) => shot.subject?.kind === "performer" && shot.subject.track
      )
    ) {
      throw new Error(
        'Tracking and shots do not combine yet. Track a walker with a single framing, or cut between shots without "track".'
      );
    }
    return {
      preset: "custom",
      substitutedFor: null,
      keyframes: compileCameraShots(input.shots, context),
      ...shake,
    };
  }

  if (usesGrammar) {
    const framing = computeCameraFraming(
      {
        subject: input!.subject,
        shotSize: input!.shotSize,
        angle: input!.angle,
        position: input!.position,
      },
      context
    );
    const subject = input!.subject;
    const tracking =
      subject?.kind === "performer" && subject.track
        ? {
            performerId: subject.performerId,
            mode:
              subject.track === "follow" ? ("follow" as const) : ("aim" as const),
          }
        : undefined;
    return {
      preset: "custom",
      substitutedFor: null,
      keyframes: compileCameraMoves(
        input!.moves ?? [{ move: "hold" }],
        framing,
        context
      ),
      ...(tracking ? { tracking } : {}),
      ...shake,
    };
  }

  const { preset, substitutedFor } = resolvePresetForFormation(
    input?.preset,
    context.formation
  );
  // orbitDegrees is the one authored dial the library still honors: it says
  // how far around the cast to travel, which is a directing choice, not a
  // framing one.
  const definition =
    preset.motion.kind === "orbit" && input?.orbitDegrees !== undefined
      ? {
          ...preset,
          motion: { kind: "orbit" as const, degrees: input.orbitDegrees },
        }
      : preset;

  const cast = measureCastGeometry(
    performers.map((performer) => performer.position),
    groundOffset
  );
  const explicitTarget = input?.target
    ? resolveTarget(input.target, performers, groupTarget, groundOffset)
    : undefined;

  return {
    preset: preset.id,
    substitutedFor,
    keyframes: fitPresetKeyframes(
      definition,
      cast,
      { aspectRatio, durationSeconds },
      explicitTarget
    ).map((frame) =>
      keyframe(
        frame.atSeconds,
        frame.position,
        frame.target,
        frame.fovDeg,
        definition.motion.kind === "hold" ? "step" : "smooth",
        definition.motion.kind === "orbit" ? "linear" : "ease-in-out"
      )
    ),
    ...shake,
  };
}

/**
 * Channel stores are derived from a keyframe list, so they are cached against
 * that list's identity. Resolution produces each track once per film load and
 * the viewer then samples it every frame; rebuilding eight channels per frame
 * would be a real cost for no gain.
 */
const CHANNEL_STORES = new WeakMap<object, CameraChannelStore>();

/** The channel store behind a resolved track, built on first use. */
export function cameraChannelsFor(
  keyframes: readonly ResolvedDirectorCameraKeyframe[]
): CameraChannelStore {
  const key = keyframes as unknown as object;
  const cached = CHANNEL_STORES.get(key);
  if (cached) return cached;
  const store = buildCameraChannels(keyframes);
  CHANNEL_STORES.set(key, store);
  return store;
}

/**
 * Sample a resolved camera track.
 *
 * The curve itself lives in `director-camera-channels.ts`, one channel per
 * scalar. This function is the adapter that the viewer and the exporters have
 * always called: hand it fused keyframes, get one frame back.
 */
export function sampleDirectorCameraTrack(
  keyframes: readonly ResolvedDirectorCameraKeyframe[],
  atSeconds: number
): DirectorCameraFrame {
  return sampleCameraFrame(cameraChannelsFor(keyframes), atSeconds);
}
