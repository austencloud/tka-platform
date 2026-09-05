import { z } from "zod";
import type { TikaCapability } from "./capability";

export const AssignDistinctPropsSchema = z
  .object({ type: z.literal("assign-distinct-props") })
  .strict();
export type AssignDistinctPropsAction = z.infer<
  typeof AssignDistinctPropsSchema
>;

export const assignDistinctPropsCapability: TikaCapability<AssignDistinctPropsAction> =
  {
    type: "assign-distinct-props",
    schema: AssignDistinctPropsSchema,
    plannerLine:
      "assign a different prop to EVERY performer using the available catalog.",
    reviewerLine:
      "assign-distinct-props affects EVERY performer using the full prop catalog. It cannot exclude items, select named items, or target subsets.",
    examples: [
      {
        user: "Give everyone different props.",
        response: {
          kind: "apply",
          summary: "Giving every performer a different prop.",
          actions: [{ type: "assign-distinct-props" }],
        },
      },
      {
        user: "Give everyone different props but keep their avatars unchanged.",
        response: {
          kind: "apply",
          summary: "Giving every performer a different prop; avatars stay.",
          actions: [{ type: "assign-distinct-props" }],
        },
        note: "Keeping something unchanged needs no action.",
      },
      {
        user: "Dim the lights and give everyone different props.",
        response: {
          kind: "unsupported",
          message:
            "I cannot control lighting, so I changed nothing. Ask for the props on their own and I will assign them.",
        },
      },
    ],
    local: (command) =>
      /^give (?:every|each) performer(?: in this scene)? a (?:different|distinct|unique) prop$/.test(
        command
      )
        ? { type: "assign-distinct-props" }
        : null,
    describe: () => "Gave every performer a different prop.",
  };
