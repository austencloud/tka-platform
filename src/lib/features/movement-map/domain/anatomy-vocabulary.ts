/**
 * The controlled vocabulary for describing what a body does during a step.
 *
 * The step data already knows where the props are: grid locations, orientations,
 * motion types. None of that belongs here. What the notation cannot say is how a
 * body got the props there - whether the arm passed above the shoulder or below
 * it, where the elbow pointed, whether the torso turned to let the prop into the
 * plane behind the performer. That is what these dimensions capture.
 *
 * Every dimension is optional on every annotation. An observer marks what is
 * notable in the frame in front of them and leaves the rest blank. Demanding all
 * nineteen fields per instant would make a months-long labeling effort
 * impossible to sustain, and a blank field honestly means "not recorded here"
 * rather than a guess.
 *
 * The vocabulary is data, not hardcoded UI. The editor renders itself from these
 * lists, coverage counts against them, and exports name them - so adding a term
 * that observation proves necessary is a one-line change that reaches all three.
 *
 * The thumb-end / pinky-end framing and the negative-space channel come from the
 * project's own domain rules (`.claude/rules/tka-domain.md`): a staff has one
 * consistent thumb reference end and one consistent pinky reference end, and the
 * technique that preserves those references is negative space above and below
 * the shoulder plus body turns to reach the plane behind the performer.
 */

export interface AnatomyValue {
  readonly id: string;
  readonly label: string;
  /** What the observer should be seeing to pick this value. */
  readonly help?: string;
}

export interface AnatomyDimension {
  readonly id: string;
  readonly label: string;
  /** Whether this describes one arm or the whole body. */
  readonly scope: "hand" | "body";
  /** The question this dimension answers about the frame. */
  readonly help: string;
  readonly values: readonly AnatomyValue[];
}

/**
 * Where an end of the prop sits relative to the body. Used for both ends of the
 * staff independently, because the two ends routinely occupy different regions -
 * the phrase "the pinky end falls in front of the body as the thumb end settles"
 * describes exactly one instant with two different answers.
 */
const PROP_END_ZONES: readonly AnatomyValue[] = [
  { id: "overhead", label: "Overhead", help: "Above the crown of the head." },
  {
    id: "behindHead",
    label: "Behind head",
    help: "Passing through the space behind the skull and neck.",
  },
  { id: "besideShoulder", label: "Beside shoulder" },
  { id: "frontOfChest", label: "Front of chest" },
  { id: "frontOfWaist", label: "Front of waist" },
  { id: "besideHip", label: "Beside hip" },
  {
    id: "behindBack",
    label: "Behind back",
    help: "In the plane behind the performer, below shoulder height.",
  },
  { id: "belowKnee", label: "Below knee" },
  {
    id: "outstretched",
    label: "Outstretched",
    help: "Far out from the body on a straight arm.",
  },
];

export const HAND_DIMENSIONS: readonly AnatomyDimension[] = [
  {
    id: "thumbEndZone",
    label: "Thumb end",
    scope: "hand",
    help: "Where the thumb reference end of the prop is.",
    values: PROP_END_ZONES,
  },
  {
    id: "pinkyEndZone",
    label: "Pinky end",
    scope: "hand",
    help: "Where the pinky reference end of the prop is.",
    values: PROP_END_ZONES,
  },
  {
    id: "leadingEnd",
    label: "Leading end",
    scope: "hand",
    help: "Which end of the prop is driving the movement at this instant.",
    values: [
      { id: "thumb", label: "Thumb end leads" },
      { id: "pinky", label: "Pinky end leads" },
      {
        id: "neither",
        label: "Neither",
        help: "Both ends travel together, as in a flat carry.",
      },
    ],
  },
  {
    id: "shoulderChannel",
    label: "Shoulder channel",
    scope: "hand",
    help: "Which gap around the shoulder the arm is using to get the prop through.",
    values: [
      {
        id: "aboveShoulder",
        label: "Above shoulder",
        help: "The negative space over the top of the shoulder.",
      },
      {
        id: "belowShoulder",
        label: "Below shoulder",
        help: "The negative space under the armpit side of the shoulder.",
      },
      { id: "frontOfShoulder", label: "In front of shoulder" },
      { id: "behindShoulder", label: "Behind shoulder" },
      {
        id: "outsideShoulder",
        label: "Outside shoulder",
        help: "Arm swung wide, clear of the torso entirely.",
      },
      {
        id: "noChannel",
        label: "No channel used",
        help: "The arm stays in open space in front of the body.",
      },
    ],
  },
  {
    id: "elbowFlexion",
    label: "Elbow bend",
    scope: "hand",
    help: "How closed the elbow angle is.",
    values: [
      { id: "straight", label: "Straight" },
      { id: "slight", label: "Slightly bent" },
      { id: "right-angle", label: "Right angle" },
      { id: "deep", label: "Deeply folded" },
    ],
  },
  {
    id: "elbowDirection",
    label: "Elbow points",
    scope: "hand",
    help: "Where the point of the elbow aims.",
    values: [
      { id: "down", label: "Down" },
      { id: "outward", label: "Outward" },
      { id: "up", label: "Up" },
      { id: "back", label: "Back" },
      { id: "forward", label: "Forward" },
    ],
  },
  {
    id: "armReach",
    label: "Arm reach",
    scope: "hand",
    help: "How far the hand is from the torso.",
    values: [
      { id: "tucked", label: "Tucked in" },
      { id: "mid", label: "Mid reach" },
      { id: "extended", label: "Fully extended" },
    ],
  },
  {
    id: "wristState",
    label: "Wrist",
    scope: "hand",
    help: "How the wrist sits relative to the forearm.",
    values: [
      { id: "neutral", label: "Neutral" },
      { id: "flexed", label: "Flexed", help: "Palm side closing toward forearm." },
      {
        id: "extended",
        label: "Extended",
        help: "Back of hand closing toward forearm.",
      },
      { id: "radial", label: "Thumb-side cocked" },
      { id: "ulnar", label: "Pinky-side cocked" },
    ],
  },
];

export const BODY_DIMENSIONS: readonly AnatomyDimension[] = [
  {
    id: "torsoYaw",
    label: "Torso facing",
    scope: "body",
    help: "Where the chest points relative to the audience.",
    values: [
      { id: "audience", label: "Square to audience" },
      { id: "quarterLeft", label: "Quarter left" },
      { id: "quarterRight", label: "Quarter right" },
      { id: "sideOnLeft", label: "Side on, left" },
      { id: "sideOnRight", label: "Side on, right" },
      { id: "away", label: "Turned away" },
    ],
  },
  {
    id: "bodyTurn",
    label: "Body turn",
    scope: "body",
    help: "Whether the whole body is rotating through this instant, and which way.",
    values: [
      { id: "none", label: "Not turning" },
      { id: "startingLeft", label: "Starting to turn left" },
      { id: "startingRight", label: "Starting to turn right" },
      { id: "throughLeft", label: "Mid turn, left" },
      { id: "throughRight", label: "Mid turn, right" },
      {
        id: "completingLeft",
        label: "Completing turn, left",
      },
      {
        id: "completingRight",
        label: "Completing turn, right",
      },
    ],
  },
  {
    id: "weightShift",
    label: "Weight",
    scope: "body",
    help: "Where the performer's weight sits.",
    values: [
      { id: "centered", label: "Centered" },
      { id: "left", label: "On left foot" },
      { id: "right", label: "On right foot" },
      { id: "forward", label: "Forward" },
      { id: "back", label: "Back" },
    ],
  },
  {
    id: "headFocus",
    label: "Head",
    scope: "body",
    help: "Where the head is looking, which often leads a body turn.",
    values: [
      { id: "audience", label: "To audience" },
      { id: "followingLeft", label: "Following prop, left" },
      { id: "followingRight", label: "Following prop, right" },
      { id: "up", label: "Up" },
      { id: "down", label: "Down" },
    ],
  },
];

export const ALL_DIMENSIONS: readonly AnatomyDimension[] = [
  ...HAND_DIMENSIONS,
  ...BODY_DIMENSIONS,
];

const DIMENSIONS_BY_ID = new Map(ALL_DIMENSIONS.map((d) => [d.id, d]));

export function getDimension(id: string): AnatomyDimension | undefined {
  return DIMENSIONS_BY_ID.get(id);
}

/**
 * The readable label for a stored value, for exports and summaries. Falls back
 * to the raw id so a term retired from the vocabulary still renders as
 * something rather than vanishing from old annotations.
 */
export function describeValue(dimensionId: string, valueId: string): string {
  const dimension = DIMENSIONS_BY_ID.get(dimensionId);
  const value = dimension?.values.find((v) => v.id === valueId);
  return value?.label ?? valueId;
}
