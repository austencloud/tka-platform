import {
  Plane,
  PRESET_VALID_COUNTS,
  calculateFacingAngle,
  createFormationFromPreset,
  type FormationPreset,
} from "@austencloud/scene-3d";
import {
  CHARACTER_DEFINITIONS,
  type CharacterId,
} from "$lib/shared/3d/domain/character-model";

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

import {
  AUDIENCE_FACING_ANGLE,
  compileBlockingMoves,
  type DirectorBlockingMove,
} from "./blocking-language";
import { convertSceneBeatTimes } from "./director-beat-times";
import { resolveDirectorCameraTrack } from "./director-camera-track";
import { isDirectiveExpression, type DirectiveValue } from "./directives";
import {
  createAxisStream,
  resolveFilmSeed,
  seededPick,
  type FilmSeed,
} from "./directive-random";
import { resolveCastAxis } from "./resolve-directives";
import { assertSequenceDirective } from "./sequence-language";
import {
  DIRECTOR_EFFORT_IDS,
  DIRECTOR_FORMATIONS,
  FilmDirectorInputSchema,
  type DirectorCastInput,
  type DirectorPerformerSequence,
  type DirectorSceneBlockingInput,
  type DirectorSceneInput,
  type FilmDirectorInput,
  type ResolvedDirectorPerformer,
  type ResolvedDirectorScene,
  type ResolvedDirectorStepPlane,
  type ResolvedFilmDirectorSpec,
} from "./film-director-schema";

const DEFAULT_CHARACTERS = CHARACTER_DEFINITIONS.map(
  (character) => character.id
) as CharacterId[];

function createCharacterAxisStream(
  seed: FilmSeed,
  sceneId: string
): () => number {
  // Seed namespaces are persisted behavior. Keep the historical hash key so
  // migrating avatarId to characterId does not silently recast a saved film,
  // while making characterId the canonical reroll control for v4 authors.
  const legacySeed: FilmSeed = {
    ...seed,
    axes: {
      ...seed.axes,
      avatarId: seed.axes.characterId ?? seed.axes.avatarId ?? 0,
    },
  };
  return createAxisStream(legacySeed, sceneId, "avatarId");
}

function createHandPlaneAxisStream(
  seed: FilmSeed,
  sceneId: string,
  hand: "left" | "right"
): () => number {
  // Plane picks are persisted choreography. Keep the historical color-named
  // hash namespace so a vocabulary migration cannot reshuffle an existing
  // film, while canonical left/right salts remain the public reroll controls.
  const canonicalAxis = `${hand}Plane`;
  const legacyAxis = hand === "left" ? "bluePlane" : "redPlane";
  const legacySeed: FilmSeed = {
    ...seed,
    axes: {
      ...seed.axes,
      [legacyAxis]: seed.axes[canonicalAxis] ?? seed.axes[legacyAxis] ?? 0,
    },
  };
  return createAxisStream(legacySeed, sceneId, legacyAxis);
}

// Axis catalogs, built once at module scope. `effect` and `characterId` stay
// loosely typed as `string` here (see the per-axis comments in resolveScene)
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
// selects it — the count filter below narrows further, per scene.
const FORMATION_CATALOG = DIRECTOR_FORMATIONS.filter(
  (preset) => preset !== "custom"
) as FormationPreset[];

type PerformerInput = NonNullable<DirectorCastInput["performers"]>[number];

interface ResolvedPerformerFields {
  id: string;
  name?: string;
  characterId: CharacterId;
  prop: PropType;
  effect: EffectType;
  effort: EffortId;
  sequence: DirectorPerformerSequence;
  position?: { x: number; z: number };
  facingDegrees?: number;
  blocking?: DirectorBlockingMove[];
  beatOffset?: number;
  staffLengthCm: number | null;
  leftPlane: Plane;
  rightPlane: Plane;
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
 * Resolves a single scene-scoped directive (formation, environmentId,
 * stepPlanes entries). `sameAs` and `pick: "distinct"` are performer-scoped
 * concepts and have no meaning for a single scene-level value.
 *
 * `streamKey` defaults to `sceneId` (the original, only behavior) — pass a
 * more specific key when several scene-scoped values share the same `axis`
 * name within one scene (e.g. multiple stepPlanes entries all resolve on
 * axis "stepPlane") so each gets its own draw instead of colliding on an
 * identical fresh stream. `sceneId` itself stays the real scene id in error
 * text regardless of `streamKey`.
 */
function resolveSceneDirective<T extends string>(
  value: DirectiveValue<T> | undefined,
  axis: string,
  fallback: () => T,
  sceneId: string,
  seed: FilmSeed,
  catalog: readonly T[],
  streamKey: string = sceneId
): T {
  if (value === undefined) return fallback();
  if (!isDirectiveExpression(value)) return value;
  if ("sameAs" in value || ("pick" in value && value.pick === "distinct")) {
    throw new Error(
      `Scene "${sceneId}": "${axis}" supports literals, pick:any, oneOf, and not — distinct/sameAs are performer-scoped.`
    );
  }
  const [resolved] = resolveCastAxis<T>({
    axis,
    sceneId,
    performerIds: ["scene"],
    values: [value],
    catalog,
    random: createAxisStream(seed, streamKey, axis),
  });
  return resolved!;
}

/**
 * Resolves one performer's effective stepPlanes list. Each entry's `plane`
 * is a scene-scoped directive (see resolveSceneDirective) keyed by axis
 * "stepPlane" so a single `seed.axes.stepPlane` reroll reshuffles every
 * stepPlanes entry across the film, while each (performer, step, hand)
 * triple still draws from its own stream via a distinguishing `streamKey`.
 */
function resolveStepPlanesForPerformer(
  entries: readonly {
    step: number;
    hand: "left" | "right";
    plane: DirectiveValue<Plane>;
  }[],
  performerId: string,
  sceneId: string,
  seed: FilmSeed
): ResolvedDirectorStepPlane[] {
  return entries.map((entry) => ({
    step: entry.step,
    hand: entry.hand,
    plane: resolveSceneDirective<Plane>(
      entry.plane,
      "stepPlane",
      () => {
        throw new Error(
          `Scene "${sceneId}": stepPlanes entry for "${performerId}" at step ${entry.step} is missing a plane.`
        );
      },
      sceneId,
      seed,
      PLANE_CATALOG,
      // NUL-separated like createAxisStream's own key: authored ids may
      // contain spaces, so a space-joined key would be ambiguous.
      `${sceneId}\u0000${performerId}\u0000${entry.step}\u0000${entry.hand === "left" ? "blue" : "red"}`
    ),
  }));
}

function resolveEffectPresets(
  effectPresets: Record<string, string | { pick: "any" }>,
  sceneId: string,
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
          createAxisStream(seed, sceneId, `effectPreset:${effectId}`)
        )
      : undefined;
    if (picked === undefined) {
      throw new Error(
        `Scene "${sceneId}": effect "${effectId}" has no registered presets to pick from.`
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

type FormationLayout = ReturnType<typeof createFormationFromPreset>;
type FormationSlot = FormationLayout["slots"][number];

/**
 * Two conventions collide here. The formation library's "same-direction"
 * default faces +Z, but every director camera fronts the group from -Z
 * (computeFramingScene's wall-plane eye). A film's default cast must face
 * its audience, so same-direction (and slot-less custom rosters) face -Z.
 * Slots with their own facingAngle (circle, back-to-back, ...) keep theirs.
 */
function slotFacingAngle(
  slot: FormationSlot | undefined,
  formation: FormationLayout
): number {
  if (!slot) return AUDIENCE_FACING_ANGLE;
  if (
    slot.facingAngle === undefined &&
    formation.facingMode === "same-direction"
  ) {
    return AUDIENCE_FACING_ANGLE;
  }
  return calculateFacingAngle(slot, formation);
}

function endFormationMarks(
  preset: FormationPreset,
  count: number
): { x: number; z: number }[] {
  if (preset === "custom") {
    throw new Error(
      'Blocking cannot end in a "custom" formation — it has no marks of its own. Name a preset, or give each performer their own blocking.'
    );
  }
  if (!PRESET_VALID_COUNTS[preset].includes(count)) {
    throw new Error(
      `Blocking ends in "${preset}", which does not support ${count} performers.`
    );
  }
  const layout = createFormationFromPreset(preset, count);
  return Array.from({ length: count }, (_, index) => {
    const slot = layout.slots.find((candidate) => candidate.index === index);
    if (!slot) {
      throw new Error(
        `Blocking ends in "${preset}", which has no mark for performer ${index + 1}.`
      );
    }
    return { ...slot.position };
  });
}

/** Close enough to a mark that walking to it would be walking in place. */
const MARK_ARRIVED_METERS = 0.05;

function movesToMark(
  mark: { x: number; z: number },
  start: { x: number; z: number },
  blocking: DirectorSceneBlockingInput
): DirectorBlockingMove[] {
  if (Math.hypot(mark.x - start.x, mark.z - start.z) < MARK_ARRIVED_METERS) {
    return [{ move: "stand", durationSeconds: blocking.durationSeconds }];
  }
  return [
    {
      move: "walk",
      to: mark,
      // Everyone keeps the facing they opened with, so a cast facing its
      // audience travels sideways or backs up into the new formation instead
      // of turning away to walk there.
      facing: blocking.facing ?? "hold",
      durationSeconds: blocking.durationSeconds,
      easing: blocking.easing,
    },
  ];
}

function buildResolvedPerformers(
  inputs: readonly ResolvedPerformerFields[],
  formationPreset: FormationPreset,
  durationSeconds: number,
  sceneBlocking: DirectorSceneBlockingInput | undefined
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
  const marks = sceneBlocking
    ? endFormationMarks(sceneBlocking.endFormation, inputs.length)
    : null;
  const seenIds = new Set<string>();

  return inputs.map((input, index) => {
    const id = input.id;
    if (seenIds.has(id)) throw new Error(`Performer id "${id}" is duplicated.`);
    seenIds.add(id);

    if (
      !CHARACTER_DEFINITIONS.some(
        (character) => character.id === input.characterId
      )
    ) {
      throw new Error(
        `Character "${input.characterId}" is not in the deployed 3D catalog.`
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
        : slotFacingAngle(slot, formation);

    // A performer's own blocking is dictation and wins outright: the director
    // said where this one goes, which is not "and also join the formation."
    const moves =
      input.blocking ??
      (marks && sceneBlocking
        ? movesToMark(marks[index]!, position, sceneBlocking)
        : []);

    return {
      id,
      name: input.name ?? `Performer ${index + 1}`,
      characterId: input.characterId,
      prop: input.prop,
      effect: input.effect,
      effort: input.effort,
      sequence: input.sequence,
      position: { ...position },
      facingAngle,
      blocking: compileBlockingMoves(moves, {
        durationSeconds,
        performerId: id,
        startPosition: position,
        startFacingAngle: facingAngle,
      }),
      beatOffset: input.beatOffset ?? 0,
      staffLengthCm: input.staffLengthCm,
      leftPlane: input.leftPlane,
      rightPlane: input.rightPlane,
      stepPlanes: input.stepPlanes,
    };
  });
}

function resolveScene(
  rawScene: DirectorSceneInput,
  sceneIndex: number,
  startSeconds: number,
  aspectRatio: number,
  filmSeed: FilmSeed
): ResolvedDirectorScene {
  // Beats convert against the scene's own bpm, so bpm resolves first; every
  // line below this one thinks purely in seconds. `stated` tracks whether
  // the director actually wrote a bpm — describeBeats() phrases an
  // unstated fallback as "the default 90 bpm" rather than naming a number
  // the director never typed.
  const bpmStated = rawScene.performance?.bpm !== undefined;
  const bpm = rawScene.performance?.bpm ?? 90;
  const scene = convertSceneBeatTimes(rawScene, {
    value: bpm,
    stated: bpmStated,
  });
  const durationSeconds = scene.durationSeconds ?? 8;
  const cast = scene.performance?.cast;

  const rawInputs: PerformerInput[] = cast
    ? buildCastPerformerInputs(cast)
    : scene.performance?.performers?.length
      ? scene.performance.performers
      : [{}];

  const performerIds = rawInputs.map(
    (input, index) => input.id ?? `performer-${index + 1}`
  );

  // characterId's schema field is an un-narrowed `z.string()` (validated at
  // runtime against the deployed catalog, not by a literal-union schema), so
  // the axis resolves as plain strings and the registry cast happens once on
  // the resolved value below — same pattern this file used pre-directives.
  const characterIdValues: DirectiveValue<string>[] = rawInputs.map(
    (input, index) =>
      input.characterId ??
      cast?.defaults?.characterId ??
      DEFAULT_CHARACTERS[index % DEFAULT_CHARACTERS.length]!
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

  // Pre-validate literal character IDs with the original, more specific error
  // text ("not in the deployed 3D catalog") — resolveCastAxis's own catalog
  // check exists too (needed so a distinct pick still has a pool to draw
  // from), but its generic axis-catalog message is a worse error for the
  // single-character case this file has always reported this way.
  for (const value of characterIdValues) {
    if (isDirectiveExpression(value)) continue;
    if (!CHARACTER_DEFINITIONS.some((character) => character.id === value)) {
      throw new Error(
        `Character "${value}" is not in the deployed 3D catalog.`
      );
    }
  }
  const resolvedCharacterIds = resolveCastAxis<string>({
    axis: "characterId",
    sceneId: scene.id,
    performerIds,
    values: characterIdValues,
    catalog: DEFAULT_CHARACTERS,
    random: createCharacterAxisStream(filmSeed, scene.id),
  });
  const resolvedProps = resolveCastAxis<PropType>({
    axis: "prop",
    sceneId: scene.id,
    performerIds,
    values: propValues,
    catalog: PROP_CATALOG,
    random: createAxisStream(filmSeed, scene.id, "prop"),
  });
  const resolvedEffects = resolveCastAxis<string>({
    axis: "effect",
    sceneId: scene.id,
    performerIds,
    values: effectValues,
    catalog: EFFECT_CATALOG,
    random: createAxisStream(filmSeed, scene.id, "effect"),
  });
  const resolvedEfforts = resolveCastAxis<EffortId>({
    axis: "effort",
    sceneId: scene.id,
    performerIds,
    values: effortValues,
    catalog: EFFORT_CATALOG,
    random: createAxisStream(filmSeed, scene.id, "effort"),
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
        `Scene "${scene.id}", axis "staffLengthCm": sameAs references "${target}", which has no staff length to copy.`
      );
    }
  }
  if (staffIndices.length > 0) {
    const resolved = resolveCastAxis<number>({
      axis: "staffLengthCm",
      sceneId: scene.id,
      performerIds: staffIndices.map((index) => performerIds[index]!),
      values: staffIndices.map((index) => staffLengthStates[index]!),
      catalog: null,
      random: createAxisStream(filmSeed, scene.id, "staffLengthCm"),
    });
    staffIndices.forEach((index, cursor) => {
      resolvedStaffLengths[index] = resolved[cursor]!;
    });
  }

  const leftPlaneValues: DirectiveValue<Plane>[] = rawInputs.map(
    (input) => input.leftPlane ?? cast?.defaults?.leftPlane ?? Plane.WALL
  );
  const rightPlaneValues: DirectiveValue<Plane>[] = rawInputs.map(
    (input) => input.rightPlane ?? cast?.defaults?.rightPlane ?? Plane.WALL
  );
  const resolvedLeftPlanes = resolveCastAxis<Plane>({
    axis: "leftPlane",
    sceneId: scene.id,
    performerIds,
    values: leftPlaneValues,
    catalog: PLANE_CATALOG,
    random: createHandPlaneAxisStream(filmSeed, scene.id, "left"),
  });
  const resolvedRightPlanes = resolveCastAxis<Plane>({
    axis: "rightPlane",
    sceneId: scene.id,
    performerIds,
    values: rightPlaneValues,
    catalog: PLANE_CATALOG,
    random: createHandPlaneAxisStream(filmSeed, scene.id, "right"),
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
        scene.id,
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
    const self = performerIds[index]!;
    assertSequenceDirective(
      sequence,
      `Scene "${scene.id}", performer "${self}"`
    );
    if (!("mirrorOf" in sequence)) return;
    const targetIndex = performerIds.indexOf(sequence.mirrorOf);
    if (sequence.mirrorOf === self) {
      throw new Error(
        `Scene "${scene.id}": performer "${self}" cannot mirror themselves.`
      );
    }
    if (targetIndex < 0) {
      throw new Error(
        `Scene "${scene.id}": performer "${self}" mirrors "${sequence.mirrorOf}", who is not in this scene.`
      );
    }
    if ("mirrorOf" in resolvedSequences[targetIndex]!) {
      throw new Error(
        `Scene "${scene.id}": performer "${self}" mirrors "${sequence.mirrorOf}", who is already a mirror. Mirror the original instead.`
      );
    }
  });

  const resolvedFields: ResolvedPerformerFields[] = rawInputs.map(
    (input, index) => ({
      id: performerIds[index]!,
      name: input.name,
      characterId: resolvedCharacterIds[index]! as CharacterId,
      prop: resolvedProps[index]!,
      effect: resolvedEffects[index]! as EffectType,
      effort: resolvedEfforts[index]!,
      sequence: resolvedSequences[index]!,
      position: input.position,
      facingDegrees: input.facingDegrees,
      blocking: input.blocking ?? cast?.defaults?.blocking,
      beatOffset: input.beatOffset,
      staffLengthCm: resolvedStaffLengths[index]!,
      leftPlane: resolvedLeftPlanes[index]!,
      rightPlane: resolvedRightPlanes[index]!,
      stepPlanes: resolvedStepPlanes[index]!,
    })
  );

  const environmentId = resolveSceneDirective<SceneEnvironmentId>(
    scene.location?.environmentId,
    "environmentId",
    () => contextualEnvironmentFromEffects(resolvedFields.map((f) => f.effect)),
    scene.id,
    filmSeed,
    ENVIRONMENT_CATALOG
  );

  const performerCount = resolvedFields.length;
  const formationCatalog = FORMATION_CATALOG.filter((preset) =>
    PRESET_VALID_COUNTS[preset].includes(performerCount)
  );
  const formation = resolveSceneDirective<FormationPreset>(
    scene.performance?.formation,
    "formation",
    () => defaultFormation(performerCount),
    scene.id,
    filmSeed,
    formationCatalog
  );

  const performers = buildResolvedPerformers(
    resolvedFields,
    formation,
    durationSeconds,
    scene.performance?.blocking
  );

  const showStage = scene.location?.showStage ?? false;
  const showAudience = scene.location?.showAudience ?? false;
  const visiblePlanes = scene.location?.visiblePlanes ?? [];
  const sceneFeatures = {
    environment: true,
    stage: showStage,
    audience: showAudience,
    campfire: false,
    tent: false,
    ...(scene.location?.sceneFeatures ?? {}),
  };
  const effectPresets = resolveEffectPresets(
    scene.effectPresets ?? {},
    scene.id,
    filmSeed
  );
  const effectOverrides = { ...(scene.effectOverrides ?? {}) };
  validateEffectOverrides(effectOverrides);

  const rendererKey = getSceneEnvironmentRendererKey(environmentId);
  const groundOffset = getStageCoordinateFrame(
    rendererKey,
    showStage
  ).performerAnchorY;
  const stageZOffset = getPerformerStageBounds(
    performers.map((performer) => performer.position)
  ).zOffset;
  const cameraTrack = resolveDirectorCameraTrack(scene.camera, {
    durationSeconds,
    aspectRatio,
    groundOffset,
    formation,
    sceneId: scene.id,
    performers: performers.map((performer) => ({
      ...performer,
      position: {
        ...performer.position,
        z: performer.position.z + stageZOffset,
      },
    })),
  });

  // A cut is instantaneous by definition: it has no window to dissolve over.
  // Only a stated duration can give one a length.
  const transitionKind =
    scene.transition?.kind ?? (sceneIndex === 0 ? "cut" : "environment-dissolve");

  return {
    id: scene.id,
    title: scene.title,
    intent: scene.intent ?? null,
    startSeconds,
    durationSeconds,
    transition: {
      kind: transitionKind,
      durationSeconds:
        scene.transition?.durationSeconds ??
        (sceneIndex === 0 || transitionKind === "cut" ? 0 : 0.8),
    },
    location: {
      environmentId,
      showStage,
      showAudience,
      sceneFeatures,
      visiblePlanes,
    },
    performance: {
      bpm,
      sequence: {
        source: "demo",
        loop: scene.performance?.sequence?.loop ?? true,
      },
      formation,
      performers,
      stageExtent: collectStageExtent(performers),
    },
    effectPresets,
    effectOverrides,
    camera: cameraTrack,
  };
}

/**
 * Blocking segments are straight lines between keyframes, so the keyframes
 * themselves bound the whole scene's travel — no sampling needed.
 */
function collectStageExtent(
  performers: readonly ResolvedDirectorPerformer[]
): { x: number; z: number }[] {
  return performers.flatMap((performer) => [
    { ...performer.position },
    ...performer.blocking.map((keyframe) => ({ ...keyframe.position })),
  ]);
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
  const seenSceneIds = new Set<string>();
  let cursorSeconds = 0;

  const scenes = input.scenes.map((scene, index) => {
    if (seenSceneIds.has(scene.id))
      throw new Error(`Scene id "${scene.id}" is duplicated.`);
    seenSceneIds.add(scene.id);
    const resolved = resolveScene(
      scene,
      index,
      cursorSeconds,
      aspectRatio,
      filmSeed
    );
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
    scenes,
    durationSeconds: cursorSeconds,
  };
}
