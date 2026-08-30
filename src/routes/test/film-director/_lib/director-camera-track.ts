import { computeFramingShot } from "$lib/shared/3d/camera/compute-framing-shot";

import { applyDirectorEasing } from "./director-easing";
import {
  compileCameraMoves,
  computeCameraFraming,
  directorFloorY,
} from "./camera-language";
import {
  fitPresetKeyframes,
  measureCastGeometry,
} from "./director-camera-fit";
import {
  resolvePresetForFormation,
  type DirectorFormation,
} from "./director-camera-presets";
import type {
  DirectorCameraInput,
  DirectorCameraPreset,
  DirectorCameraTargetInput,
  DirectorEasing,
  ResolvedDirectorCameraKeyframe,
  ResolvedDirectorPerformer,
} from "./film-director-schema";

export interface DirectorCameraFrame {
  position: [number, number, number];
  target: [number, number, number];
  fovDeg: number;
}

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
}

export interface ResolvedDirectorCameraTrack {
  preset: DirectorCameraPreset;
  substitutedFor: DirectorCameraPreset | null;
  keyframes: ResolvedDirectorCameraKeyframe[];
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
  return [
    performer.position.x,
    input.height !== undefined
      ? directorFloorY(groundOffset) + input.height
      : groupTarget[1],
    performer.position.z,
  ];
}

function keyframe(
  atSeconds: number,
  position: [number, number, number],
  target: [number, number, number],
  fovDeg: number,
  interpolation: ResolvedDirectorCameraKeyframe["interpolation"] = "smooth",
  easing: ResolvedDirectorCameraKeyframe["easing"] = "ease-in-out"
): ResolvedDirectorCameraKeyframe {
  return { atSeconds, position, target, fovDeg, interpolation, easing };
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
        input.subject)
  );
  if (usesGrammar && input?.keyframes?.length) {
    throw new Error(
      "Raw keyframes and framing grammar are exclusive — use one."
    );
  }
  if (usesGrammar && input?.preset && input.preset !== "custom") {
    throw new Error("A preset and framing grammar are exclusive — use one.");
  }

  const { durationSeconds, aspectRatio, groundOffset, performers } = context;
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
            "Camera keyframes must be converted to seconds before resolution — convertSceneBeatTimes was skipped."
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
          frame.easing ?? "ease-in-out"
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
    return { preset: "custom", substitutedFor: null, keyframes: resolved };
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
    return {
      preset: "custom",
      substitutedFor: null,
      keyframes: compileCameraMoves(
        input!.moves ?? [{ move: "hold" }],
        framing,
        context
      ),
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
  };
}

function interpolateScalar(
  before: number,
  start: number,
  end: number,
  after: number,
  progress: number,
  smooth: boolean
): number {
  if (!smooth) return start + (end - start) * progress;
  const p2 = progress * progress;
  const p3 = p2 * progress;
  return (
    0.5 *
    (2 * start +
      (-before + end) * progress +
      (2 * before - 5 * start + 4 * end - after) * p2 +
      (-before + 3 * start - 3 * end + after) * p3)
  );
}

function interpolateVector(
  before: [number, number, number],
  start: [number, number, number],
  end: [number, number, number],
  after: [number, number, number],
  progress: number,
  smooth: boolean
): [number, number, number] {
  return [0, 1, 2].map((axis) =>
    interpolateScalar(
      before[axis]!,
      start[axis]!,
      end[axis]!,
      after[axis]!,
      progress,
      smooth
    )
  ) as [number, number, number];
}

export function sampleDirectorCameraTrack(
  keyframes: readonly ResolvedDirectorCameraKeyframe[],
  atSeconds: number
): DirectorCameraFrame {
  const first = keyframes[0];
  if (!first) {
    return { position: [0, 1, -4], target: [0, 0, 0], fovDeg: 50 };
  }
  if (keyframes.length === 1 || atSeconds <= first.atSeconds) {
    return {
      position: [...first.position],
      target: [...first.target],
      fovDeg: first.fovDeg,
    };
  }

  const last = keyframes.at(-1)!;
  if (atSeconds >= last.atSeconds) {
    return {
      position: [...last.position],
      target: [...last.target],
      fovDeg: last.fovDeg,
    };
  }

  const endIndex = keyframes.findIndex((frame) => frame.atSeconds > atSeconds);
  const startIndex = Math.max(0, endIndex - 1);
  const start = keyframes[startIndex]!;
  const end = keyframes[endIndex]!;
  if (start.interpolation === "step") {
    return {
      position: [...start.position],
      target: [...start.target],
      fovDeg: start.fovDeg,
    };
  }

  const duration = Math.max(0.0001, end.atSeconds - start.atSeconds);
  const linearProgress = Math.max(
    0,
    Math.min(1, (atSeconds - start.atSeconds) / duration)
  );
  const progress = applyDirectorEasing(linearProgress, start.easing);
  const before = keyframes[Math.max(0, startIndex - 1)] ?? start;
  const after = keyframes[Math.min(keyframes.length - 1, endIndex + 1)] ?? end;
  const smooth = start.interpolation === "smooth";

  return {
    position: interpolateVector(
      before.position,
      start.position,
      end.position,
      after.position,
      progress,
      smooth
    ),
    target: interpolateVector(
      before.target,
      start.target,
      end.target,
      after.target,
      progress,
      smooth
    ),
    fovDeg: interpolateScalar(
      before.fovDeg,
      start.fovDeg,
      end.fovDeg,
      after.fovDeg,
      progress,
      smooth
    ),
  };
}
