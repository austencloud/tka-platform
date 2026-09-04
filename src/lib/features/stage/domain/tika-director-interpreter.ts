import type {
  TikaDirectorAction,
  TikaDirectorFormation,
  TikaDirectorResponse,
} from "./tika-director";

const PRESENTATION_WORDS =
  /\b(female|feminine|woman|women|girl|girls|male|masculine|man|men|boy|boys|gender)\b/i;
const DISTINCT_WORDS =
  /\b(different|distinct|unique|each (?:gets?|has|with))\b/i;
const PROP_WORDS = /\b(props?|apparatus|implements?)\b/i;
const CHARACTER_WORDS =
  /\b(avatar|avatars|character|characters|model|models)\b/i;

const FORMATION_ALIASES: ReadonlyArray<{
  id: TikaDirectorFormation;
  pattern: RegExp;
}> = [
  { id: "v-shape", pattern: /\bv(?:[-\s]?shape| formation)?\b/i },
  { id: "circle", pattern: /\bcircle\b/i },
  { id: "triangle", pattern: /\btriangle\b/i },
  { id: "diamond", pattern: /\bdiamond\b/i },
  { id: "grid-2x2", pattern: /\b(?:2\s*[x×]\s*2|two by two) grid\b/i },
  { id: "grid", pattern: /\bgrid\b/i },
  { id: "stagger", pattern: /\bstagger(?:ed)?\b/i },
  { id: "cluster", pattern: /\bcluster\b/i },
  { id: "diagonal", pattern: /\bdiagonal\b/i },
  { id: "line", pattern: /\bline\b/i },
  { id: "tunnel-stack", pattern: /\btunnel(?:[-\s]?stack)?\b/i },
  { id: "back-to-back", pattern: /\bback[-\s]?to[-\s]?back\b/i },
  {
    id: "facing-each-other",
    pattern: /\bfacing (?:one another|each other)\b/i,
  },
  { id: "stage-lr", pattern: /\bstage left(?:\s*(?:and|\/|to)\s*)right\b/i },
  { id: "side-by-side", pattern: /\bside[-\s]?by[-\s]?side\b/i },
  { id: "solo", pattern: /\bsolo\b/i },
];

function mentionedFormations(prompt: string): TikaDirectorFormation[] {
  return FORMATION_ALIASES.flatMap(({ id, pattern }) =>
    pattern.test(prompt) ? [id] : []
  );
}

function transitionAction(prompt: string): TikaDirectorAction | null {
  if (!/\b(transition|move|travel|change|go)\b/i.test(prompt)) return null;
  const duration = prompt.match(
    /\b(?:over|for|in)\s+(\d+(?:\.\d+)?)\s*beats?\b/i
  );
  if (!duration) return null;
  const durationBeats = Number(duration[1]);
  if (
    !Number.isInteger(durationBeats) ||
    durationBeats < 1 ||
    durationBeats > 64
  ) {
    return null;
  }
  const formations = mentionedFormations(prompt);
  if (formations.length === 0) return null;
  const endFormation = formations.at(-1)!;
  const startFormation = formations.length > 1 ? formations[0] : undefined;
  return {
    type: "formation-transition",
    ...(startFormation && startFormation !== endFormation
      ? { startFormation }
      : {}),
    endFormation,
    durationBeats,
  };
}

/**
 * Fast, deterministic coverage for the Stage's highest-confidence phrases.
 * Anything outside this tiny grammar goes to the model instead of being
 * guessed by a growing pile of regexes.
 */
export function interpretStageDirectionLocally(
  prompt: string
): TikaDirectorResponse | null {
  if (PRESENTATION_WORDS.test(prompt)) {
    return {
      kind: "clarify",
      question:
        "Stage avatars do not have reliable gender metadata yet. Which specific avatars should I use, or should I make every avatar different and leave presentation unconstrained?",
    };
  }

  const actions: TikaDirectorAction[] = [];
  if (DISTINCT_WORDS.test(prompt) && PROP_WORDS.test(prompt)) {
    actions.push({ type: "assign-distinct-props" });
  }
  if (DISTINCT_WORDS.test(prompt) && CHARACTER_WORDS.test(prompt)) {
    actions.push({ type: "assign-distinct-characters" });
  }
  const formation = transitionAction(prompt);
  if (formation) actions.push(formation);
  if (actions.length === 0) return null;

  const phrases = actions.map((action) => {
    if (action.type === "assign-distinct-props") return "distinct props";
    if (action.type === "assign-distinct-characters") {
      return "distinct avatars";
    }
    const start = action.startFormation ? `${action.startFormation} to ` : "";
    return `${start}${action.endFormation} over ${action.durationBeats} beats`;
  });
  return {
    kind: "apply",
    summary: `Applied ${new Intl.ListFormat("en", { type: "conjunction" }).format(phrases)}.`,
    actions,
  };
}
