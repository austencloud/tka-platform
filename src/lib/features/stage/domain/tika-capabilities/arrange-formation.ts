import { z } from "zod";
import { TikaDirectorFormationSchema } from "../tika-director-vocabulary";
import type { TikaCapability, TikaCapabilityVeto } from "./capability";
import { FORMATION_ALIASES, formationLabel } from "./formation-aliases";
import {
  currentDuration,
  normalizeDirectorText,
  statesCount,
} from "./formation-transition";

/**
 * Arrange reshapes the set the playhead sits on, the way the rail's Formation
 * tool does. Exactly one of the three fields is set; the registry veto
 * enforces that because a tool-call schema cannot express "one of".
 */
export const ArrangeFormationSchema = z
  .object({
    type: z.literal("arrange-formation"),
    shape: TikaDirectorFormationSchema.optional(),
    spacing: z.enum(["wider", "tighter"]).optional(),
    shift: z.enum(["forward", "back", "left", "right"]).optional(),
  })
  .strict();
export type ArrangeFormationAction = z.infer<typeof ArrangeFormationSchema>;

const SHAPE_COMMAND =
  /^(?:(?:put|get|place|arrange|set|snap|stand|gather|position) (?:them|everyone|the cast|the performers|the dancers|us|the group|all of them)(?: all| up)? (?:in|into|to|as|on) |(?:make|form|do|try|create|build|give me|show me) |(?:move|go|transition|switch|change|travel|shift|snap|jump|cut) (?:them |everyone |the cast )?(?:over )?(?:to|into|in) |(?:arrange|reshape|reform|rearrange) (?:them |everyone |the cast )?(?:in |into |as |to )?|(?:i want|i need|i would like|let us have|can we have|can we get|we need) (?:them |everyone )?(?:in |to be in |as )?)?(?:a |an |the )?(?<shape>[a-z0-9 ×-]+?)(?: formation| shape| now| right now| for me)*$/;

const INTENSIFIER =
  /^(?:a (?:bit|little|touch|tad|lot) |slightly |much |even |way |just |make (?:them|it|everyone|the cast|the formation|the spacing) )+/;
const SPACING_PHRASES: ReadonlyMap<string, "wider" | "tighter"> = new Map([
  ["wider", "wider"],
  ["widen", "wider"],
  ["widen it", "wider"],
  ["widen the formation", "wider"],
  ["spread out", "wider"],
  ["spread them out", "wider"],
  ["spread everyone out", "wider"],
  ["spread the cast out", "wider"],
  ["more space", "wider"],
  ["more spacing", "wider"],
  ["more room", "wider"],
  ["further apart", "wider"],
  ["farther apart", "wider"],
  ["open up", "wider"],
  ["open it up", "wider"],
  ["looser", "wider"],
  ["bigger", "wider"],
  ["larger", "wider"],
  ["expand", "wider"],
  ["expand it", "wider"],
  ["tighter", "tighter"],
  ["tighten", "tighter"],
  ["tighten up", "tighter"],
  ["tighten it up", "tighter"],
  ["closer", "tighter"],
  ["closer together", "tighter"],
  ["closer in", "tighter"],
  ["less space", "tighter"],
  ["less spacing", "tighter"],
  ["bring them in", "tighter"],
  ["bring them closer", "tighter"],
  ["bring them closer together", "tighter"],
  ["pull them in", "tighter"],
  ["pull them closer", "tighter"],
  ["smaller", "tighter"],
  ["shrink", "tighter"],
  ["shrink it", "tighter"],
  ["squeeze together", "tighter"],
  ["huddle up", "tighter"],
]);

const SHIFT_COMMAND =
  /^(?:(?:shift|move|slide|nudge|step|bring|push|scoot|take) )?(?:them |everyone |the cast |us |it |the group |all of them )?(?:all )?(?:a (?:bit|little|touch|step|metre|meter) |slightly |one metre |one meter |1m |1 m )?(?:over )?(?:to the |to |towards the |toward the |up |down |over to the )?(?<dir>forward|forwards|front|downstage|audience|back|backward|backwards|upstage|left|right)$/;
const SHIFT_DIRECTIONS: ReadonlyMap<
  string,
  "forward" | "back" | "left" | "right"
> = new Map([
  ["forward", "forward"],
  ["forwards", "forward"],
  ["front", "forward"],
  ["downstage", "forward"],
  ["audience", "forward"],
  ["back", "back"],
  ["backward", "back"],
  ["backwards", "back"],
  ["upstage", "back"],
  ["left", "left"],
  ["right", "right"],
]);

function local(command: string): ArrangeFormationAction | null {
  // A count anywhere makes this a move, which is another verb's business.
  if (statesCount(normalizeDirectorText(command))) return null;

  const shapeText = SHAPE_COMMAND.exec(command)?.groups?.shape;
  const shape = shapeText ? FORMATION_ALIASES.get(shapeText) : undefined;
  if (shape) return { type: "arrange-formation", shape };

  const tweak = command
    .replace(INTENSIFIER, "")
    .replace(/ (?:please|now)$/, "");
  const spacing = SPACING_PHRASES.get(tweak);
  if (spacing) return { type: "arrange-formation", spacing };

  const direction = SHIFT_COMMAND.exec(tweak)?.groups?.dir;
  const shift = direction ? SHIFT_DIRECTIONS.get(direction) : undefined;
  if (shift) return { type: "arrange-formation", shift };
  return null;
}

function fieldCount(action: ArrangeFormationAction): number {
  return [action.shape, action.spacing, action.shift].filter(
    (field) => field !== undefined
  ).length;
}

const MIXED_UP =
  "I mixed up that arrangement. Ask for the shape, the spacing, or the shift one at a time.";

function validate(
  request: { prompt: string },
  actions: readonly { type: string }[]
): TikaCapabilityVeto | null {
  const arranges = actions.filter(
    (action): action is ArrangeFormationAction =>
      action.type === "arrange-formation"
  );
  if (arranges.length === 0) return null;
  if (arranges.some((action) => fieldCount(action) !== 1)) {
    return { kind: "unsupported", message: MIXED_UP };
  }
  if (actions.some((action) => action.type === "formation-transition")) {
    return {
      kind: "unsupported",
      message:
        "Arranging now and moving over counts both reshape the same set. Ask for the shape now, or the move with its count, not both.",
    };
  }
  if (
    arranges.length > 2 ||
    (arranges.length === 2 && (!arranges[0]!.shape || arranges[1]!.shape))
  ) {
    return {
      kind: "unsupported",
      message:
        "I can arrange one shape plus one spacing or shift tweak at a time.",
    };
  }
  const shape = arranges[0]!.shape;
  const count = shape
    ? currentDuration(normalizeDirectorText(request.prompt))
    : undefined;
  if (shape && count !== undefined) {
    return {
      kind: "clarify",
      question: `Did you want them in a ${formationLabel(shape)} now, or a move over ${count} counts?`,
    };
  }
  return null;
}

function describe(
  action: ArrangeFormationAction,
  context: { currentBeat: number }
): string {
  const count = Math.max(0, Math.round(context.currentBeat));
  if (action.shape) {
    return `Arranged the cast in a ${formationLabel(action.shape)} at count ${count}. Say "over 8 counts" to make it a move.`;
  }
  if (action.spacing === "wider") {
    return `Spread the cast wider at count ${count}.`;
  }
  if (action.spacing === "tighter") {
    return `Pulled the cast tighter at count ${count}.`;
  }
  return `Shifted the cast ${action.shift} at count ${count}.`;
}

export const arrangeFormationCapability: TikaCapability<ArrangeFormationAction> =
  {
    type: "arrange-formation",
    schema: ArrangeFormationSchema,
    plannerLine:
      "ARRANGE the cast where the playhead sits, adding no timeline movement, like the Stage's Formation tool button. Exactly one field per action: shape (a named formation), spacing ('wider' or 'tighter', one fixed step), or shift ('forward' toward the audience, 'back', 'left', 'right'; one metre). A formation request with NO count is ALWAYS an arrange, even with motion verbs like move, go, transition, snap, or with 'now'. 'A wider circle' is two actions in order: shape, then spacing. 'More' or 'again' repeats the previous tweak from the conversation. The summary names the choice and hints the alternative, e.g. 'Arranging the cast in a line at the current count. Say over 8 counts to make it a move.'",
    reviewerLine:
      "arrange-formation reshapes the current set at the current count with no timeline movement. ACCEPT it whenever the request names a formation, spacing, or shift with NO count, even with the verbs move, go, transition, or snap, or the word now: a missing duration is never a reason to clarify, because the summary already offers the timed move as the alternative. Each action carries exactly one field, so 'a wider circle' is CORRECTLY two actions, {shape:'circle'} then {spacing:'wider'}; accept that pair and never ask for them to be combined. It never appears beside formation-transition.",
    examples: [
      {
        user: "Could you put them in a line",
        response: {
          kind: "apply",
          summary:
            "Arranging the cast in a line at the current count. Say over 8 counts to make it a move.",
          actions: [{ type: "arrange-formation", shape: "line" }],
        },
        note: "No count was stated, so this is an arrangement, not a question.",
      },
      {
        user: "move to a circle",
        response: {
          kind: "apply",
          summary:
            "Arranging the cast in a circle at the current count. Say over 8 counts to make it a move.",
          actions: [{ type: "arrange-formation", shape: "circle" }],
        },
        note: "A motion verb without a count still arranges now.",
      },
      {
        user: "a wider circle",
        response: {
          kind: "apply",
          summary:
            "Arranging a circle at the current count, then spreading it wider.",
          actions: [
            { type: "arrange-formation", shape: "circle" },
            { type: "arrange-formation", spacing: "wider" },
          ],
        },
      },
      {
        user: "a bit wider",
        response: {
          kind: "apply",
          summary: "Spreading the cast wider at the current count.",
          actions: [{ type: "arrange-formation", spacing: "wider" }],
        },
      },
      {
        user: "Different props and transition to a circle.",
        response: {
          kind: "apply",
          summary:
            "Giving every performer a different prop and arranging a circle at the current count. Say over 8 counts to make the circle a move.",
          actions: [
            { type: "assign-distinct-props" },
            { type: "arrange-formation", shape: "circle" },
          ],
        },
        note: "currentBeat is a start position, NEVER a duration.",
      },
    ],
    local,
    validate,
    describe,
  };
