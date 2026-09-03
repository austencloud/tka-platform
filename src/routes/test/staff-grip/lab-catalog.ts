/**
 * What the lab can put on stage.
 *
 * The lab compares one grip problem across bodies, props and sequences, so it
 * needs every axis to come from the same catalogs the product ships. Nothing
 * here invents a character, a prop or a sequence: this module only names the
 * subsets the lab can reach and registers the locally staged intake rigs that
 * deliberately never enter the deployable catalog.
 */
import {
  AVATAR_DEFINITIONS,
  type AvatarDefinition,
  type AvatarId,
} from "@austencloud/scene-3d";

import {
  CHARACTER_DEFINITIONS,
  type CharacterDefinition,
  type CharacterId,
} from "$lib/shared/3d/domain/character-model";
import {
  registerProportionSweepCharacters,
  type ProportionSweepCharacter,
} from "$lib/shared/3d/domain/proportion-sweep-characters";
import {
  SCENE_PROP_FAMILIES,
  SCENE_PROP_TYPES,
} from "$lib/shared/3d/domain/scene-prop-catalog";
import { ALL_FIXTURE_LOOPS } from "$lib/shared/combination/domain/demo-fixtures";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { loadByIdentifier } from "$lib/shared/sequence-viewer/services/sequence-data-provider";

/**
 * Rigs that exist on this machine under `static/models/avatars/bakeoff/` but
 * are not part of the deployable catalog. `personal-metaperson` already ships
 * as a `local-evaluation` definition inside the scene package; `intake-current`
 * is the slot the latest hand-staged intake lands in, so it has to be
 * registered from the product side.
 *
 * This used to happen inside the render component, which meant the push ran on
 * every stage instantiation and the catalog's contents depended on whether a
 * canvas had mounted yet. Registering here — once, at module load, before any
 * picker reads the catalog — is the honest version of the same seam.
 */
const LOCAL_INTAKE_DEFINITIONS: readonly AvatarDefinition[] = [
  {
    id: "intake-current" as AvatarId,
    name: "Current intake",
    modelPath: "/models/avatars/bakeoff/intake-current.glb",
    icon: "fa-person-rays",
    description: "Latest locally staged character intake",
    availability: "local-evaluation",
  },
];

function registerLocalIntakeCharacters(): void {
  for (const definition of LOCAL_INTAKE_DEFINITIONS) {
    if (AVATAR_DEFINITIONS.some(({ id }) => id === definition.id)) continue;
    AVATAR_DEFINITIONS.push(definition);
  }
}

registerLocalIntakeCharacters();

/**
 * The controlled proportion sweep: one licensed base rig with exactly one body
 * dimension moved per copy. The deployed catalog varies every dimension at
 * once, so a catalog body that fails the hug fit cannot say which dimension
 * caused it. These can, which is the difference between a lab that reproduces
 * a failure and one that explains it.
 *
 * The GLBs are gitignored, so a checkout without them registers ten characters
 * whose models 404. That is the same trade the intake rig already makes and
 * the same reason neither is the default: the lab opens on a CDN body, and
 * these are one pick away for whoever has them.
 */
const LAB_SWEEP_CHARACTERS = registerProportionSweepCharacters();

const LAB_SWEEP_BY_ID = new Map<string, ProportionSweepCharacter>(
  LAB_SWEEP_CHARACTERS.map((character) => [character.id as string, character])
);

/** The sweep record behind a character, when the character is a sweep body. */
export function labSweepCharacter(
  id: string
): ProportionSweepCharacter | undefined {
  return LAB_SWEEP_BY_ID.get(id);
}

/** What a sweep body's axis is called in the lab's own vocabulary. */
export const LAB_SWEEP_AXIS_LABEL: Readonly<
  Record<ProportionSweepCharacter["axis"], string>
> = {
  none: "Control",
  stature: "Stature",
  shoulderWidth: "Shoulder width",
  armLength: "Arm length",
  armSegmentRatio: "Arm segment ratio",
  torsoGirth: "Build",
};

/**
 * The body the lab opens on.
 *
 * Not the intake rig, deliberately. `intake-current.glb` is gitignored local
 * evaluation material, so a fresh checkout that defaults to it opens on an
 * empty stage with no explanation. A catalog character streams from the CDN
 * and is there for everyone. The intake rig stays one pick away, and any URL
 * naming it still resolves.
 */
export const DEFAULT_LAB_CHARACTER_ID = "ch07" as CharacterId;

/**
 * Every character the lab can pose, catalog and local intake alike. Read
 * through the product's own character vocabulary rather than the package's
 * avatar names, per `.claude/rules/3d-character-terminology.md`.
 */
export function labCharacters(): readonly CharacterDefinition[] {
  return CHARACTER_DEFINITIONS;
}

export function labCharacter(id: string): CharacterDefinition | undefined {
  return CHARACTER_DEFINITIONS.find((definition) => definition.id === id);
}

export function isLabCharacterId(id: string): id is CharacterId {
  return labCharacter(id) !== undefined;
}

export function labCharacterName(id: string): string {
  return labCharacter(id)?.name ?? id;
}

/** True for a rig that only exists on this machine. */
export function isLocalOnlyCharacter(id: string): boolean {
  return labCharacter(id)?.availability === "local-evaluation";
}

/** Every prop the shared 3D catalog supports. The lab reaches all of them. */
export const LAB_PROP_TYPES: readonly PropType[] = SCENE_PROP_TYPES;

const LAB_PROP_TYPE_SET = new Set<PropType>(LAB_PROP_TYPES);

export function isLabPropType(value: string): value is PropType {
  return LAB_PROP_TYPE_SET.has(value as PropType);
}

/** The catalog's own label for a prop, so the lab never writes its own. */
export function labPropLabel(prop: PropType): string {
  for (const family of SCENE_PROP_FAMILIES) {
    const variant = family.variants.find(({ id }) => id === prop);
    if (variant) return variant.label;
  }
  return prop;
}

/**
 * A repeating word always shows in its smallest form, so a four-step GGGG loop
 * reads as "G". Two fixtures can simplify to the same word, so the fixture
 * key's own rotation suffix disambiguates them.
 */
export function labSequenceLabel(
  sequence: SequenceData,
  fixtureKey?: string
): string {
  const word = simplifyRepeatedWord(sequence.word ?? sequence.id);
  const rotation = fixtureKey?.match(/_(CCW|CW)$/i)?.[1]?.toLowerCase();
  return rotation ? `${word} ${rotation}` : word;
}

export interface LabSequenceOption {
  id: string;
  label: string;
  stepCount: number;
  sequence: SequenceData;
}

/**
 * The verified fixture loops. Every one is an exact row set of
 * `DiamondPictographDataframe.csv` and is enforced by
 * `tests/unit/combination/fixtures.test.ts`, so they are stable targets that
 * need neither a network round trip nor a signed-in library.
 */
export const LAB_FIXTURES: readonly LabSequenceOption[] = ALL_FIXTURE_LOOPS.map(
  ([fixtureKey, sequence]) => ({
    id: sequence.id,
    label: labSequenceLabel(sequence, fixtureKey),
    stepCount: sequence.steps.length,
    sequence,
  })
);

/** The fixture the existing grip verification runs against. */
export const DEFAULT_LAB_SEQUENCE_ID = "fx-falg";

export function labFixture(id: string): LabSequenceOption | undefined {
  return LAB_FIXTURES.find((option) => option.id === id);
}

/**
 * Turn a sequence id from the URL back into a sequence. Fixtures resolve
 * synchronously; anything else is a real library or community sequence and
 * goes through the product's own identifier loader, which is what makes a
 * pasted lab URL reproduce a library sequence on a cold load.
 */
export async function resolveLabSequence(
  id: string
): Promise<SequenceData | null> {
  const fixture = labFixture(id);
  if (fixture) return fixture.sequence;
  return loadByIdentifier(id);
}
