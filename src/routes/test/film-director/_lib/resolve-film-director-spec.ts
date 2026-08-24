import {
  AVATAR_DEFINITIONS,
  PRESET_VALID_COUNTS,
  calculateFacingAngle,
  createFormationFromPreset,
  type AvatarId,
  type FormationPreset,
} from "@austencloud/scene-3d";

import { getRegistration } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
import { getStageCoordinateFrame } from "$lib/shared/3d/environments/domain/stage-coordinate-frame";
import { getPerformerStageBounds } from "$lib/shared/3d/environments/domain/performer-stage-bounds";
import {
  getSceneEnvironmentRendererKey,
  type SceneEnvironmentId,
} from "$lib/shared/3d/environments/domain/scene-environment";
import type { EffectType } from "$lib/shared/effects/domain/effects-config";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

import { resolveDirectorCameraTrack } from "./director-camera-track";
import {
  FilmDirectorInputSchema,
  type DirectorShotInput,
  type FilmDirectorInput,
  type ResolvedDirectorPerformer,
  type ResolvedDirectorShot,
  type ResolvedFilmDirectorSpec,
} from "./film-director-schema";

const DEFAULT_AVATARS = AVATAR_DEFINITIONS.map(
  (avatar) => avatar.id
) as AvatarId[];

function contextualEnvironment(shot: DirectorShotInput): SceneEnvironmentId {
  const effects =
    shot.performance?.performers?.map((performer) => performer.effect) ?? [];
  if (effects.includes("bubbles")) return "ocean";
  if (effects.includes("fire")) return "autumn";
  if (effects.some((effect) => effect === "led" || effect === "zap"))
    return "cosmic";
  return "forest";
}

function defaultFormation(count: number): FormationPreset {
  if (count === 1) return "solo";
  if (count <= 4) return "grid-2x2";
  return "circle";
}

function resolvePerformers(
  shot: DirectorShotInput,
  formationPreset: FormationPreset
): ResolvedDirectorPerformer[] {
  const inputs = shot.performance?.performers?.length
    ? shot.performance.performers
    : [{}];
  const validCounts = PRESET_VALID_COUNTS[formationPreset];
  if (!validCounts.includes(inputs.length)) {
    throw new Error(
      `Formation "${formationPreset}" does not support ${inputs.length} performers.`
    );
  }
  if (
    formationPreset === "custom" &&
    inputs.some((performer) => performer.position === undefined)
  ) {
    throw new Error("Every performer in a custom formation needs a position.");
  }

  const formation = createFormationFromPreset(formationPreset, inputs.length);
  const seenIds = new Set<string>();

  return inputs.map((input, index) => {
    const id = input.id ?? `performer-${index + 1}`;
    if (seenIds.has(id)) throw new Error(`Performer id "${id}" is duplicated.`);
    seenIds.add(id);

    const avatarId =
      input.avatarId ?? DEFAULT_AVATARS[index % DEFAULT_AVATARS.length]!;
    if (!AVATAR_DEFINITIONS.some((avatar) => avatar.id === avatarId)) {
      throw new Error(
        `Avatar "${avatarId}" is not in the deployed 3D catalog.`
      );
    }

    const slot = formation.slots.find((candidate) => candidate.index === index);
    if (!slot && !input.position) {
      throw new Error(
        `Formation "${formationPreset}" has no slot for performer ${index + 1}.`
      );
    }
    const position = input.position ?? slot!.position;
    const facingAngle =
      input.facingDegrees !== undefined
        ? (input.facingDegrees * Math.PI) / 180
        : slot
          ? calculateFacingAngle(slot, formation)
          : 0;

    return {
      id,
      name: input.name ?? `Performer ${index + 1}`,
      avatarId: avatarId as AvatarId,
      prop: input.prop ?? PropType.STAFF,
      effect: (input.effect ?? "none") as EffectType,
      effort: (input.effort ?? "linear") as EffortId,
      position: { ...position },
      facingAngle,
      beatOffset: input.beatOffset ?? 0,
      staffLengthCm: input.staffLengthCm ?? null,
    };
  });
}

function validateEffectPresets(effectPresets: Record<string, string>): void {
  for (const [effectId, presetId] of Object.entries(effectPresets)) {
    const registration = getRegistration(effectId);
    if (!registration) {
      throw new Error(`Effect preset references unknown effect "${effectId}".`);
    }
    if (
      !registration.presetGroup.presets.some((preset) => preset.id === presetId)
    ) {
      throw new Error(
        `Effect "${effectId}" has no preset named "${presetId}".`
      );
    }
  }
}

function validateEffectOverrides(
  effectOverrides: Record<string, Record<string, unknown>>
): void {
  for (const effectId of Object.keys(effectOverrides)) {
    if (!getRegistration(effectId)) {
      throw new Error(
        `Effect overrides reference unknown effect "${effectId}".`
      );
    }
  }
}

function resolveShot(
  shot: DirectorShotInput,
  shotIndex: number,
  startSeconds: number,
  aspectRatio: number
): ResolvedDirectorShot {
  const durationSeconds = shot.durationSeconds ?? 8;
  const performerCount = shot.performance?.performers?.length ?? 1;
  const formation =
    shot.performance?.formation ?? defaultFormation(performerCount);
  const performers = resolvePerformers(shot, formation);
  const environmentId =
    shot.scene?.environmentId ?? contextualEnvironment(shot);
  const showStage = shot.scene?.showStage ?? false;
  const showAudience = shot.scene?.showAudience ?? false;
  const sceneFeatures = {
    environment: true,
    stage: showStage,
    audience: showAudience,
    campfire: false,
    tent: false,
    ...(shot.scene?.sceneFeatures ?? {}),
  };
  const effectPresets = { ...(shot.effectPresets ?? {}) };
  const effectOverrides = { ...(shot.effectOverrides ?? {}) };
  validateEffectPresets(effectPresets);
  validateEffectOverrides(effectOverrides);

  const rendererKey = getSceneEnvironmentRendererKey(environmentId);
  const groundOffset = getStageCoordinateFrame(
    rendererKey,
    showStage
  ).performerAnchorY;
  const stageZOffset = getPerformerStageBounds(
    performers.map((performer) => performer.position)
  ).zOffset;
  const cameraKeyframes = resolveDirectorCameraTrack(shot.camera, {
    durationSeconds,
    aspectRatio,
    groundOffset,
    performers: performers.map((performer) => ({
      ...performer,
      position: {
        ...performer.position,
        z: performer.position.z + stageZOffset,
      },
    })),
  });

  return {
    id: shot.id,
    title: shot.title,
    intent: shot.intent ?? null,
    startSeconds,
    durationSeconds,
    transition: {
      kind:
        shot.transition?.kind ??
        (shotIndex === 0 ? "cut" : "environment-dissolve"),
      durationSeconds:
        shot.transition?.durationSeconds ?? (shotIndex === 0 ? 0 : 0.8),
    },
    scene: { environmentId, showStage, showAudience, sceneFeatures },
    performance: {
      bpm: shot.performance?.bpm ?? 90,
      sequence: {
        source: "demo",
        loop: shot.performance?.sequence?.loop ?? true,
      },
      formation,
      performers,
    },
    effectPresets,
    effectOverrides,
    camera: {
      preset:
        shot.camera?.preset ??
        (performers.length >= 5 ? "group-orbit" : "hero-dolly-in"),
      keyframes: cameraKeyframes,
    },
  };
}

export function resolveFilmDirectorSpec(
  untrustedInput: FilmDirectorInput | unknown
): ResolvedFilmDirectorSpec {
  const input = FilmDirectorInputSchema.parse(untrustedInput);
  const format = {
    width: input.format?.width ?? 1920,
    height: input.format?.height ?? 1080,
    fps: input.format?.fps ?? 30,
  };
  const aspectRatio = format.width / format.height;
  const seenShotIds = new Set<string>();
  let cursorSeconds = 0;

  const shots = input.shots.map((shot, index) => {
    if (seenShotIds.has(shot.id))
      throw new Error(`Shot id "${shot.id}" is duplicated.`);
    seenShotIds.add(shot.id);
    const resolved = resolveShot(shot, index, cursorSeconds, aspectRatio);
    cursorSeconds += resolved.durationSeconds;
    return resolved;
  });

  return {
    version: input.version,
    id: input.id,
    title: input.title,
    brief: input.brief ?? null,
    format,
    playback: {
      loop: input.playback?.loop ?? true,
      autoplay: input.playback?.autoplay ?? true,
    },
    shots,
    durationSeconds: cursorSeconds,
  };
}
