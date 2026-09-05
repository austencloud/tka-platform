import { z } from "zod";
import {
  TikaDirectorPresentationSchema,
  type TikaDirectorPresentation,
} from "../tika-director-vocabulary";
import type { TikaCapability, TikaCapabilityVeto } from "./capability";

export const AssignDistinctCharactersSchema = z
  .object({
    type: z.literal("assign-distinct-characters"),
    /** Restrict the draw to avatars carrying this presentation label. */
    presentation: TikaDirectorPresentationSchema.optional(),
  })
  .strict();
export type AssignDistinctCharactersAction = z.infer<
  typeof AssignDistinctCharactersSchema
>;

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

function local(command: string): AssignDistinctCharactersAction | null {
  if (
    /^(?:make every avatar (?:different|distinct|unique)|every character should be a different avatar)$/.test(
      command
    )
  ) {
    return { type: "assign-distinct-characters" };
  }
  const look = PRESENTATION_COMMAND.exec(command)?.groups?.look;
  if (!look) return null;
  const presentation = PRESENTATION_WORDS.get(look);
  return presentation
    ? { type: "assign-distinct-characters", presentation }
    : null;
}

/**
 * A presentation filter can only be honored when enough deployed avatars carry
 * the label. The client resolver would throw anyway; refusing here keeps the
 * explanation in TIKA's voice and never applies a partial cast.
 */
function validate(
  request: {
    scene: {
      performers: readonly unknown[];
      characterPresentationCounts?: Record<TikaDirectorPresentation, number>;
    };
  },
  actions: readonly { type: string }[]
): TikaCapabilityVeto | null {
  const counts = request.scene.characterPresentationCounts;
  if (!counts) return null;
  const performers = request.scene.performers.length;
  for (const action of actions) {
    if (action.type !== "assign-distinct-characters") continue;
    const presentation = (action as AssignDistinctCharactersAction)
      .presentation;
    if (!presentation) continue;
    const available = counts[presentation];
    if (available >= performers) continue;
    const noun = available === 1 ? "avatar is" : "avatars are";
    return {
      kind: "unsupported",
      message: `Only ${available} ${presentation} ${noun} deployed, but this cast has ${performers} performers. Shrink the cast or drop the ${presentation} requirement.`,
    };
  }
  return null;
}

export const assignDistinctCharactersCapability: TikaCapability<AssignDistinctCharactersAction> =
  {
    type: "assign-distinct-characters",
    schema: AssignDistinctCharactersSchema,
    plannerLine:
      "assign a different deployed avatar to EVERY performer. Optional presentation filter: 'feminine', 'masculine', or 'androgynous'. These are look labels the product owner gave each avatar (the catalog has no gender data); female/women/girls/ladies means feminine, male/men/guys/boys means masculine, nonbinary/gender-neutral/androgynous means androgynous. scene.characterPresentationCounts is informational only: never compare it to the cast yourself. Always plan the filtered assignment; the server rejects a label with too few deployed avatars after planning. When you refuse a cast-size change, compare the cast the user wants against the requested label's count and state that count if it is smaller, so you never promise a filtered cast the pool cannot cover.",
    reviewerLine:
      "assign-distinct-characters affects EVERY performer using the full avatar catalog and cannot exclude items, select named items, or target subsets. It may carry presentation 'feminine', 'masculine', or 'androgynous': product-assigned look labels. Accept female/women/girls as feminine, male/men/guys as masculine, nonbinary/neutral as androgynous. The deployed count per label was already checked deterministically before review: do not recompute it or reject on it. Reject any other avatar attribute filter (age, skin tone, hair, outfit, species).",
    examples: [
      {
        user: "Make every avatar different.",
        response: {
          kind: "apply",
          summary: "Giving every performer a different avatar.",
          actions: [{ type: "assign-distinct-characters" }],
        },
      },
      {
        user: "Make the avatars female.",
        response: {
          kind: "apply",
          summary: "Giving every performer a different feminine avatar.",
          actions: [
            { type: "assign-distinct-characters", presentation: "feminine" },
          ],
        },
      },
      {
        user: "Add five more performers, all women with different props.",
        scene: {
          performers: ["A", "B", "C"].map((label) => ({
            id: label,
            label,
            characterId: "x-bot",
            prop: "staff",
          })),
          characterPresentationCounts: {
            masculine: 6,
            feminine: 6,
            androgynous: 4,
          },
        },
        response: {
          kind: "unsupported",
          message:
            "I cannot add performers; use the Performers panel. Only 6 feminine avatars are deployed, so a cast of 8 cannot all be feminine and distinct.",
        },
      },
      {
        user: "Make every avatar an older man.",
        response: {
          kind: "clarify",
          question:
            "I can only filter avatars by presentation, not age. Should every performer get a different masculine avatar?",
        },
      },
    ],
    local,
    validate,
    describe: (action) =>
      action.presentation
        ? `Gave every performer a different ${action.presentation} avatar.`
        : "Gave every performer a different avatar.",
  };
