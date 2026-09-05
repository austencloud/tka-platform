import type {
  TikaDirectorAction,
  TikaDirectorFormation,
  TikaDirectorPresentation,
  TikaDirectorResponse,
} from "./tika-director";

const PRESENTATION_WORDS: ReadonlyMap<string, TikaDirectorPresentation> =
  new Map([
    ["feminine", "feminine"],
    ["female", "feminine"],
    ["women", "feminine"],
    ["woman", "feminine"],
    ["girls", "feminine"],
    ["ladies", "feminine"],
    ["masculine", "masculine"],
    ["male", "masculine"],
    ["men", "masculine"],
    ["man", "masculine"],
    ["guys", "masculine"],
    ["boys", "masculine"],
    ["androgynous", "androgynous"],
    ["nonbinary", "androgynous"],
    ["non-binary", "androgynous"],
    ["gender neutral", "androgynous"],
    ["gender-neutral", "androgynous"],
  ]);
const PRESENTATION_COMMAND =
  /^make (?:every avatar|all(?: of)? the avatars|the avatars(?: all)?) (?:a |all )?(?<look>[a-z -]+?)$/;

const FORMATION_ALIASES: ReadonlyMap<string, TikaDirectorFormation> = new Map([
  ["v", "v-shape"],
  ["v shape", "v-shape"],
  ["v-shape", "v-shape"],
  ["v formation", "v-shape"],
  ["circle", "circle"],
  ["triangle", "triangle"],
  ["diamond", "diamond"],
  ["2x2 grid", "grid-2x2"],
  ["2×2 grid", "grid-2x2"],
  ["two by two grid", "grid-2x2"],
  ["grid-2x2", "grid-2x2"],
  ["grid", "grid"],
  ["stagger", "stagger"],
  ["staggered", "stagger"],
  ["cluster", "cluster"],
  ["diagonal", "diagonal"],
  ["line", "line"],
  ["tunnel", "tunnel-stack"],
  ["tunnel stack", "tunnel-stack"],
  ["tunnel-stack", "tunnel-stack"],
  ["back to back", "back-to-back"],
  ["back-to-back", "back-to-back"],
  ["facing each other", "facing-each-other"],
  ["facing one another", "facing-each-other"],
  ["facing-each-other", "facing-each-other"],
  ["stage left and right", "stage-lr"],
  ["stage-lr", "stage-lr"],
  ["side by side", "side-by-side"],
  ["side-by-side", "side-by-side"],
  ["solo", "solo"],
]);

const TRANSITION_COMMANDS = [
  /^(?:transition|move|travel|go) from (?:a |the )?(?<start>.+?) to (?:a |the )?(?<end>.+?) (?:over|in) (?<beats>\d+) (?:beats?|counts?)$/,
  /^(?:transition|move|travel|go) to (?:a |the )?(?<end>.+?) (?:over|in) (?<beats>\d+) (?:beats?|counts?)$/,
  /^put them(?: all)? in (?:a |the )?(?<start>.+?)(?:,? then | and (?:have them )?)transition to (?:a |the )?(?<end>.+?) over (?<beats>\d+) (?:beats?|counts?)$/,
] as const;

function transitionAction(prompt: string): TikaDirectorAction | null {
  for (const pattern of TRANSITION_COMMANDS) {
    const groups = pattern.exec(prompt)?.groups;
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

/**
 * Only complete, standalone commands can skip model interpretation. Matching
 * a few words could otherwise change props the user explicitly asked to keep.
 * Callers must route conversation follow-ups through the model with history.
 */
export function interpretStageDirectionLocally(
  prompt: string
): TikaDirectorResponse | null {
  // Politeness and terminal punctuation never change what a command means.
  const command = prompt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!]+$/, "")
    .replace(/^please\s+/, "")
    .replace(/,?\s+please$/, "");
  let action: TikaDirectorAction | null = null;
  if (
    /^give every performer(?: in this scene)? a (?:different|distinct|unique) prop$/.test(
      command
    )
  ) {
    action = { type: "assign-distinct-props" };
  } else if (
    /^(?:make every avatar (?:different|distinct|unique)|every character should be a different avatar)$/.test(
      command
    )
  ) {
    action = { type: "assign-distinct-characters" };
  } else if (PRESENTATION_COMMAND.test(command)) {
    const look = PRESENTATION_COMMAND.exec(command)!.groups!.look!;
    const presentation = PRESENTATION_WORDS.get(look);
    if (!presentation) return null;
    action = { type: "assign-distinct-characters", presentation };
  } else if (
    /^give (?:every|each) performer(?: in this scene)? a (?:different|distinct|unique) (?:sequence|word)(?: (?:from|out of) (?:my|the|their) library)?$/.test(
      command
    )
  ) {
    action = { type: "assign-distinct-sequences" };
  } else {
    action = transitionAction(command);
  }
  if (!action) return null;

  const description =
    action.type === "assign-distinct-props"
      ? "distinct props"
      : action.type === "assign-distinct-characters"
        ? action.presentation
          ? `distinct ${action.presentation} avatars`
          : "distinct avatars"
        : action.type === "assign-distinct-sequences"
          ? "a different library sequence to every performer"
          : `${action.startFormation ? `${action.startFormation} to ` : ""}${action.endFormation} over ${action.durationBeats} beats`;
  return {
    kind: "apply",
    summary: `Applied ${description}.`,
    actions: [action],
  };
}
