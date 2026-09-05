import { z } from "zod";
import {
  TikaDirectorFormationSchema,
  type TikaDirectorFormation,
} from "../tika-director-vocabulary";
import type {
  TikaDirectorRequest,
  TikaDirectorResponse,
} from "../tika-director";
import type { TikaCapability, TikaCapabilityVeto } from "./capability";
import { FORMATION_ALIASES, formationLabel } from "./formation-aliases";

export const FormationTransitionSchema = z
  .object({
    type: z.literal("formation-transition"),
    startFormation: TikaDirectorFormationSchema.optional(),
    endFormation: TikaDirectorFormationSchema,
    durationBeats: z.number().int().min(1).max(64),
  })
  .strict();
export type FormationTransitionAction = z.infer<
  typeof FormationTransitionSchema
>;

const SMALL_NUMBERS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty"] as const;
const NUMBER_WORDS = new Map<string, number>();
for (let value = 1; value <= 64; value++) {
  const word =
    value < 20
      ? SMALL_NUMBERS[value]!
      : `${TENS[Math.floor(value / 10)]}${value % 10 ? ` ${SMALL_NUMBERS[value % 10]}` : ""}`;
  NUMBER_WORDS.set(word, value);
}
const NUMBER_PATTERN = `(?:\\d+|${[...NUMBER_WORDS.keys()].sort((a, b) => b.length - a.length).join("|")})`;
// The Stage timeline labels beats as counts, so both words name the unit. A
// number with no unit after over/in/for is beats too, unless a fraction or a
// foreign unit (seconds, bars, measures) follows. A leading "4 beats" with no
// preposition also counts, but only with the unit spelled out.
const UNIT_PATTERN = "(?:beats?|counts?)";
const FOREIGN_UNIT_PATTERN =
  "(?:seconds?|secs?|minutes?|mins?|bars?|measures?|ms)";
const DURATION_PATTERN = `(?:\\b(?<prep>over|in|for) |^)(?<count>${NUMBER_PATTERN})(?<unit> ${UNIT_PATTERN})?(?![.,]\\d)(?!\\s*${FOREIGN_UNIT_PATTERN}\\b)\\b`;
const TRANSITION_PATTERN =
  /\b(?:transition|move|travel|go|reach|form|snap|arrange|shift|change(?=\s+(?:from|to)\b))\b/g;
const CLAUSE_SPLIT_PATTERN = /[;.!?]|\b(?:and|then|but)\b/;

/** Lower-case, unhyphenated, single-spaced text for the timing patterns. */
export function normalizeDirectorText(text: string): string {
  return text
    .toLowerCase()
    .replace(/(?<=[a-z])-(?=[a-z])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function beatCount(text: string): number | undefined {
  const value = NUMBER_WORDS.get(text) ?? Number(text);
  return Number.isInteger(value) && value >= 1 && value <= 64
    ? value
    : undefined;
}

function hasDelayedStart(text: string): boolean {
  return (
    new RegExp(`\\bat beat\\s*${NUMBER_PATTERN}\\b`).test(text) ||
    new RegExp(`\\b(?:wait|after) ${NUMBER_PATTERN} ${UNIT_PATTERN}\\b`).test(
      text
    ) ||
    new RegExp(
      `\\bin ${NUMBER_PATTERN} ${UNIT_PATTERN}\\s*,?\\s*(?:then |please )?(?:transition|move|travel|go|change|reach)\\b`
    ).test(text)
  );
}

function durationMatches(text: string) {
  return [...text.matchAll(new RegExp(DURATION_PATTERN, "g"))].filter(
    (match) => match.groups?.prep || match.groups?.unit
  );
}

/** True when the normalized text states a beat count anywhere. */
export function statesCount(text: string): boolean {
  return durationMatches(text).length > 0;
}

/** The one beat count the normalized text pins to its move, if any. */
export function currentDuration(text: string): number | undefined {
  const durations = durationMatches(text);
  if (durations.length !== 1) return undefined;
  const duration = durations[0]!;
  const transitions = [...text.matchAll(TRANSITION_PATTERN)];
  const transition = transitions.at(-1);
  // A single clause with one duration and no verb ("from a row to a ring over
  // 4 beats", "4 beats circle") can only be timing the move itself.
  if (!transition) {
    return CLAUSE_SPLIT_PATTERN.test(text)
      ? undefined
      : beatCount(duration.groups!.count!);
  }

  if (transition.index < duration.index) {
    const between = text.slice(transition.index, duration.index);
    // Timing on a separate clause can describe props or an earlier instruction.
    if (CLAUSE_SPLIT_PATTERN.test(between)) return undefined;
  } else {
    const prefix = text.slice(0, duration.index);
    const between = text.slice(
      duration.index + duration[0].length,
      transition.index
    );
    if (prefix || !/^,?\s*(?:please\s+)?$/.test(between)) return undefined;
  }
  return beatCount(duration.groups!.count!);
}

function clarificationDuration(
  request: Pick<TikaDirectorRequest, "prompt" | "conversation">
): number | undefined {
  const question = request.conversation.at(-1);
  const pending = request.conversation.at(-2);
  if (
    question?.role !== "assistant" ||
    pending?.role !== "user" ||
    !/\b(?:how many (?:beats|counts)|how long|what duration|which duration)\b[^?]*\?/i.test(
      question.content
    ) ||
    /\b(?:applied|completed|finished)\b/i.test(question.content)
  )
    return undefined;

  const pendingText = normalizeDirectorText(pending.content);
  if (
    !new RegExp(TRANSITION_PATTERN.source).test(pendingText) ||
    hasDelayedStart(pendingText)
  )
    return undefined;

  const answer = new RegExp(
    `^(?:over |in |for )?(${NUMBER_PATTERN})(?: ${UNIT_PATTERN})?[.!]?$`
  ).exec(normalizeDirectorText(request.prompt));
  return answer ? beatCount(answer[1]!) : undefined;
}

/**
 * A model may mistake the playhead or a past command for permission to choose
 * timing. This gate only rejects a plan; it never supplies or changes actions.
 * A missing count offers the arrange path, because without a count the
 * request was an arrangement the planner misread as a move.
 */
function timingVeto(
  request: Pick<TikaDirectorRequest, "prompt" | "conversation">,
  actions: readonly { type: string }[]
): TikaCapabilityVeto | null {
  const transitions = actions.filter(
    (action): action is FormationTransitionAction =>
      action.type === "formation-transition"
  );
  if (transitions.length === 0) return null;

  const prompt = normalizeDirectorText(request.prompt);
  if (hasDelayedStart(prompt)) {
    return {
      kind: "unsupported",
      message:
        "I can start a transition at the current beat, but cannot schedule a delayed start yet.",
    };
  }
  const duration = currentDuration(prompt) ?? clarificationDuration(request);
  if (
    duration === undefined ||
    transitions.length !== 1 ||
    transitions[0]!.durationBeats !== duration
  ) {
    const destination =
      transitions.length === 1
        ? ` in a ${formationLabel(transitions[0]!.endFormation)}`
        : "";
    return {
      kind: "clarify",
      question: `Arrange them${destination} now, or move over how many counts?`,
    };
  }
  return null;
}

export function validateTikaDirectorPlanTiming(
  request: Pick<TikaDirectorRequest, "prompt" | "conversation">,
  response: TikaDirectorResponse
): TikaDirectorResponse {
  if (response.kind !== "apply") return response;
  return timingVeto(request, response.actions) ?? response;
}

const TRANSITION_COMMANDS = [
  /^(?:transition|move|travel|go) from (?:a |the )?(?<start>.+?) to (?:a |the )?(?<end>.+?) (?:over|in) (?<beats>\d+) (?:beats?|counts?)$/,
  /^(?:transition|move|travel|go) to (?:a |the )?(?<end>.+?) (?:over|in) (?<beats>\d+) (?:beats?|counts?)$/,
  /^put them(?: all)? in (?:a |the )?(?<start>.+?)(?:,? then | and (?:have them )?)transition to (?:a |the )?(?<end>.+?) over (?<beats>\d+) (?:beats?|counts?)$/,
] as const;

function local(command: string): FormationTransitionAction | null {
  for (const pattern of TRANSITION_COMMANDS) {
    const groups = pattern.exec(command)?.groups;
    if (!groups) continue;
    const endFormation = FORMATION_ALIASES.get(groups.end!);
    const startFormation = groups.start
      ? FORMATION_ALIASES.get(groups.start)
      : undefined;
    const durationBeats = Number(groups.beats);
    if (
      !endFormation ||
      (groups.start && !startFormation) ||
      durationBeats < 1 ||
      durationBeats > 64
    ) {
      return null;
    }
    return {
      type: "formation-transition",
      ...(startFormation ? { startFormation } : {}),
      endFormation,
      durationBeats,
    };
  }
  return null;
}

function describeMove(
  end: TikaDirectorFormation,
  durationBeats: number,
  start: TikaDirectorFormation | undefined,
  currentBeat: number
): string {
  const from = start ? `from a ${formationLabel(start)} ` : "";
  return `Moving the cast ${from}to a ${formationLabel(end)} over ${durationBeats} counts, starting at count ${currentBeat}.`;
}

export const formationTransitionCapability: TikaCapability<FormationTransitionAction> =
  {
    type: "formation-transition",
    schema: FormationTransitionSchema,
    plannerLine:
      "a timed MOVE: at the request's current beat, optionally establish a named start formation, then reach a named destination in 1–64 integer beats (counts). Only a stated count makes a move; a formation request without one is arrange-formation.",
    reviewerLine:
      "formation-transition starts at the current beat, optionally establishes a named start formation, and reaches the named end in 1–64 integer beats. At most one transition. No delayed starts. An explicit named start is intentional even when the scene currently has another formation. Its duration must come from the user's request or an unambiguous answer to a duration question, never the current beat. Any formation request WITH a stated count ('put them in a line over 8 counts', 'circle in 4') is a formation-transition with that duration whatever the verb: accept it. A formation request with no count is arrange-formation, not a transition to reject.",
    examples: [
      {
        user: "4 beats circle",
        response: {
          kind: "apply",
          summary: "Moving to a circle over 4 counts.",
          actions: [
            {
              type: "formation-transition",
              endFormation: "circle",
              durationBeats: 4,
            },
          ],
        },
      },
      {
        user: "Transition from circle to V shape over four beats.",
        response: {
          kind: "apply",
          summary: "Moving from a circle to a V over 4 counts.",
          actions: [
            {
              type: "formation-transition",
              startFormation: "circle",
              endFormation: "v-shape",
              durationBeats: 4,
            },
          ],
        },
      },
      {
        user: "In eight beats, move to a circle over four beats.",
        response: {
          kind: "unsupported",
          message:
            "I can start a transition at the current beat only. Seek to your desired start beat, then request the four-beat transition.",
        },
      },
    ],
    local,
    validate: timingVeto,
    describe: (action, context) =>
      describeMove(
        action.endFormation,
        action.durationBeats,
        action.startFormation,
        context.currentBeat
      ),
  };
