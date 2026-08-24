import { computeFramingShot } from "$lib/shared/3d/camera/compute-framing-shot";

import type {
  DirectorCameraInput,
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
  groupTarget: [number, number, number]
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
    input.height ?? groupTarget[1],
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

function scaleFromTarget(
  position: [number, number, number],
  target: [number, number, number],
  scale: number
): [number, number, number] {
  return [
    target[0] + (position[0] - target[0]) * scale,
    target[1] + (position[1] - target[1]) * scale,
    target[2] + (position[2] - target[2]) * scale,
  ];
}

export function resolveDirectorCameraTrack(
  input: DirectorCameraInput | undefined,
  context: CameraTrackContext
): ResolvedDirectorCameraKeyframe[] {
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
  const target = resolveTarget(input?.target, performers, groupTarget);

  if (input?.keyframes?.length) {
    const resolved = input.keyframes
      .map((frame) =>
        keyframe(
          frame.atSeconds,
          [...frame.position],
          resolveTarget(frame.target ?? input.target, performers, groupTarget),
          frame.fovDeg ?? 50,
          frame.interpolation ?? "smooth",
          frame.easing ?? "ease-in-out"
        )
      )
      .sort((left, right) => left.atSeconds - right.atSeconds);

    if (resolved[0]?.atSeconds !== 0) {
      throw new Error("The first camera keyframe must start at 0 seconds.");
    }
    if (resolved.at(-1)!.atSeconds > durationSeconds) {
      throw new Error("A camera keyframe falls after the shot has ended.");
    }
    for (let index = 1; index < resolved.length; index += 1) {
      if (resolved[index]!.atSeconds === resolved[index - 1]!.atSeconds) {
        throw new Error("Camera keyframes cannot share the same time.");
      }
    }
    return resolved;
  }

  const baseEye = vec3(baseShot.eye);
  const preset =
    input?.preset ?? (performers.length >= 5 ? "group-orbit" : "hero-dolly-in");

  if (preset === "front-lockoff") {
    return [keyframe(0, baseEye, target, 50, "step", "linear")];
  }

  if (preset === "hero-dolly-in") {
    return [
      keyframe(0, scaleFromTarget(baseEye, target, 1.55), target, 52),
      keyframe(
        durationSeconds,
        scaleFromTarget(baseEye, target, 1.08),
        target,
        44
      ),
    ];
  }

  if (preset === "high-reveal") {
    const distance = Math.hypot(
      baseEye[0] - target[0],
      baseEye[1] - target[1],
      baseEye[2] - target[2]
    );
    return [
      keyframe(
        0,
        [
          target[0] - distance * 0.35,
          target[1] + distance * 0.92,
          target[2] - distance * 1.25,
        ],
        target,
        58
      ),
      keyframe(
        durationSeconds,
        scaleFromTarget(baseEye, target, 1.12),
        target,
        48
      ),
    ];
  }

  const orbitDegrees = input?.orbitDegrees ?? 135;
  const radius =
    Math.max(2, Math.hypot(baseEye[0] - target[0], baseEye[2] - target[2])) *
    1.35;
  const cameraHeight = baseEye[1];
  const startAngle = Math.atan2(baseEye[0] - target[0], baseEye[2] - target[2]);
  const segmentCount = Math.max(3, Math.ceil(Math.abs(orbitDegrees) / 30));

  return Array.from({ length: segmentCount + 1 }, (_, index) => {
    const progress = index / segmentCount;
    const angle = startAngle + (orbitDegrees * Math.PI * progress) / 180;
    return keyframe(
      durationSeconds * progress,
      [
        target[0] + Math.sin(angle) * radius,
        cameraHeight,
        target[2] + Math.cos(angle) * radius,
      ],
      target,
      50,
      "smooth",
      "linear"
    );
  });
}

function applyEasing(value: number, easing: DirectorEasing): number {
  switch (easing) {
    case "linear":
      return value;
    case "ease-in":
      return value * value;
    case "ease-out":
      return 1 - (1 - value) * (1 - value);
    case "ease-in-out":
      return value < 0.5
        ? 2 * value * value
        : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }
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
  const progress = applyEasing(linearProgress, start.easing);
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
