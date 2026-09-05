import type {
  TikaDirectorRequest,
  TikaDirectorResponse,
} from "./tika-director";

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

function normalize(text: string): string {
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

function currentDuration(text: string): number | undefined {
  const durations = [
    ...text.matchAll(new RegExp(DURATION_PATTERN, "g")),
  ].filter((match) => match.groups?.prep || match.groups?.unit);
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
    !/\b(?:how many beats|how long|what duration|which duration)\b[^?]*\?/i.test(
      question.content
    ) ||
    /\b(?:applied|completed|finished)\b/i.test(question.content)
  )
    return undefined;

  const pendingText = normalize(pending.content);
  if (
    !new RegExp(TRANSITION_PATTERN.source).test(pendingText) ||
    hasDelayedStart(pendingText)
  )
    return undefined;

  const answer = new RegExp(
    `^(?:over |in |for )?(${NUMBER_PATTERN})(?: ${UNIT_PATTERN})?[.!]?$`
  ).exec(normalize(request.prompt));
  return answer ? beatCount(answer[1]!) : undefined;
}

/**
 * A model may mistake the playhead or a past command for permission to choose
 * timing. This gate only rejects a plan; it never supplies or changes actions.
 */
export function validateTikaDirectorPlanTiming(
  request: Pick<TikaDirectorRequest, "prompt" | "conversation">,
  response: TikaDirectorResponse
): TikaDirectorResponse {
  if (response.kind !== "apply") return response;
  const transitions = response.actions.filter(
    (action) => action.type === "formation-transition"
  );
  if (transitions.length === 0) return response;

  const prompt = normalize(request.prompt);
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
    return {
      kind: "clarify",
      question: "How many beats should the transition take?",
    };
  }
  return response;
}
