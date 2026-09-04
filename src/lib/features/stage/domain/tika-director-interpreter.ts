import type {
  TikaDirectorAction,
  TikaDirectorFormation,
  TikaDirectorResponse,
} from "./tika-director";

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
  /^(?:transition|move|travel|go) from (?:a |the )?(?<start>.+?) to (?:a |the )?(?<end>.+?) (?:over|in) (?<beats>\d+) beats?$/,
  /^(?:transition|move|travel|go) to (?:a |the )?(?<end>.+?) (?:over|in) (?<beats>\d+) beats?$/,
  /^put them(?: all)? in (?:a |the )?(?<start>.+?)(?:,? then | and (?:have them )?)transition to (?:a |the )?(?<end>.+?) over (?<beats>\d+) beats?$/,
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
  const command = prompt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");
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
  } else {
    action = transitionAction(command);
  }
  if (!action) return null;

  const description =
    action.type === "assign-distinct-props"
      ? "distinct props"
      : action.type === "assign-distinct-characters"
        ? "distinct avatars"
        : `${action.startFormation ? `${action.startFormation} to ` : ""}${action.endFormation} over ${action.durationBeats} beats`;
  return {
    kind: "apply",
    summary: `Applied ${description}.`,
    actions: [action],
  };
}
