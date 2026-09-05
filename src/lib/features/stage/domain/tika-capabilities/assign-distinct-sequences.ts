import { z } from "zod";
import type { TikaCapability } from "./capability";

export const AssignDistinctSequencesSchema = z
  .object({ type: z.literal("assign-distinct-sequences") })
  .strict();
export type AssignDistinctSequencesAction = z.infer<
  typeof AssignDistinctSequencesSchema
>;

export const assignDistinctSequencesCapability: TikaCapability<AssignDistinctSequencesAction> =
  {
    type: "assign-distinct-sequences",
    schema: AssignDistinctSequencesSchema,
    plannerLine:
      "give EVERY performer a different flow sequence (a 'word' or routine) drawn at random from the user's own saved library. The scene's librarySequenceCount says how many the library holds. TIKA cannot choose a named or specific sequence, cannot target a subset, and cannot pick by length, letter, or style.",
    reviewerLine:
      "assign-distinct-sequences gives EVERY performer a different sequence drawn at random from the user's saved library; it cannot name a specific sequence, target a subset, or filter by length or style. Reject it when scene.librarySequenceCount is missing, 0, or below the performer count.",
    examples: [
      {
        user: "Give each performer their own sequence from my library",
        scene: { librarySequenceCount: 12 },
        response: {
          kind: "apply",
          summary: "Assigning a different saved sequence to every performer.",
          actions: [{ type: "assign-distinct-sequences" }],
        },
      },
      {
        user: "I want them each performing a different flow sequence, a different word from my library. Can you do that?",
        conversation: [
          { role: "user", content: "give them a different sequence" },
          {
            role: "assistant",
            content:
              "Do you want every performer to get a different sequence from your library?",
          },
        ],
        scene: { librarySequenceCount: 40 },
        response: {
          kind: "apply",
          summary:
            "Yes. Each performer now has a different sequence from your library.",
          actions: [{ type: "assign-distinct-sequences" }],
        },
      },
      {
        user: "Give Sam the sequence ABC",
        response: {
          kind: "unsupported",
          message:
            "I can only hand out random distinct sequences from your library to the whole cast; pick a specific sequence from the Performers panel.",
        },
      },
    ],
    local: (command) =>
      /^give (?:every|each) performer(?: in this scene)? a (?:different|distinct|unique) (?:sequence|word)(?: (?:from|out of) (?:my|the|their) library)?$/.test(
        command
      )
        ? { type: "assign-distinct-sequences" }
        : null,
    describe: () =>
      "Gave every performer a different sequence from your library.",
  };
