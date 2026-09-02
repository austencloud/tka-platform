import { z } from "zod";
import { Plane, type FormationPreset } from "@austencloud/scene-3d";
import type { CharacterId } from "$lib/shared/3d/domain/character-model";

import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
import type { EffectType } from "$lib/shared/effects/domain/effects-config";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import {
  isSceneEnvironmentId,
  type SceneEnvironmentId,
} from "$lib/shared/3d/environments/domain/scene-environment";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { directiveSchema } from "./directives";
import { normalizeFilmDirectorInput } from "./normalize-film-director-input";
import type { ResolvedDirectorBlockingKeyframe } from "./blocking-language";
import {
  DIRECTOR_CONTINUITIES,
  DIRECTOR_LOOP_PERIODS,
  DIRECTOR_MOTION_TYPE_FILTERS,
  DIRECTOR_ORIENTATIONS,
  DIRECTOR_POSITION_GROUPS,
  DIRECTOR_ROTATION_DEGREES,
  DIRECTOR_SEQUENCE_LEVELS,
  type DirectorPerformerSequence,
} from "./sequence-language";

export const FILM_DIRECTOR_SCHEMA_VERSION_1 = 1 as const;
export const FILM_DIRECTOR_SCHEMA_VERSION_2 = 2 as const;
export const FILM_DIRECTOR_SCHEMA_VERSION_3 = 3 as const;
export const FILM_DIRECTOR_SCHEMA_VERSION_4 = 4 as const;
export const FILM_DIRECTOR_SCHEMA_VERSION_5 = 5 as const;
export const FILM_DIRECTOR_SCHEMA_VERSION = FILM_DIRECTOR_SCHEMA_VERSION_5;

export const FILM_DIRECTOR_DIRECTIVE_AXES = [
  "characterId",
  "prop",
  "effect",
  "effort",
  "staffLengthCm",
  "environmentId",
  "formation",
  "leftPlane",
  "rightPlane",
  "stepPlane",
] as const;

const seedSchema = z
  .object({
    base: z.number().int().optional(),
    axes: z.record(z.string(), z.number().int()).optional(),
  })
  .strict();

function normalizeLegacyHandPair(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const input = value as Record<string, unknown>;
  const normalized = { ...input };
  for (const [legacy, canonical] of [
    ["blue", "left"],
    ["red", "right"],
  ] as const) {
    if (legacy in normalized && canonical in normalized) return value;
    if (legacy in normalized) {
      normalized[canonical] = normalized[legacy];
      delete normalized[legacy];
    }
  }
  return normalized;
}

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

// Named so an unknown literal names the offending value in its rejection
// message. Built as string+refine, not z.enum/z.nativeEnum: these schemas
// are always used inside directiveSchema()'s union (literal | pick | oneOf |
// not | sameAs). An enum's invalid_value check fails at the same shallow
// "wrong shape" tier as the object-shaped branches, so zod's union can't
// tell which branch the director meant and falls back to the generic
// "Expected a literal value or a directive object" message — hiding the
// offending value entirely. A string schema passes trivially, so the
// refine's failure is the one branch that went deeper, and zod surfaces
// that refine's own message directly. Matches effectIdSchema/
// environmentIdSchema below, which already use this shape for the same
// reason.
const effortIdSchema = z
  .string()
  .refine(
    (value): value is (typeof DIRECTOR_EFFORT_IDS)[number] =>
      (DIRECTOR_EFFORT_IDS as readonly string[]).includes(value),
    { error: (issue) => `Unknown effort "${String(issue.input)}"` }
  );
const formationIdSchema = z
  .string()
  .refine(
    (value): value is (typeof DIRECTOR_FORMATIONS)[number] =>
      (DIRECTOR_FORMATIONS as readonly string[]).includes(value),
    { error: (issue) => `Unknown formation "${String(issue.input)}"` }
  );

export const DIRECTOR_CAMERA_PRESETS = [
  "front-lockoff",
  "three-quarter",
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

/**
 * Every duration in this schema has a `durationBeats` twin, because a director
 * counts music rather than reading a stopwatch. Stating both units on one
 * field is a contradiction, not a preference — the converter would have to
 * pick a winner, and either choice silently discards what the director wrote.
 *
 * Two-layer validity contract for every `durationBeats`/`atBeats` field: this
 * schema only bounds beats SYNTACTICALLY (e.g. scene durationBeats is
 * positive and capped at 240, transition durationBeats at 32) — those caps
 * are generous enough to admit values that convert to an out-of-range
 * seconds figure at a slow bpm. The REAL bound (converted seconds within the
 * scene's 1-60s window, the transition's 0-3s window) is enforced at resolve
 * time by `convertSceneBeatTimes` (director-beat-times.ts), once the scene's
 * bpm is known. `schema.parse` succeeding is therefore necessary but not
 * sufficient for a beats-stated field to be valid — resolution can still
 * reject it.
 *
 * Named `atMostOneTimeUnit` (not `exactlyOne`) because both fields are
 * optional-with-a-computed-default: stating neither is fine (something else
 * supplies the duration), only stating BOTH is the contradiction. This is the
 * opposite of `cameraKeyframeSchema`'s inline `atSeconds`/`atBeats` check
 * further below, which requires EXACTLY one — a keyframe has no default
 * clock, so stating neither is just as invalid as stating both.
 */
const atMostOneTimeUnit = (
  value: { durationSeconds?: number; durationBeats?: number },
  ctx: z.RefinementCtx
) => {
  if (
    value.durationSeconds !== undefined &&
    value.durationBeats !== undefined
  ) {
    ctx.addIssue({
      code: "custom",
      message: 'State exactly one of "durationSeconds" or "durationBeats".',
    });
  }
};

const vector3Schema = z.tuple([finiteNumber, finiteNumber, finiteNumber]);
const position2Schema = z.object({ x: finiteNumber, z: finiteNumber }).strict();

const environmentIdSchema = z.string().refine(isSceneEnvironmentId, {
  error: (issue) => `Unknown 3D environment "${String(issue.input)}"`,
});
const characterIdSchema = z.string().min(1);
const PROP_TYPE_VALUES = new Set<string>(Object.values(PropType));
// string+refine, not z.nativeEnum — see the comment above effortIdSchema for
// why: it lets the refine's own message surface through directiveSchema()'s
// union instead of the generic "expected literal or directive object" text.
const propTypeSchema = z
  .string()
  .refine((value): value is PropType => PROP_TYPE_VALUES.has(value), {
    error: (issue) => `Unknown prop "${String(issue.input)}"`,
  });
const effectIdSchema = z
  .string()
  .refine(
    (value) =>
      value === "none" || EFFECTS.some((effect) => effect.id === value),
    { error: (issue) => `Unknown effect "${String(issue.input)}"` }
  );
const configurableEffectIdSchema = z
  .string()
  .refine((value) => EFFECTS.some((effect) => effect.id === value), {
    error: (issue) => `Unknown configurable effect "${String(issue.input)}"`,
  });

// Derived from the live enum, never retyped — see the comment above
// effortIdSchema for why this is string+refine (with a type-predicate to
// still narrow the inferred type to Plane) rather than z.enum/z.nativeEnum.
// Unlike the other axis catalogs, an unknown plane also lists the full
// catalog in its message: there is no "closest" plane the way there's an
// obvious closest prop, so directors are more likely to need the full list.
const PLANE_VALUES = Object.values(Plane) as Plane[];
const planeSchema = z
  .string()
  .refine(
    (value): value is Plane =>
      (PLANE_VALUES as readonly string[]).includes(value),
    {
      error: (issue) =>
        `Unknown plane "${String(issue.input)}". Planes: ${PLANE_VALUES.join(", ")}.`,
    }
  );

function firstDuplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}

const visiblePlanesSchema = z
  .array(planeSchema)
  .refine((values) => firstDuplicate(values) === undefined, {
    error: (issue) =>
      `scene.visiblePlanes lists "${firstDuplicate(issue.input as readonly string[])}" twice.`,
  });

// Per-step plane overrides are a scene-scope directive (literal, pick:any,
// oneOf, not) resolved by resolveSceneDirective in
// resolve-film-director-spec.ts — distinct/sameAs make no sense pinned to a
// single (performer, step, hand) triple, same reasoning as environmentId
// and formation.
const stepPlaneEntrySchema = z
  .object({
    step: z.number().int().min(0),
    hand: z.preprocess(
      (value) =>
        value === "blue" ? "left" : value === "red" ? "right" : value,
      z.enum(["left", "right"])
    ),
    plane: directiveSchema(planeSchema),
  })
  .strict();

const cameraTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("group") }).strict(),
  z
    .object({
      kind: z.literal("performer"),
      performerId: z.string().min(1),
      height: finiteNumber.optional(),
      // Keep this performer in frame while they walk. `true` aims: the camera
      // stays put and turns its target with the walker. "follow" travels:
      // camera and target both move with them, holding the framing constant.
      // Only meaningful on `subject` — see the cameraSchema refine below.
      track: z.union([z.literal(true), z.literal("follow")]).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("point"), position: vector3Schema }).strict(),
]);

const cameraKeyframeSchema = z
  .object({
    // Unlike every `durationSeconds`/`durationBeats` pair guarded by
    // `atMostOneTimeUnit` above, a keyframe has no computed-default clock —
    // stating NEITHER unit is just as invalid as stating both, checked
    // inline just below rather than reusing that helper.
    atSeconds: finiteNumber.nonnegative().optional(),
    atBeats: finiteNumber.nonnegative().optional(),
    position: vector3Schema,
    target: cameraTargetSchema.optional(),
    fovDeg: finiteNumber.min(20).max(100).optional(),
    rollDeg: finiteNumber.min(-180).max(180).optional(),
    interpolation: z.enum(DIRECTOR_INTERPOLATIONS).optional(),
    easing: z.enum(DIRECTOR_EASINGS).optional(),
  })
  .strict()
  .superRefine((frame, ctx) => {
    if ((frame.atSeconds !== undefined) === (frame.atBeats !== undefined)) {
      ctx.addIssue({
        code: "custom",
        message:
          'A camera keyframe states exactly one of "atSeconds" or "atBeats".',
      });
    }
  });

const positionRefSchema = z.union(
  [
    z.string().min(1),
    z.preprocess(
      normalizeLegacyHandPair,
      z.object({ left: z.string().min(1), right: z.string().min(1) }).strict()
    ),
    z
      .object({
        group: z.enum(DIRECTOR_POSITION_GROUPS),
        location: z.string().min(1),
      })
      .strict(),
  ],
  {
    error:
      'A position is a name like "beta5", a {blue, red} location pair, or a {group, location} like {group: "beta", location: "south"}.',
  }
);

const turnValueSchema = z.union([finiteNumber, z.literal("fl")]);
const turnLaneSchema = z.union([
  turnValueSchema,
  z.array(turnValueSchema).min(1).max(32),
]);
const turnsSchema = z.union(
  [
    turnLaneSchema,
    z.preprocess(
      normalizeLegacyHandPair,
      z
        .object({
          left: turnLaneSchema.optional(),
          right: turnLaneSchema.optional(),
        })
        .strict()
        .refine(
          (lanes) => lanes.left !== undefined || lanes.right !== undefined,
          {
            message: "A per-hand turn figure names left, right, or both.",
          }
        )
    ),
    z.object({ intensity: finiteNumber }).strict(),
  ],
  {
    error:
      'Turns are one value (a number or "fl"), a repeating figure of them, {blue, red} for per-hand figures, or {intensity} to roll at random.',
  }
);

const orientationSchema = z.enum(DIRECTOR_ORIENTATIONS);
const startOrientationSchema = z.union([
  orientationSchema,
  z.preprocess(
    normalizeLegacyHandPair,
    z
      .object({
        left: orientationSchema.optional(),
        right: orientationSchema.optional(),
      })
      .strict()
      .refine(
        (hands) => hands.left !== undefined || hands.right !== undefined,
        {
          message: "A per-hand start orientation names left, right, or both.",
        }
      )
  ),
]);

const loopSchema = z.union([
  z.enum(LOOPType),
  z
    .object({
      type: z.enum(LOOPType),
      period: z.enum(DIRECTOR_LOOP_PERIODS).optional(),
    })
    .strict(),
]);

const transformHandSchema = z.enum(["left", "right", "both"]);

/**
 * One operation in a `transforms` chain. Each branch is strict, so a `hand` on
 * `swap-hands` (which has no per-hand form) is named rather than ignored.
 */
const sequenceTransformSchema = z.discriminatedUnion("op", [
  z
    .object({ op: z.literal("mirror"), hand: transformHandSchema.optional() })
    .strict(),
  z
    .object({ op: z.literal("flip"), hand: transformHandSchema.optional() })
    .strict(),
  z
    .object({
      op: z.literal("rotate"),
      degrees: z.literal(DIRECTOR_ROTATION_DEGREES, {
        error:
          "A sequence rotates in 45-degree steps: 45, 90, 135, 180, 225, 270, or 315.",
      }),
      direction: z.enum(["cw", "ccw"]),
      hand: transformHandSchema.optional(),
    })
    .strict(),
  z.object({ op: z.literal("swap-hands") }).strict(),
  z
    .object({ op: z.literal("invert"), hand: transformHandSchema.optional() })
    .strict(),
  z
    .object({ op: z.literal("rewind"), hand: transformHandSchema.optional() })
    .strict(),
  z
    .object({
      op: z.literal("start-at"),
      step: z
        .number()
        .int()
        .min(2, {
          error:
            "A sequence already starts at step 1. Name a later step to start from.",
        })
        .max(64),
    })
    .strict(),
]);

const SEQUENCE_SOURCE_KEYS = [
  "source",
  "mirrorOf",
  "transformOf",
  "library",
  "word",
  "length",
] as const;
const SEQUENCE_CONTROL_KEYS = [
  "startPosition",
  "startOrientation",
  "turns",
  "level",
  "gridMode",
  "flow",
  "handPath",
  "motionTypes",
  "loop",
  "mustContain",
  "mustNotContain",
  "endPosition",
] as const;

const quoted = (keys: readonly string[]) =>
  keys.map((key) => `"${key}"`).join(", ");

/**
 * What one performer spins. `demo` is the film's shared sequence, `word` and
 * `length` generate a new one through the same pipeline the Create module
 * uses, `mirrorOf` reflects another performer's sequence across the
 * north-south axis, `transformOf` plus `transforms` applies any chain of the
 * Actions-panel transforms to another performer's sequence, and `library`
 * plays a saved public sequence by its id. Deliberately not directive axes:
 * "mirror her" names one specific performer, and a library id is a literal
 * reference, so a random pick would have nothing to mean.
 *
 * One flat object rather than a union of four, because a union reports every
 * branch's failure at once: a misspelled `flow` would arrive buried under
 * three irrelevant complaints about the branches that wanted a different
 * source key. Exactly-one-source is a refinement instead, which leaves every
 * other field free to fail in its own name. The grammar and its meaning live
 * in `sequence-language.ts`.
 */
const performerSequenceSchema = z
  .object({
    source: z.enum(["demo", "none"]).optional(),
    mirrorOf: z.string().min(1).optional(),
    transformOf: z.string().min(1).optional(),
    transforms: z
      .array(sequenceTransformSchema)
      .min(1, { error: 'A "transforms" list needs at least one operation.' })
      .max(8)
      .optional(),
    library: z.string().min(1).optional(),
    word: z.string().min(1).max(24).optional(),
    length: z.number().int().min(1).max(64).optional(),
    startPosition: positionRefSchema.optional(),
    startOrientation: startOrientationSchema.optional(),
    turns: turnsSchema.optional(),
    level: z.literal(DIRECTOR_SEQUENCE_LEVELS).optional(),
    gridMode: z.enum(GridMode).optional(),
    flow: z.enum(DIRECTOR_CONTINUITIES).optional(),
    handPath: z.enum(DIRECTOR_CONTINUITIES).optional(),
    motionTypes: z.enum(DIRECTOR_MOTION_TYPE_FILTERS).optional(),
    loop: loopSchema.optional(),
    mustContain: z.array(z.string().min(1)).min(1).max(24).optional(),
    mustNotContain: z.array(z.string().min(1)).min(1).max(24).optional(),
    endPosition: z
      .union([positionRefSchema, z.array(positionRefSchema).min(1).max(16)])
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const named = SEQUENCE_SOURCE_KEYS.filter(
      (key) => value[key] !== undefined
    );
    if (named.length === 0) {
      ctx.addIssue({
        code: "custom",
        message:
          'A sequence names one source: {source: "demo"}, {source: "none"} to stand and watch, a "word" to spell, a "length" to improvise, a "mirrorOf" to reflect, a "transformOf" to change, or a "library" id to play.',
      });
      return;
    }
    if (named.length > 1) {
      ctx.addIssue({
        code: "custom",
        message: `A sequence names one source, but this one names ${quoted(named)}.`,
      });
      return;
    }
    if (named[0] === "transformOf" && value.transforms === undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          '"transformOf" names whose sequence to change; "transforms" says what changes. Add a "transforms" list.',
      });
      return;
    }
    if (named[0] !== "transformOf" && value.transforms !== undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          '"transforms" only means something on a "transformOf" sequence. Name the performer to transform, or remove the list.',
      });
      return;
    }
    if (named[0] === "word" || named[0] === "length") return;

    const controls = SEQUENCE_CONTROL_KEYS.filter(
      (key) => value[key] !== undefined
    );
    if (controls.length === 0) return;
    // `source` covers two spellings under one key, so it branches on the
    // value while the rest branch on the key.
    const sourceRejection =
      value.source === "none"
        ? `A performer who stands and watches is not spinning anything, so there is nothing for ${quoted(controls)} to shape. Remove it, or give them a "word" of their own.`
        : `The demo sequence is the film's shared one, so it carries no controls of its own. Remove ${quoted(controls)}, or spell a "word" of your own.`;
    const CONTROL_REJECTIONS: Record<string, string> = {
      mirrorOf: `A mirror reflects another performer's sequence exactly, so it carries no controls of its own. Move ${quoted(controls)} to the performer being mirrored.`,
      transformOf: `A transformed sequence is another performer's sequence changed in a stated way, so it carries no controls of its own. Move ${quoted(controls)} to the performer being transformed.`,
      library: `A library sequence is already finished, so it carries no controls of its own. Remove ${quoted(controls)}, or spell a "word" of your own.`,
      source: sourceRejection,
    };
    ctx.addIssue({ code: "custom", message: CONTROL_REJECTIONS[named[0]!]! });
  })
  // The refinement above is the proof that exactly one source key is present,
  // which is what makes the narrower union type true.
  .transform((value) => value as DirectorPerformerSequence);

export type { DirectorPerformerSequence };

/**
 * One blocking move. `direction` is the performer's own left/right/forward/
 * back; `to` names a world point instead. The grammar and its defaults live in
 * `blocking-language.ts`.
 */
const blockingMoveSchema = z
  .object({
    move: z.enum(["stand", "walk", "turn", "run"]),
    to: position2Schema.optional(),
    along: z
      .object({
        arc: z.enum(["left", "right"]),
        // Sagitta as a fraction of the chord: 0.5 is a semicircle, 1.5 loops
        // most of the way round. The meaning and the geometry live in
        // `blocking-language.ts`.
        bulge: finiteNumber.gt(0).max(1.5).optional(),
      })
      .strict()
      .optional(),
    direction: z.enum(["forward", "backward", "left", "right"]).optional(),
    amount: z
      .union([
        z.object({ meters: finiteNumber.positive() }).strict(),
        z.object({ degrees: finiteNumber }).strict(),
      ])
      .optional(),
    facing: z
      .union([
        z.enum(["travel", "hold", "audience"]),
        z.object({ degrees: finiteNumber }).strict(),
      ])
      .optional(),
    durationSeconds: finiteNumber.positive().optional(),
    durationBeats: finiteNumber.positive().optional(),
    easing: z.enum(DIRECTOR_EASINGS).optional(),
  })
  .strict()
  .superRefine(atMostOneTimeUnit);

const blockingSchema = z.array(blockingMoveSchema).min(1).max(16);

/**
 * Cast-wide staging. `endFormation` walks everyone from their opening slot
 * into the named formation — the spoken "and then they all form a line". A
 * performer with their own `blocking` list ignores it.
 */
const sceneBlockingSchema = z
  .object({
    endFormation: formationIdSchema,
    durationSeconds: finiteNumber.positive().optional(),
    durationBeats: finiteNumber.positive().optional(),
    easing: z.enum(DIRECTOR_EASINGS).optional(),
    facing: z
      .union([
        z.enum(["travel", "hold", "audience"]),
        z.object({ degrees: finiteNumber }).strict(),
      ])
      .optional(),
  })
  .strict()
  .superRefine(atMostOneTimeUnit);

/**
 * Spoken but not real. A director will plausibly ask for one performer's
 * trails to be long and another's short. The effects engine cannot do it:
 * `EffectsConfigState` holds one configuration per effect id for the whole
 * scene and `EffectOrchestrator3D` reads that single config for every
 * performer's tips. Accept the keys so the rejection can explain the
 * constraint instead of zod's "unrecognized key".
 */
export const PERFORMER_EFFECT_CONFIG_MESSAGE =
  'Effect presets and overrides are scene-wide: the effects engine keeps one configuration per effect id for the whole scene, so two performers using the same effect always look the same. Move "effectPresets"/"effectOverrides" to the scene, or give the performers different effects.';

const performerEffectConfigKeys = {
  effectPresets: z.unknown().optional(),
  effectOverrides: z.unknown().optional(),
};

function rejectPerformerEffectConfig(
  value: { effectPresets?: unknown; effectOverrides?: unknown },
  ctx: z.RefinementCtx
): void {
  for (const key of ["effectPresets", "effectOverrides"] as const) {
    if (value[key] !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: PERFORMER_EFFECT_CONFIG_MESSAGE,
      });
    }
  }
}

const performerSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    sequence: performerSequenceSchema.optional(),
    characterId: directiveSchema(characterIdSchema).optional(),
    prop: directiveSchema(propTypeSchema).optional(),
    effect: directiveSchema(effectIdSchema).optional(),
    effort: directiveSchema(effortIdSchema).optional(),
    position: position2Schema.optional(),
    facingDegrees: finiteNumber.optional(),
    beatOffset: finiteNumber.optional(),
    blocking: blockingSchema.optional(),
    staffLengthCm: directiveSchema(finiteNumber.min(40).max(300)).optional(),
    leftPlane: directiveSchema(planeSchema).optional(),
    rightPlane: directiveSchema(planeSchema).optional(),
    stepPlanes: z.array(stepPlaneEntrySchema).optional(),
    ...performerEffectConfigKeys,
  })
  .strict()
  .superRefine(rejectPerformerEffectConfig);

const castDefaultsSchema = z
  .object({
    sequence: performerSequenceSchema.optional(),
    characterId: directiveSchema(characterIdSchema).optional(),
    prop: directiveSchema(propTypeSchema).optional(),
    effect: directiveSchema(effectIdSchema).optional(),
    effort: directiveSchema(effortIdSchema).optional(),
    blocking: blockingSchema.optional(),
    staffLengthCm: directiveSchema(finiteNumber.min(40).max(300)).optional(),
    leftPlane: directiveSchema(planeSchema).optional(),
    rightPlane: directiveSchema(planeSchema).optional(),
    stepPlanes: z.array(stepPlaneEntrySchema).optional(),
    ...performerEffectConfigKeys,
  })
  .strict()
  .superRefine(rejectPerformerEffectConfig);

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
    formation: directiveSchema(formationIdSchema).optional(),
    blocking: sceneBlockingSchema.optional(),
    cast: castSchema.optional(),
    performers: z.array(performerSchema).min(1).max(8).optional(),
  })
  .strict()
  .refine((value) => !(value.cast && value.performers), {
    message: "Use either a cast block or a performers array, not both.",
    path: ["cast"],
  });

const locationSchema = z
  .object({
    environmentId: directiveSchema(environmentIdSchema).optional(),
    showStage: z.boolean().optional(),
    showAudience: z.boolean().optional(),
    sceneFeatures: z.record(z.string(), z.boolean()).optional(),
    visiblePlanes: visiblePlanesSchema.optional(),
  })
  .strict();

const cameraMoveSchema = z
  .object({
    move: z.enum([
      "hold",
      "push-in",
      "pull-back",
      "orbit",
      "crane",
      "pan",
      "truck",
      "zoom",
      "roll",
    ]),
    direction: z
      .enum(["cw", "ccw", "up", "down", "left", "right", "in", "out"])
      .optional(),
    amount: z
      .union([
        z.object({ degrees: finiteNumber }).strict(),
        z.object({ meters: finiteNumber.positive() }).strict(),
      ])
      .optional(),
    durationSeconds: finiteNumber.positive().optional(),
    durationBeats: finiteNumber.positive().optional(),
    easing: z.enum(DIRECTOR_EASINGS).optional(),
  })
  .strict()
  .superRefine(atMostOneTimeUnit);

/**
 * One framing, spelled the same whether it is the scene's only framing or one
 * shot among several. Shared so a shot can never drift from what the top-level
 * camera accepts.
 */
const cameraFramingFields = {
  subject: cameraTargetSchema.optional(),
  shotSize: z.enum(["close-up", "medium", "wide", "extreme-wide"]).optional(),
  angle: z.enum(["low", "eye", "high", "top"]).optional(),
  position: z
    .union([
      z.enum(["front", "left", "right", "behind"]),
      z.object({ degrees: finiteNumber.min(-360).max(360) }).strict(),
    ])
    .optional(),
  moves: z.array(cameraMoveSchema).min(1).max(16).optional(),
};

/** A framing plus how long it stays on screen. Consecutive shots hard-cut. */
const cameraShotSchema = z
  .object({
    ...cameraFramingFields,
    durationSeconds: finiteNumber.positive().optional(),
    durationBeats: finiteNumber.positive().optional(),
  })
  .strict()
  .superRefine(atMostOneTimeUnit);

const cameraSchema = z
  .object({
    preset: z.enum(DIRECTOR_CAMERA_PRESETS).optional(),
    target: cameraTargetSchema.optional(),
    orbitDegrees: finiteNumber.min(-720).max(720).optional(),
    keyframes: z.array(cameraKeyframeSchema).min(1).max(32).optional(),
    ...cameraFramingFields,
    shots: z
      .array(cameraShotSchema)
      .min(2, {
        message:
          "One shot is just a framing. State it directly on camera, or give shots at least two entries to cut between.",
      })
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
      !(
        camera.shotSize ||
        camera.angle ||
        camera.position ||
        camera.moves ||
        camera.subject
      ),
    {
      message: "Raw keyframes and framing grammar are exclusive — use one.",
      path: ["keyframes"],
    }
  )
  .refine(
    (camera) =>
      !camera.preset ||
      camera.preset === "custom" ||
      !(camera.shotSize || camera.angle || camera.position || camera.moves),
    {
      message: "A preset and framing grammar are exclusive — use one.",
      path: ["preset"],
    }
  )
  .refine((camera) => !(camera.subject && camera.target), {
    message:
      'Use "subject" with framing grammar, "target" with presets/keyframes.',
    path: ["subject"],
  })
  // cameraTargetSchema is shared by subject, target, and keyframe targets, so
  // `track` is syntactically sayable in all three. It only means something on
  // `subject`: a preset or a raw keyframe aims exactly where its target says,
  // and silently ignoring the word would read as a camera that refused to move.
  .refine(
    (camera) =>
      !(camera.target?.kind === "performer" && camera.target.track) &&
      !camera.keyframes?.some(
        (frame) => frame.target?.kind === "performer" && frame.target.track
      ),
    {
      message:
        'Tracking is spoken on "subject" with framing grammar. Presets and raw keyframes aim where their targets say.',
      path: ["target"],
    }
  )
  .refine(
    (camera) =>
      !camera.shots ||
      !(
        camera.subject ||
        camera.shotSize ||
        camera.angle ||
        camera.position ||
        camera.moves
      ),
    {
      message:
        'Shots and a single framing are exclusive. Put every framing inside "shots".',
      path: ["shots"],
    }
  )
  .refine((camera) => !(camera.shots && camera.preset), {
    message: "A preset and shots are exclusive. Shots are their own framing.",
    path: ["shots"],
  })
  .refine((camera) => !(camera.shots && camera.keyframes), {
    message: "Raw keyframes and shots are exclusive. Use one.",
    path: ["shots"],
  })
  .refine((camera) => !(camera.shots && camera.target), {
    message: 'Use "subject" inside each shot, not "target".',
    path: ["shots"],
  })
  // Tracking offsets the WHOLE resolved track by a walker's displacement, so
  // it cannot describe a walker followed in one shot and ignored in the next.
  .refine(
    (camera) =>
      !camera.shots?.some(
        (shot) => shot.subject?.kind === "performer" && shot.subject.track
      ),
    {
      message:
        'Tracking and shots do not combine yet. Track a walker with a single framing, or cut between shots without "track".',
      path: ["shots"],
    }
  );

const transitionSchema = z
  .object({
    kind: z.enum(["cut", "environment-dissolve", "fade-through-black"]),
    durationSeconds: finiteNumber.min(0).max(3).optional(),
    // max 32 beats is a syntactic cap, not the real one — see the two-layer
    // contract note on atMostOneTimeUnit above. At a slow bpm, 32 beats can
    // still convert to more than the 3-second ceiling this transition
    // actually enforces; convertSceneBeatTimes catches that at resolve time.
    durationBeats: finiteNumber.min(0).max(32).optional(),
  })
  .strict()
  .superRefine(atMostOneTimeUnit);

const sceneSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    intent: z.string().min(1).optional(),
    durationSeconds: finiteNumber.min(1).max(60).optional(),
    // max 240 beats is a syntactic cap, not the real one — see the
    // two-layer contract note on atMostOneTimeUnit above. At a slow bpm,
    // 240 beats can still convert to more than the scene's 60-second
    // ceiling; convertSceneBeatTimes catches that at resolve time.
    durationBeats: finiteNumber.positive().max(240).optional(),
    transition: transitionSchema.optional(),
    location: locationSchema.optional(),
    performance: performanceSchema.optional(),
    effectPresets: z
      .record(
        z.string(),
        z.union([
          z.string().min(1),
          z.object({ pick: z.literal("any") }).strict(),
        ])
      )
      .optional(),
    effectOverrides: z
      .record(configurableEffectIdSchema, z.record(z.string(), z.unknown()))
      .optional(),
    camera: cameraSchema.optional(),
  })
  .strict()
  .superRefine(atMostOneTimeUnit);

const filmDirectorInputSchema = z
  .object({
    // Declarative provenance, not a grammar gate. `version` records which
    // revision of this document a director authored against — it does NOT
    // restrict which grammar that document may use. Newer grammar (beats as
    // a time unit, combined pick+not) is accepted at ANY stated version,
    // exactly as v2/v3 grammar was: a v1-labeled film can freely use v4-era
    // syntax. Don't add version-conditional parsing here; bump the literal
    // set when a new number ships and let the grammar itself decide what's
    // legal.
    version: z.union([
      z.literal(FILM_DIRECTOR_SCHEMA_VERSION_1),
      z.literal(FILM_DIRECTOR_SCHEMA_VERSION_2),
      z.literal(FILM_DIRECTOR_SCHEMA_VERSION_3),
      z.literal(FILM_DIRECTOR_SCHEMA_VERSION_4),
      z.literal(FILM_DIRECTOR_SCHEMA_VERSION),
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
    scenes: z.array(sceneSchema).min(1).max(24),
  })
  .strict();

export const FilmDirectorInputSchema = z.preprocess(
  normalizeFilmDirectorInput,
  filmDirectorInputSchema
);

export type FilmDirectorInput = z.infer<typeof FilmDirectorInputSchema>;
export type DirectorSceneInput = z.infer<typeof sceneSchema>;
export type DirectorCastInput = z.infer<typeof castSchema>;
export type DirectorCameraInput = z.infer<typeof cameraSchema>;
export type DirectorCameraTargetInput = z.infer<typeof cameraTargetSchema>;
export type DirectorBlockingInput = z.infer<typeof blockingSchema>;
export type DirectorSceneBlockingInput = z.infer<typeof sceneBlockingSchema>;
export type DirectorCameraPreset = (typeof DIRECTOR_CAMERA_PRESETS)[number];
export type DirectorInterpolation = (typeof DIRECTOR_INTERPOLATIONS)[number];
export type DirectorEasing = (typeof DIRECTOR_EASINGS)[number];

export interface ResolvedDirectorStepPlane {
  step: number;
  hand: "left" | "right";
  plane: Plane;
}

export interface ResolvedDirectorPerformer {
  id: string;
  name: string;
  characterId: CharacterId;
  prop: PropType;
  effect: EffectType;
  effort: EffortId;
  sequence: DirectorPerformerSequence;
  /** Where this performer stands when the scene opens. */
  position: { x: number; z: number };
  /** Which way they face when the scene opens. */
  facingAngle: number;
  /** Their staging for the whole scene, always at least an opening hold. */
  blocking: ResolvedDirectorBlockingKeyframe[];
  beatOffset: number;
  staffLengthCm: number | null;
  leftPlane: Plane;
  rightPlane: Plane;
  stepPlanes: ResolvedDirectorStepPlane[];
}

export interface ResolvedDirectorCameraKeyframe {
  atSeconds: number;
  position: [number, number, number];
  target: [number, number, number];
  fovDeg: number;
  /**
   * Horizon tilt in degrees, positive = clockwise as the audience sees the
   * frame. Present only on keyframe streams where a roll move ran, so films
   * that never roll resolve byte-identically to their pre-roll snapshots.
   */
  rollDeg?: number;
  interpolation: DirectorInterpolation;
  easing: DirectorEasing;
}

export interface ResolvedDirectorScene {
  id: string;
  title: string;
  intent: string | null;
  startSeconds: number;
  durationSeconds: number;
  transition: {
    kind: "cut" | "environment-dissolve" | "fade-through-black";
    durationSeconds: number;
  };
  location: {
    environmentId: SceneEnvironmentId;
    showStage: boolean;
    showAudience: boolean;
    sceneFeatures: Record<string, boolean>;
    visiblePlanes: Plane[];
  };
  performance: {
    bpm: number;
    sequence: { source: "demo"; loop: boolean };
    formation: FormationPreset;
    performers: ResolvedDirectorPerformer[];
    /**
     * Every mark the cast reaches during this scene, opening positions and
     * blocking waypoints alike. The viewer sizes the ground to this instead of
     * to the live positions, so a scene of walking gets one stage rather than
     * one that grows and shrinks under the feet crossing it.
     */
    stageExtent: readonly { x: number; z: number }[];
  };
  effectPresets: Record<string, string>;
  effectOverrides: Record<string, Record<string, unknown>>;
  camera: {
    preset: DirectorCameraPreset;
    /**
     * The preset the scene asked for when it is not approved for this
     * formation and `preset` is a fallback. Null when nothing was
     * substituted. The control surface shows it rather than letting the
     * swap happen silently.
     */
    substitutedFor: DirectorCameraPreset | null;
    keyframes: ResolvedDirectorCameraKeyframe[];
    /**
     * Present only when the scene's subject asked to be tracked. The sampler
     * offsets the compiled camera by this performer's live displacement from
     * their opening mark: "aim" moves the target, "follow" moves target and
     * position together. Absent (not null) on every other scene so films that
     * never track resolve byte-identically to their pre-tracking snapshots.
     */
    tracking?: { performerId: string; mode: "aim" | "follow" };
  };
}

export interface ResolvedFilmDirectorSpec {
  version:
    | typeof FILM_DIRECTOR_SCHEMA_VERSION_1
    | typeof FILM_DIRECTOR_SCHEMA_VERSION_2
    | typeof FILM_DIRECTOR_SCHEMA_VERSION_3
    | typeof FILM_DIRECTOR_SCHEMA_VERSION_4
    | typeof FILM_DIRECTOR_SCHEMA_VERSION;
  id: string;
  title: string;
  brief: string | null;
  format: { width: number; height: number; fps: number };
  playback: { loop: boolean; autoplay: boolean };
  scenes: ResolvedDirectorScene[];
  durationSeconds: number;
}
