import {
  AVATAR_DEFINITIONS,
  Plane,
  PRESET_VALID_COUNTS,
  calculateFacingAngle,
  createFormationFromPreset,
  type AvatarId,
  type FormationPreset,
} from "@austencloud/scene-3d";

import {
  EFFECTS,
  getRegistration,
} from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
import { getStageCoordinateFrame } from "$lib/shared/3d/environments/domain/stage-coordinate-frame";
import { getPerformerStageBounds } from "$lib/shared/3d/environments/domain/performer-stage-bounds";
import {
  getSceneEnvironmentRendererKey,
  SceneEnvironmentId,
} from "$lib/shared/3d/environments/domain/scene-environment";
import type { EffectType } from "$lib/shared/effects/domain/effects-config";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

import { resolveDirectorCameraTrack } from "./director-camera-track";
import { isDirectiveExpression, type DirectiveValue } from "./directives";
import {
  createAxisStream,
  resolveFilmSeed,
  seededPick,
  type FilmSeed,
} from "./directive-random";
import { resolveCastAxis } from "./resolve-directives";
import {
  DIRECTOR_EFFORT_IDS,
  DIRECTOR_FORMATIONS,
  FilmDirectorInputSchema,
  type DirectorCastInput,
  type DirectorPerformerSequence,
  type DirectorShotInput,
  type FilmDirectorInput,
  type ResolvedDirectorPerformer,
  type ResolvedDirectorShot,
  type ResolvedDirectorStepPlane,
  type ResolvedFilmDirectorSpec,
} from "./film-director-schema";

const DEFAULT_AVATARS = AVATAR_DEFINITIONS.map(
  (avatar) => avatar.id
) as AvatarId[];

// Axis catalogs, built once at module scope. `effect` and `avatarId` stay
// loosely typed as `string` here (see the per-axis comments in resolveShot)
// because their schema fields are un-narrowed `z.string()` refinements —
// the registry-type cast happens once, on the resolved concrete value, same
// as this file did before directives existed.
const PROP_CATALOG = Object.values(PropType);
const EFFECT_CATALOG: readonly string[] = [
  "none",
  ...EFFECTS.map((effect) => effect.id),
];
const EFFORT_CATALOG = [...DIRECTOR_EFFORT_IDS] as EffortId[];
const ENVIRONMENT_CATALOG = Object.values(SceneEnvironmentId);
const PLANE_CATALOG = Object.values(Plane) as Plane[];
// "custom" needs per-performer positions, so an open formation pick never
// selects it — the count filter below narrows further, per shot.
const FORMATION_CATALOG = DIRECTOR_FORMATIONS.filter(
  (preset) => preset !== "custom"
) as FormationPreset[];

type PerformerInput = NonNullable<DirectorCastInput["performers"]>[number];

interface ResolvedPerformerFields {
  id: string;
  name?: string;
  avatarId: AvatarId;
  prop: PropType;
  effect: EffectType;
  effort: EffortId;
  sequence: DirectorPerformerSequence;
  position?: { x: number; z: number };
  facingDegrees?: number;
  beatOffset?: number;
  staffLengthCm: number | null;
  bluePlane: Plane;
  redPlane: Plane;
  stepPlanes: ResolvedDirectorStepPlane[];
}

function contextualEnvironmentFromEffects(
  effects: readonly EffectType[]
): SceneEnvironmentId {
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

/**
 * Expands a `cast` block into one performer-input slot per `cast.count`.
 * Overrides match `performer-${index + 1}` by explicit id first; overrides
 * with no id fill whatever slots remain, in array order. An override whose
 * id doesn't name one of this cast's performers is a rejection, not a
 * silent positional guess — that would put the wrong override on the wrong
 * performer (e.g. a lone `{id:"performer-3", ...}` landing on performer-1).
 */
function buildCastPerformerInputs(cast: DirectorCastInput): PerformerInput[] {
  const overrides = cast.performers ?? [];
  const byIndex: (PerformerInput | undefined)[] = new Array(cast.count).fill(
    undefined
  );
  const idLess: PerformerInput[] = [];
  const idPattern = /^performer-(\d+)$/;

  for (const override of overrides) {
    if (override.id === undefined) {
      idLess.push(override);
      continue;
    }
    const match = idPattern.exec(override.id);
    const index = match ? Number(match[1]) - 1 : -1;
    if (index < 0 || index >= cast.count) {
      throw new Error(
        `Cast override "${override.id}" does not match any of the ${cast.count} performers.`
      );
    }
    byIndex[index] = override;
  }

  let cursor = 0;
  for (const override of idLess) {
    while (cursor < cast.count && byIndex[cursor] !== undefined) cursor += 1;
    if (cursor >= cast.count) break;
    byIndex[cursor] = override;
    cursor += 1;
  }

  return Array.from({ length: cast.count }, (_, index) => ({
    ...(byIndex[index] ?? {}),
    id: `performer-${index + 1}`,
  }));
}

/**
 * Resolves a single shot-scoped directive (formation, environmentId,
 * stepPlanes entries). `sameAs` and `pick: "distinct"` are performer-scoped
 * concepts and have no meaning for a single shot-level value.
 *
 * `streamKey` defaults to `shotId` (the original, only behavior) — pass a
 * more specific key when several shot-scoped values share the same `axis`
 * name within one shot (e.g. multiple stepPlanes entries all resolve on
 * axis "stepPlane") so each gets its own draw instead of colliding on an
 * identical fresh stream. `shotId` itself stays the real shot id in error
 * text regardless of `streamKey`.
 */
function resolveShotDirective<T extends string>(
  value: DirectiveValue<T> | undefined,
  axis: string,
  fallback: () => T,
  shotId: string,
  seed: FilmSeed,
  catalog: readonly T[],
  streamKey: string = shotId
): T {
  if (value === undefined) return fallback();
  if (!isDirectiveExpression(value)) return value;
  if ("sameAs" in value || ("pick" in value && value.pick === "distinct")) {
    throw new Error(
      `Shot "${shotId}": "${axis}" supports literals, pick:any, oneOf, and not — distinct/sameAs are performer-scoped.`
    );
  }
  const [resolved] = resolveCastAxis<T>({
    axis,
    shotId,
    performerIds: ["shot"],
    values: [value],
    catalog,
    random: createAxisStream(seed, streamKey, axis),
  });
  return resolved!;
}

/**
 * Resolves one performer's effective stepPlanes list. Each entry's `plane`
 * is a shot-scoped directive (see resolveShotDirective) keyed by axis
 * "stepPlane" so a single `seed.axes.stepPlane` reroll reshuffles every
 * stepPlanes entry across the film, while each (performer, step, hand)
 * triple still draws from its own stream via a distinguishing `streamKey`.
 */
function resolveStepPlanesForPerformer(
  entries: readonly {
    step: number;
    hand: "blue" | "red";
    plane: DirectiveValue<Plane>;
  }[],
  performerId: string,
  shotId: string,
  seed: FilmSeed
): ResolvedDirectorStepPlane[] {
  return entries.map((entry) => ({
    step: entry.step,
    hand: entry.hand,
    plane: resolveShotDirective<Plane>(
      entry.plane,
      "stepPlane",
      () => {
        throw new Error(
          `Shot "${shotId}": stepPlanes entry for "${performerId}" at step ${entry.step} is missing a plane.`
        );
      },
      shotId,
      seed,
      PLANE_CATALOG,
      // NUL-separated like createAxisStream's own key: authored ids may
      // contain spaces, so a space-joined key would be ambiguous.
      `${shotId}\u0000${performerId}\u0000${entry.step}\u0000${entry.hand}`
    ),
  }));
}

function resolveEffectPresets(
  effectPresets: Record<string, string | { pick: "any" }>,
  shotId: string,
  seed: FilmSeed
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [effectId, presetValue] of Object.entries(effectPresets)) {
    if (typeof presetValue === "string") {
      const registration = getRegistration(effectId);
      if (!registration) {
        throw new Error(
          `Effect preset references unknown effect "${effectId}".`
        );
      }
      if (
        !registration.presetGroup.presets.some(
          (preset) => preset.id === presetValue
        )
      ) {
        throw new Error(
          `Effect "${effectId}" has no preset named "${presetValue}".`
        );
      }
      resolved[effectId] = presetValue;
      continue;
    }

    // { pick: "any" } — draw from the effect's registered presets. A missing
    // registration and an empty preset group collapse to the same error:
    // both mean there is nothing to pick from.
    const registration = getRegistration(effectId);
    const presetIds = registration?.presetGroup.presets.map(
      (preset) => preset.id
    );
    const picked = presetIds?.length
      ? seededPick(
          presetIds,
          createAxisStream(seed, shotId, `effectPreset:${effectId}`)
        )
      : undefined;
    if (picked === undefined) {
      throw new Error(
        `Shot "${shotId}": effect "${effectId}" has no registered presets to pick from.`
      );
    }
    resolved[effectId] = picked;
  }
  return resolved;
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

function buildResolvedPerformers(
  inputs: readonly ResolvedPerformerFields[],
  formationPreset: FormationPreset
): ResolvedDirectorPerformer[] {
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
    const id = input.id;
    if (seenIds.has(id)) throw new Error(`Performer id "${id}" is duplicated.`);
    seenIds.add(id);

    if (!AVATAR_DEFINITIONS.some((avatar) => avatar.id === input.avatarId)) {
      throw new Error(
        `Avatar "${input.avatarId}" is not in the deployed 3D catalog.`
      );
    }

    const slot = formation.slots.find((candidate) => candidate.index === index);
    if (!slot && !input.position) {
      throw new Error(
        `Formation "${formationPreset}" has no slot for performer ${index + 1}.`
      );
    }
    const position = input.position ?? slot!.position;
    // Two conventions collide here. The formation library's "same-direction"
    // default faces +Z, but every director camera fronts the group from -Z
    // (computeFramingShot's wall-plane eye). A film's default cast must face
    // its audience, so same-direction (and slot-less custom rosters) face -Z.
    // Slots with their own facingAngle (circle, back-to-back, ...) and
    // explicit facingDegrees keep their meaning.
    const facingAngle =
      input.facingDegrees !== undefined
        ? (input.facingDegrees * Math.PI) / 180
        : slot
          ? slot.facingAngle === undefined &&
            formation.facingMode === "same-direction"
            ? Math.PI
            : calculateFacingAngle(slot, formation)
          : Math.PI;

    return {
      id,
      name: input.name ?? `Performer ${index + 1}`,
      avatarId: input.avatarId,
      prop: input.prop,
      effect: input.effect,
      effort: input.effort,
      sequence: input.sequence,
      position: { ...position },
      facingAngle,
      beatOffset: input.beatOffset ?? 0,
      staffLengthCm: input.staffLengthCm,
      bluePlane: input.bluePlane,
      redPlane: input.redPlane,
      stepPlanes: input.stepPlanes,
    };
  });
}

function resolveShot(
  shot: DirectorShotInput,
  shotIndex: number,
  startSeconds: number,
  aspectRatio: number,
  filmSeed: FilmSeed
): ResolvedDirectorShot {
  const durationSeconds = shot.durationSeconds ?? 8;
  const cast = shot.performance?.cast;

  const rawInputs: PerformerInput[] = cast
    ? buildCastPerformerInputs(cast)
    : shot.performance?.performers?.length
      ? shot.performance.performers
      : [{}];

  const performerIds = rawInputs.map(
    (input, index) => input.id ?? `performer-${index + 1}`
  );

  // avatarId's schema field is an un-narrowed `z.string()` (validated at
  // runtime against the deployed catalog, not by a literal-union schema), so
  // the axis resolves as plain strings and the registry cast happens once on
  // the resolved value below — same pattern this file used pre-directives.
  const avatarIdValues: DirectiveValue<string>[] = rawInputs.map(
    (input, index) =>
      input.avatarId ??
      cast?.defaults?.avatarId ??
      DEFAULT_AVATARS[index % DEFAULT_AVATARS.length]!
  );
  const propValues: DirectiveValue<PropType>[] = rawInputs.map(
    (input) => input.prop ?? cast?.defaults?.prop ?? PropType.STAFF
  );
  const effectValues: DirectiveValue<string>[] = rawInputs.map(
    (input) => input.effect ?? cast?.defaults?.effect ?? "none"
  );
  const effortValues: DirectiveValue<EffortId>[] = rawInputs.map(
    (input) => input.effort ?? cast?.defaults?.effort ?? "linear"
  );

  // Pre-validate literal avatarIds with the original, more specific error
  // text ("not in the deployed 3D catalog") — resolveCastAxis's own catalog
  // check exists too (needed so a distinct pick still has a pool to draw
  // from), but its generic axis-catalog message is a worse error for the
  // single-avatar case this file has always reported this way.
  for (const value of avatarIdValues) {
    if (isDirectiveExpression(value)) continue;
    if (!AVATAR_DEFINITIONS.some((avatar) => avatar.id === value)) {
      throw new Error(`Avatar "${value}" is not in the deployed 3D catalog.`);
    }
  }
  const resolvedAvatarIds = resolveCastAxis<string>({
    axis: "avatarId",
    shotId: shot.id,
    performerIds,
    values: avatarIdValues,
    catalog: DEFAULT_AVATARS,
    random: createAxisStream(filmSeed, shot.id, "avatarId"),
  });
  const resolvedProps = resolveCastAxis<PropType>({
    axis: "prop",
    shotId: shot.id,
    performerIds,
    values: propValues,
    catalog: PROP_CATALOG,
    random: createAxisStream(filmSeed, shot.id, "prop"),
  });
  const resolvedEffects = resolveCastAxis<string>({
    axis: "effect",
    shotId: shot.id,
    performerIds,
    values: effectValues,
    catalog: EFFECT_CATALOG,
    random: createAxisStream(filmSeed, shot.id, "effect"),
  });
  const resolvedEfforts = resolveCastAxis<EffortId>({
    axis: "effort",
    shotId: shot.id,
    performerIds,
    values: effortValues,
    catalog: EFFORT_CATALOG,
    random: createAxisStream(filmSeed, shot.id, "effort"),
  });

  // staffLengthCm has no finite catalog (a pick needs an explicit "from"),
  // and its system default is the literal `null` bypass — not a value on
  // any axis. So only performers that actually state a directive or literal
  // run through resolveCastAxis; everyone else keeps `null` untouched.
  const staffLengthStates = rawInputs.map(
    (input) => input.staffLengthCm ?? cast?.defaults?.staffLengthCm
  );
  const staffIndices = staffLengthStates
    .map((value, index) => (value !== undefined ? index : -1))
    .filter((index) => index >= 0);
  const resolvedStaffLengths: (number | null)[] = rawInputs.map(() => null);
  const staffStatingIds = new Set(
    staffIndices.map((index) => performerIds[index]!)
  );
  for (const index of staffIndices) {
    const value = staffLengthStates[index];
    if (typeof value !== "object" || value === null || !("sameAs" in value)) {
      continue;
    }
    const target = (value as { sameAs: string }).sameAs;
    if (performerIds.includes(target) && !staffStatingIds.has(target)) {
      throw new Error(
        `Shot "${shot.id}", axis "staffLengthCm": sameAs references "${target}", which has no staff length to copy.`
      );
    }
  }
  if (staffIndices.length > 0) {
    const resolved = resolveCastAxis<number>({
      axis: "staffLengthCm",
      shotId: shot.id,
      performerIds: staffIndices.map((index) => performerIds[index]!),
      values: staffIndices.map((index) => staffLengthStates[index]!),
      catalog: null,
      random: createAxisStream(filmSeed, shot.id, "staffLengthCm"),
    });
    staffIndices.forEach((index, cursor) => {
      resolvedStaffLengths[index] = resolved[cursor]!;
    });
  }

  const bluePlaneValues: DirectiveValue<Plane>[] = rawInputs.map(
    (input) => input.bluePlane ?? cast?.defaults?.bluePlane ?? Plane.WALL
  );
  const redPlaneValues: DirectiveValue<Plane>[] = rawInputs.map(
    (input) => input.redPlane ?? cast?.defaults?.redPlane ?? Plane.WALL
  );
  const resolvedBluePlanes = resolveCastAxis<Plane>({
    axis: "bluePlane",
    shotId: shot.id,
    performerIds,
    values: bluePlaneValues,
    catalog: PLANE_CATALOG,
    random: createAxisStream(filmSeed, shot.id, "bluePlane"),
  });
  const resolvedRedPlanes = resolveCastAxis<Plane>({
    axis: "redPlane",
    shotId: shot.id,
    performerIds,
    values: redPlaneValues,
    catalog: PLANE_CATALOG,
    random: createAxisStream(filmSeed, shot.id, "redPlane"),
  });

  // A performer's own stepPlanes list REPLACES cast defaults entirely — it
  // does not merge with them. Naming a performer's steps is dictation: the
  // director said exactly what happens at those steps, not "add these to
  // whatever the cast shares."
  const resolvedStepPlanes: ResolvedDirectorStepPlane[][] = rawInputs.map(
    (input, index) => {
      const entries = input.stepPlanes ?? cast?.defaults?.stepPlanes ?? [];
      return resolveStepPlanesForPerformer(
        entries,
        performerIds[index]!,
        shot.id,
        filmSeed
      );
    }
  );

  // Sequences resolve as literals, not through resolveCastAxis: the mirror
  // form names one specific performer, so there is no catalog to pick from.
  // The mirror graph is validated exactly one level deep — a mirror of a
  // mirror has no original of its own to reflect, and letting it resolve
  // would silently hand both performers the same reflection.
  const resolvedSequences: DirectorPerformerSequence[] = rawInputs.map(
    (input) => input.sequence ?? cast?.defaults?.sequence ?? { source: "demo" }
  );
  resolvedSequences.forEach((sequence, index) => {
    if (!("mirrorOf" in sequence)) return;
    const self = performerIds[index]!;
    const targetIndex = performerIds.indexOf(sequence.mirrorOf);
    if (sequence.mirrorOf === self) {
      throw new Error(
        `Shot "${shot.id}": performer "${self}" cannot mirror themselves.`
      );
    }
    if (targetIndex < 0) {
      throw new Error(
        `Shot "${shot.id}": performer "${self}" mirrors "${sequence.mirrorOf}", who is not in this shot.`
      );
    }
    if ("mirrorOf" in resolvedSequences[targetIndex]!) {
      throw new Error(
        `Shot "${shot.id}": performer "${self}" mirrors "${sequence.mirrorOf}", who is already a mirror. Mirror the original instead.`
      );
    }
  });

  const resolvedFields: ResolvedPerformerFields[] = rawInputs.map(
    (input, index) => ({
      id: performerIds[index]!,
      name: input.name,
      avatarId: resolvedAvatarIds[index]! as AvatarId,
      prop: resolvedProps[index]!,
      effect: resolvedEffects[index]! as EffectType,
      effort: resolvedEfforts[index]!,
      sequence: resolvedSequences[index]!,
      position: input.position,
      facingDegrees: input.facingDegrees,
      beatOffset: input.beatOffset,
      staffLengthCm: resolvedStaffLengths[index]!,
      bluePlane: resolvedBluePlanes[index]!,
      redPlane: resolvedRedPlanes[index]!,
      stepPlanes: resolvedStepPlanes[index]!,
    })
  );

  const environmentId = resolveShotDirective<SceneEnvironmentId>(
    shot.scene?.environmentId,
    "environmentId",
    () =>
      contextualEnvironmentFromEffects(resolvedFields.map((f) => f.effect)),
    shot.id,
    filmSeed,
    ENVIRONMENT_CATALOG
  );

  const performerCount = resolvedFields.length;
  const formationCatalog = FORMATION_CATALOG.filter((preset) =>
    PRESET_VALID_COUNTS[preset].includes(performerCount)
  );
  const formation = resolveShotDirective<FormationPreset>(
    shot.performance?.formation,
    "formation",
    () => defaultFormation(performerCount),
    shot.id,
    filmSeed,
    formationCatalog
  );

  const performers = buildResolvedPerformers(resolvedFields, formation);

  const showStage = shot.scene?.showStage ?? false;
  const showAudience = shot.scene?.showAudience ?? false;
  const visiblePlanes = shot.scene?.visiblePlanes ?? [];
  const sceneFeatures = {
    environment: true,
    stage: showStage,
    audience: showAudience,
    campfire: false,
    tent: false,
    ...(shot.scene?.sceneFeatures ?? {}),
  };
  const effectPresets = resolveEffectPresets(
    shot.effectPresets ?? {},
    shot.id,
    filmSeed
  );
  const effectOverrides = { ...(shot.effectOverrides ?? {}) };
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
    scene: { environmentId, showStage, showAudience, sceneFeatures, visiblePlanes },
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
  const filmSeed = resolveFilmSeed(input.id, input.seed);
  const seenShotIds = new Set<string>();
  let cursorSeconds = 0;

  const shots = input.shots.map((shot, index) => {
    if (seenShotIds.has(shot.id))
      throw new Error(`Shot id "${shot.id}" is duplicated.`);
    seenShotIds.add(shot.id);
    const resolved = resolveShot(shot, index, cursorSeconds, aspectRatio, filmSeed);
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
