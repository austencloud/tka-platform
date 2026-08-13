import {
  calculateEndOrientation,
  type MotionData as EngineMotionData,
} from "@tka/sequence-engine";
import {
  DEFAULT_FLIPPED_AXIS,
  DEFAULT_MIRRORED_AXIS,
  LOCATION_MAP_CLOCKWISE,
  LOOPComponent,
  loopSpecToWire,
  reflectLocation,
  type PropLOOPSpecWire,
} from "@tka/sequence-engine/loop";
import {
  buildInvertedSoloLoop,
  buildReflectedSoloLoop,
  buildRewoundSoloLoop,
  buildRotatedSoloLoop,
  detectSoloLOOP,
} from "@tka/sequence-engine/loop/solo";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/solo-prop-data";
import type { SoloPropStepData } from "$lib/shared/foundation/domain/models/solo-prop-step-data";
import { createSoloProp } from "$lib/shared/foundation/services/solo-prop-factory";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
import {
  GridMode,
  type GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  type Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  isVisibleMotion,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";

export interface GeneratedSoloLoop {
  readonly solo: SoloPropData;
  readonly loopSpec: PropLOOPSpecWire;
}

function soloStepsToEngineMotions(
  steps: readonly SoloPropStepData[]
): EngineMotionData[] {
  return steps.map((step) => ({
    motionType: step.motionType,
    startLocation: step.startLocation,
    endLocation: step.endLocation,
    rotationDirection: step.rotationDirection,
    turns: step.turns,
    startOrientation: step.startOrientation,
    endOrientation: step.endOrientation,
    ...(step.prefloatMotionType
      ? { prefloatMotionType: step.prefloatMotionType }
      : {}),
  })) as EngineMotionData[];
}

export function isStructuredSoloLoop(solo: SoloPropData): boolean {
  return detectSoloLOOP(soloStepsToEngineMotions(solo.steps)).isLoop;
}

let diamondMotionTemplates: Promise<readonly MotionData[]> | null = null;

function motionSignature(motion: MotionData): string {
  return [
    motion.motionType,
    motion.startLocation,
    motion.endLocation,
    motion.rotationDirection,
    motion.turns,
    motion.handPath ?? "",
  ].join(":");
}

async function loadDiamondMotionTemplates(): Promise<readonly MotionData[]> {
  if (diamondMotionTemplates) return diamondMotionTemplates;

  diamondMotionTemplates = letterQueryHandler
    .getAllPictographVariations(GridMode.DIAMOND)
    .then((pictographs) => {
      const unique = new Map<string, MotionData>();
      for (const pictograph of pictographs) {
        for (const color of [MotionColor.BLUE, MotionColor.RED] as const) {
          const motion = pictograph.motions[color];
          if (!isVisibleMotion(motion)) continue;
          unique.set(motionSignature(motion), motion);
        }
      }
      return [...unique.values()];
    })
    .catch((error) => {
      diamondMotionTemplates = null;
      throw error;
    });

  return diamondMotionTemplates;
}

function randomItem<T>(items: readonly T[], random: () => number): T {
  if (items.length === 0)
    throw new RangeError("Cannot pick from an empty list");
  return items[Math.floor(random() * items.length) % items.length]!;
}

function instantiateMotion(
  template: MotionData,
  startOrientation: string
): EngineMotionData {
  const motion: EngineMotionData = {
    motionType: template.motionType,
    startLocation: template.startLocation,
    endLocation: template.endLocation,
    rotationDirection: template.rotationDirection,
    turns: template.turns,
    startOrientation: startOrientation as EngineMotionData["startOrientation"],
    endOrientation: startOrientation as EngineMotionData["endOrientation"],
    ...(template.prefloatMotionType
      ? { prefloatMotionType: template.prefloatMotionType }
      : {}),
    ...(template.prefloatRotationDirection
      ? { prefloatRotationDirection: template.prefloatRotationDirection }
      : {}),
  };
  return {
    ...motion,
    endOrientation: calculateEndOrientation(motion),
  };
}

function toSoloStep(motion: EngineMotionData): SoloPropStepData {
  return {
    startLocation: motion.startLocation as GridLocation,
    endLocation: motion.endLocation as GridLocation,
    startOrientation: motion.startOrientation as Orientation,
    endOrientation: motion.endOrientation as Orientation,
    motionType: motion.motionType as SoloPropStepData["motionType"],
    rotationDirection:
      motion.rotationDirection as SoloPropStepData["rotationDirection"],
    turns: motion.turns,
    duration: 1,
    ...(motion.prefloatMotionType
      ? {
          prefloatMotionType:
            motion.prefloatMotionType as SoloPropStepData["prefloatMotionType"],
        }
      : {}),
  };
}

function generatedFromMotions(
  motions: readonly EngineMotionData[],
  name = "Generated solo LOOP"
): GeneratedSoloLoop {
  const detection = detectSoloLOOP(motions);
  if (!detection.isLoop || !detection.spec) {
    throw new Error("Generated solo path failed structured LOOP validation");
  }
  const steps = motions.map(toSoloStep);
  const solo = createSoloProp(
    steps,
    steps[0]!.startLocation,
    steps[0]!.startOrientation,
    { name }
  );
  const loopSpec = loopSpecToWire({ blue: detection.spec }).blue;
  if (!loopSpec)
    throw new Error("Generated solo LOOP is missing its prop spec");
  return { solo, loopSpec };
}

/**
 * Generate a genuine color-neutral one-prop LOOP from the canonical motion
 * vocabulary. It never samples a public or paired sequence. A free seed walk
 * is generated first, then closed through the REWOUND primitive.
 */
export function generateRewoundSoloLoopFromMotions(
  templates: readonly MotionData[],
  length: number,
  random: () => number = Math.random
): GeneratedSoloLoop {
  if (!Number.isInteger(length) || length < 2 || length % 2 !== 0) {
    throw new RangeError("A generated solo LOOP needs a positive even length");
  }
  if (templates.length === 0) {
    throw new Error(
      "No canonical motions are available for solo LOOP generation"
    );
  }

  const byStart = new Map<string, MotionData[]>();
  for (const template of templates) {
    const bucket = byStart.get(template.startLocation) ?? [];
    bucket.push(template);
    byStart.set(template.startLocation, bucket);
  }

  const seedLength = length / 2;
  const firstTemplate = randomItem(templates, random);
  const seed: EngineMotionData[] = [];
  let nextLocation = firstTemplate.startLocation;
  let nextOrientation = firstTemplate.startOrientation;

  for (let index = 0; index < seedLength; index += 1) {
    const candidates = byStart.get(nextLocation) ?? [];
    if (candidates.length === 0) {
      throw new Error(`The solo motion graph has no exit from ${nextLocation}`);
    }
    const template =
      index === 0 ? firstTemplate : randomItem(candidates, random);
    const motion = instantiateMotion(template, nextOrientation);
    seed.push(motion);
    nextLocation = motion.endLocation;
    nextOrientation = motion.endOrientation;
  }

  return generatedFromMotions(buildRewoundSoloLoop(seed));
}

type GeneratedComponent =
  | "rotated-quartered"
  | "rotated-halved"
  | "mirrored"
  | "flipped"
  | "inverted";

function rotateQuarterTurns(location: string, amount: number): string {
  let result = location;
  for (let index = 0; index < amount; index += 1) {
    result = LOCATION_MAP_CLOCKWISE[result] ?? result;
  }
  return result;
}

function findSeedToTarget(
  templates: readonly MotionData[],
  seedLength: number,
  targetForStart: (start: string) => string,
  random: () => number
): EngineMotionData[] | null {
  const byStart = new Map<string, MotionData[]>();
  for (const template of templates) {
    const bucket = byStart.get(template.startLocation) ?? [];
    bucket.push(template);
    byStart.set(template.startLocation, bucket);
  }

  for (let attempt = 0; attempt < 96; attempt += 1) {
    const first = randomItem(templates, random);
    const target = targetForStart(first.startLocation);
    const seed: EngineMotionData[] = [];
    let location = first.startLocation;
    let orientation = first.startOrientation;
    let failed = false;

    for (let index = 0; index < seedLength; index += 1) {
      const allCandidates = byStart.get(location) ?? [];
      const candidates =
        index === seedLength - 1
          ? allCandidates.filter((motion) => motion.endLocation === target)
          : allCandidates;
      if (candidates.length === 0) {
        failed = true;
        break;
      }
      const template = index === 0 ? first : randomItem(candidates, random);
      if (index === seedLength - 1 && template.endLocation !== target) {
        failed = true;
        break;
      }
      const motion = instantiateMotion(template, orientation);
      seed.push(motion);
      location = motion.endLocation;
      orientation = motion.endOrientation;
    }
    if (!failed && seed.length === seedLength && location === target)
      return seed;
  }
  return null;
}

function tryGenerateComponent(
  templates: readonly MotionData[],
  length: number,
  component: GeneratedComponent,
  random: () => number
): GeneratedSoloLoop | null {
  const period = component === "rotated-quartered" ? 4 : 2;
  if (length % period !== 0) return null;
  const seedLength = length / period;
  const targetForStart = (start: string): string => {
    switch (component) {
      case "rotated-quartered":
        return rotateQuarterTurns(start, 1);
      case "rotated-halved":
        return rotateQuarterTurns(start, 2);
      case "mirrored":
        return reflectLocation(start, DEFAULT_MIRRORED_AXIS) ?? start;
      case "flipped":
        return reflectLocation(start, DEFAULT_FLIPPED_AXIS) ?? start;
      case "inverted":
        return start;
    }
  };
  const seed = findSeedToTarget(templates, seedLength, targetForStart, random);
  if (!seed) return null;

  let motions: EngineMotionData[];
  switch (component) {
    case "rotated-quartered":
      motions = buildRotatedSoloLoop(seed, 4);
      break;
    case "rotated-halved":
      motions = buildRotatedSoloLoop(seed, 2);
      break;
    case "mirrored":
      motions = buildReflectedSoloLoop(seed, LOOPComponent.MIRRORED);
      break;
    case "flipped":
      motions = buildReflectedSoloLoop(seed, LOOPComponent.FLIPPED);
      break;
    case "inverted":
      motions = buildInvertedSoloLoop(seed);
      break;
  }

  try {
    return generatedFromMotions(motions);
  } catch {
    return null;
  }
}

export function generateStructuredSoloLoopFromMotions(
  templates: readonly MotionData[],
  length: number,
  random: () => number = Math.random
): GeneratedSoloLoop {
  const components: GeneratedComponent[] = [
    ...(length % 4 === 0 ? (["rotated-quartered"] as const) : []),
    "rotated-halved",
    "mirrored",
    "flipped",
    "inverted",
  ];
  const offset = Math.floor(random() * components.length) % components.length;
  for (let index = 0; index < components.length; index += 1) {
    const component = components[(offset + index) % components.length]!;
    const generated = tryGenerateComponent(
      templates,
      length,
      component,
      random
    );
    if (generated) return generated;
  }
  return generateRewoundSoloLoopFromMotions(templates, length, random);
}

export async function generateSoloLoop(
  length: number,
  random: () => number = Math.random
): Promise<GeneratedSoloLoop> {
  const templates = await loadDiamondMotionTemplates();
  return generateStructuredSoloLoopFromMotions(templates, length, random);
}

/** Use an authored one-hand path as the seed of a structured rewound LOOP. */
export function closeSoloPathAsRewoundLoop(
  source: SoloPropData,
  length: number
): GeneratedSoloLoop {
  if (!Number.isInteger(length) || length < 2 || length % 2 !== 0) {
    throw new RangeError("A generated solo LOOP needs a positive even length");
  }
  const seedLength = length / 2;
  if (source.steps.length < seedLength) {
    throw new RangeError(
      `This path needs at least ${seedLength} steps to make a ${length}-step LOOP`
    );
  }
  const seed = soloStepsToEngineMotions(source.steps.slice(0, seedLength));
  const motions = buildRewoundSoloLoop(seed);
  const detection = detectSoloLOOP(motions);
  if (!detection.isLoop || !detection.spec) {
    throw new Error(
      "The selected path is not continuous enough to close as a LOOP"
    );
  }
  const steps = motions.map(toSoloStep);
  const solo = createSoloProp(
    steps,
    steps[0]!.startLocation,
    steps[0]!.startOrientation,
    { name: source.name ?? "Selected solo LOOP" }
  );
  const loopSpec = loopSpecToWire({ blue: detection.spec }).blue;
  if (!loopSpec) throw new Error("Selected solo LOOP is missing its prop spec");
  return { solo, loopSpec };
}
