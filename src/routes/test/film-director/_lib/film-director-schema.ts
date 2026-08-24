import { z } from "zod";
import type { AvatarId, FormationPreset } from "@austencloud/scene-3d";

import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
import type { EffectType } from "$lib/shared/effects/domain/effects-config";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import {
  isSceneEnvironmentId,
  type SceneEnvironmentId,
} from "$lib/shared/3d/environments/domain/scene-environment";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { directiveSchema } from "./directives";

export const FILM_DIRECTOR_SCHEMA_VERSION = 1 as const;
export const FILM_DIRECTOR_SCHEMA_VERSION_2 = 2 as const;

export const FILM_DIRECTOR_DIRECTIVE_AXES = [
  "avatarId",
  "prop",
  "effect",
  "effort",
  "staffLengthCm",
  "environmentId",
  "formation",
] as const;

const seedSchema = z
  .object({
    base: z.number().int().optional(),
    axes: z.record(z.string(), z.number().int()).optional(),
  })
  .strict();

export const DIRECTOR_EFFORT_IDS = [
  "linear",
  "glide",
  "dab",
  "press",
  "punch",
  "elastic",
  "bounce",
  "anticipation",
] as const satisfies readonly EffortId[];

export const DIRECTOR_FORMATIONS = [
  "solo",
  "grid-2x2",
  "line",
  "circle",
  "v-shape",
  "diagonal",
  "tunnel-stack",
  "back-to-back",
  "facing-each-other",
  "stage-lr",
  "side-by-side",
  "custom",
] as const satisfies readonly FormationPreset[];

export const DIRECTOR_CAMERA_PRESETS = [
  "front-lockoff",
  "hero-dolly-in",
  "high-reveal",
  "group-orbit",
  "custom",
] as const;

export const DIRECTOR_INTERPOLATIONS = ["step", "linear", "smooth"] as const;
export const DIRECTOR_EASINGS = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
] as const;

const finiteNumber = z.number().finite();
const vector3Schema = z.tuple([finiteNumber, finiteNumber, finiteNumber]);
const position2Schema = z.object({ x: finiteNumber, z: finiteNumber }).strict();

const environmentIdSchema = z
  .string()
  .refine(isSceneEnvironmentId, "Unknown 3D environment");
const avatarIdSchema = z.string().min(1);
const effectIdSchema = z
  .string()
  .refine(
    (value) =>
      value === "none" || EFFECTS.some((effect) => effect.id === value),
    "Unknown effect"
  );
const configurableEffectIdSchema = z
  .string()
  .refine(
    (value) => EFFECTS.some((effect) => effect.id === value),
    "Unknown configurable effect"
  );

const cameraTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("group") }).strict(),
  z
    .object({
      kind: z.literal("performer"),
      performerId: z.string().min(1),
      height: finiteNumber.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("point"), position: vector3Schema }).strict(),
]);

const cameraKeyframeSchema = z
  .object({
    atSeconds: finiteNumber.nonnegative(),
    position: vector3Schema,
    target: cameraTargetSchema.optional(),
    fovDeg: finiteNumber.min(20).max(100).optional(),
    interpolation: z.enum(DIRECTOR_INTERPOLATIONS).optional(),
    easing: z.enum(DIRECTOR_EASINGS).optional(),
  })
  .strict();

const performerSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    avatarId: directiveSchema(avatarIdSchema).optional(),
    prop: directiveSchema(z.nativeEnum(PropType)).optional(),
    effect: directiveSchema(effectIdSchema).optional(),
    effort: directiveSchema(z.enum(DIRECTOR_EFFORT_IDS)).optional(),
    position: position2Schema.optional(),
    facingDegrees: finiteNumber.optional(),
    beatOffset: finiteNumber.optional(),
    staffLengthCm: directiveSchema(finiteNumber.min(40).max(300)).optional(),
  })
  .strict();

const castDefaultsSchema = z
  .object({
    avatarId: directiveSchema(avatarIdSchema).optional(),
    prop: directiveSchema(z.nativeEnum(PropType)).optional(),
    effect: directiveSchema(effectIdSchema).optional(),
    effort: directiveSchema(z.enum(DIRECTOR_EFFORT_IDS)).optional(),
    staffLengthCm: directiveSchema(finiteNumber.min(40).max(300)).optional(),
  })
  .strict();

const castSchema = z
  .object({
    count: z.number().int().min(1).max(8),
    defaults: castDefaultsSchema.optional(),
    performers: z.array(performerSchema).max(8).optional(),
  })
  .strict();

const performanceSchema = z
  .object({
    bpm: finiteNumber.min(20).max(300).optional(),
    sequence: z
      .object({ source: z.literal("demo"), loop: z.boolean().optional() })
      .strict()
      .optional(),
    formation: directiveSchema(z.enum(DIRECTOR_FORMATIONS)).optional(),
    cast: castSchema.optional(),
    performers: z.array(performerSchema).min(1).max(8).optional(),
  })
  .strict()
  .refine((value) => !(value.cast && value.performers), {
    message: "Use either a cast block or a performers array, not both.",
    path: ["cast"],
  });

const sceneSchema = z
  .object({
    environmentId: directiveSchema(environmentIdSchema).optional(),
    showStage: z.boolean().optional(),
    showAudience: z.boolean().optional(),
    sceneFeatures: z.record(z.string(), z.boolean()).optional(),
  })
  .strict();

const cameraSchema = z
  .object({
    preset: z.enum(DIRECTOR_CAMERA_PRESETS).optional(),
    target: cameraTargetSchema.optional(),
    orbitDegrees: finiteNumber.min(-720).max(720).optional(),
    keyframes: z.array(cameraKeyframeSchema).min(1).max(32).optional(),
    subject: cameraTargetSchema.optional(),
    shotSize: z.enum(["close-up", "medium", "wide", "extreme-wide"]).optional(),
    angle: z.enum(["low", "eye", "high", "top"]).optional(),
    position: z
      .union([
        z.enum(["front", "left", "right", "behind"]),
        z.object({ degrees: finiteNumber.min(-360).max(360) }).strict(),
      ])
      .optional(),
    moves: z
      .array(
        z
          .object({
            move: z.enum(["hold", "push-in", "pull-back", "orbit", "crane", "pan"]),
            direction: z.enum(["cw", "ccw", "up", "down", "left", "right"]).optional(),
            amount: z
              .union([
                z.object({ degrees: finiteNumber }).strict(),
                z.object({ meters: finiteNumber.positive() }).strict(),
              ])
              .optional(),
            durationSeconds: finiteNumber.positive().optional(),
            easing: z.enum(DIRECTOR_EASINGS).optional(),
          })
          .strict()
      )
      .min(1)
      .max(16)
      .optional(),
  })
  .strict()
  .refine(
    (camera) => camera.preset !== "custom" || Boolean(camera.keyframes?.length),
    {
      message: "A custom camera needs at least one keyframe",
      path: ["keyframes"],
    }
  )
  .refine(
    (camera) =>
      !camera.keyframes ||
      !(camera.shotSize || camera.angle || camera.position || camera.moves || camera.subject),
    { message: "Raw keyframes and framing grammar are exclusive — use one.", path: ["keyframes"] }
  )
  .refine(
    (camera) =>
      !camera.preset ||
      camera.preset === "custom" ||
      !(camera.shotSize || camera.angle || camera.position || camera.moves),
    { message: "A preset and framing grammar are exclusive — use one.", path: ["preset"] }
  )
  .refine((camera) => !(camera.subject && camera.target), {
    message: 'Use "subject" with framing grammar, "target" with presets/keyframes.',
    path: ["subject"],
  });

const transitionSchema = z
  .object({
    kind: z.enum(["cut", "environment-dissolve", "fade-through-black"]),
    durationSeconds: finiteNumber.min(0).max(3).optional(),
  })
  .strict();

const shotSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    intent: z.string().min(1).optional(),
    durationSeconds: finiteNumber.min(1).max(60).optional(),
    transition: transitionSchema.optional(),
    scene: sceneSchema.optional(),
    performance: performanceSchema.optional(),
    effectPresets: z
      .record(
        z.string(),
        z.union([z.string().min(1), z.object({ pick: z.literal("any") }).strict()])
      )
      .optional(),
    effectOverrides: z
      .record(configurableEffectIdSchema, z.record(z.string(), z.unknown()))
      .optional(),
    camera: cameraSchema.optional(),
  })
  .strict();

export const FilmDirectorInputSchema = z
  .object({
    version: z.union([
      z.literal(FILM_DIRECTOR_SCHEMA_VERSION),
      z.literal(FILM_DIRECTOR_SCHEMA_VERSION_2),
    ]),
    id: z.string().min(1),
    title: z.string().min(1),
    brief: z.string().min(1).optional(),
    seed: seedSchema.optional(),
    format: z
      .object({
        width: z.number().int().min(640).max(7680).optional(),
        height: z.number().int().min(360).max(4320).optional(),
        fps: z.number().int().min(24).max(120).optional(),
      })
      .strict()
      .optional(),
    playback: z
      .object({
        loop: z.boolean().optional(),
        autoplay: z.boolean().optional(),
      })
      .strict()
      .optional(),
    shots: z.array(shotSchema).min(1).max(24),
  })
  .strict();

export type FilmDirectorInput = z.input<typeof FilmDirectorInputSchema>;
export type DirectorShotInput = z.infer<typeof shotSchema>;
export type DirectorCastInput = z.infer<typeof castSchema>;
export type DirectorCameraInput = z.infer<typeof cameraSchema>;
export type DirectorCameraTargetInput = z.infer<typeof cameraTargetSchema>;
export type DirectorCameraPreset = (typeof DIRECTOR_CAMERA_PRESETS)[number];
export type DirectorInterpolation = (typeof DIRECTOR_INTERPOLATIONS)[number];
export type DirectorEasing = (typeof DIRECTOR_EASINGS)[number];

export interface ResolvedDirectorPerformer {
  id: string;
  name: string;
  avatarId: AvatarId;
  prop: PropType;
  effect: EffectType;
  effort: EffortId;
  position: { x: number; z: number };
  facingAngle: number;
  beatOffset: number;
  staffLengthCm: number | null;
}

export interface ResolvedDirectorCameraKeyframe {
  atSeconds: number;
  position: [number, number, number];
  target: [number, number, number];
  fovDeg: number;
  interpolation: DirectorInterpolation;
  easing: DirectorEasing;
}

export interface ResolvedDirectorShot {
  id: string;
  title: string;
  intent: string | null;
  startSeconds: number;
  durationSeconds: number;
  transition: {
    kind: "cut" | "environment-dissolve" | "fade-through-black";
    durationSeconds: number;
  };
  scene: {
    environmentId: SceneEnvironmentId;
    showStage: boolean;
    showAudience: boolean;
    sceneFeatures: Record<string, boolean>;
  };
  performance: {
    bpm: number;
    sequence: { source: "demo"; loop: boolean };
    formation: FormationPreset;
    performers: ResolvedDirectorPerformer[];
  };
  effectPresets: Record<string, string>;
  effectOverrides: Record<string, Record<string, unknown>>;
  camera: {
    preset: DirectorCameraPreset;
    keyframes: ResolvedDirectorCameraKeyframe[];
  };
}

export interface ResolvedFilmDirectorSpec {
  version: typeof FILM_DIRECTOR_SCHEMA_VERSION;
  id: string;
  title: string;
  brief: string | null;
  format: { width: number; height: number; fps: number };
  playback: { loop: boolean; autoplay: boolean };
  shots: ResolvedDirectorShot[];
  durationSeconds: number;
}
