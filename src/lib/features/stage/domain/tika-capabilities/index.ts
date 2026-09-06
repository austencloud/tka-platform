import { z } from "zod";
import type {
  TikaDirectorRequest,
  TikaDirectorResponse,
} from "../tika-director";
import type {
  TikaCapability,
  TikaCapabilityExample,
  TikaLocalContext,
} from "./capability";
import {
  assignDistinctPropsCapability,
  AssignDistinctPropsSchema,
} from "./assign-distinct-props";
import {
  assignDistinctCharactersCapability,
  AssignDistinctCharactersSchema,
} from "./assign-distinct-characters";
import {
  assignDistinctSequencesCapability,
  AssignDistinctSequencesSchema,
} from "./assign-distinct-sequences";
import {
  formationTransitionCapability,
  FormationTransitionSchema,
} from "./formation-transition";
import {
  arrangeFormationCapability,
  ArrangeFormationSchema,
} from "./arrange-formation";

export type {
  TikaCapability,
  TikaCapabilityExample,
  TikaCapabilityVeto,
  TikaLocalContext,
} from "./capability";

/**
 * Every verb TIKA Director can plan, in the order the planner lists them. The
 * action schema, both model prompts, the deterministic vetoes, and the local
 * interpreter are all derived from this list, so a verb is either fully
 * registered or absent.
 */
export const TIKA_CAPABILITIES: readonly TikaCapability<any>[] = [
  assignDistinctPropsCapability,
  assignDistinctCharactersCapability,
  assignDistinctSequencesCapability,
  // Arrange precedes Move: its veto names the arrange-plus-move clash before
  // the timing gate can turn that clash into a duration question.
  arrangeFormationCapability,
  formationTransitionCapability,
];

// Built from each capability's own exported schema (not the `TikaCapability`
// interface's widened `schema: z.ZodType<A>` field) so the concrete Zod
// object types keep the discriminant metadata `discriminatedUnion` requires.
export const TikaDirectorActionSchema = z.discriminatedUnion("type", [
  AssignDistinctPropsSchema,
  AssignDistinctCharactersSchema,
  AssignDistinctSequencesSchema,
  FormationTransitionSchema,
  ArrangeFormationSchema,
]);
export type TikaDirectorAction = z.infer<typeof TikaDirectorActionSchema>;

export function plannerCapabilityLines(): string[] {
  return TIKA_CAPABILITIES.map(
    (capability) => `- ${capability.type}: ${capability.plannerLine}`
  );
}

export function reviewerCapabilityLines(): string[] {
  return TIKA_CAPABILITIES.map((capability) => capability.reviewerLine);
}

export function plannerExampleLines(): string[] {
  return TIKA_CAPABILITIES.flatMap((capability) =>
    capability.examples.map(renderExample)
  );
}

// The planner has always read examples in this compact object notation, and
// the prompt tests pin fragments of it (presentation:'feminine').
function renderValue(value: unknown): string {
  if (typeof value === "string") return `'${value.replace(/'/g, "\\'")}'`;
  if (Array.isArray(value)) return `[${value.map(renderValue).join(", ")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .map(([key, entry]) => `${key}:${renderValue(entry)}`)
      .join(", ")}}`;
  }
  return String(value);
}

function renderExample(example: TikaCapabilityExample): string {
  const context = [
    example.conversation
      ? `after conversation ${renderValue(example.conversation)}`
      : "",
    example.scene ? `with scene ${renderValue(example.scene)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const tail = example.response.kind === "apply" ? "" : "; no actions";
  const note = example.note ? ` ${example.note}` : "";
  return `User: ${renderValue(example.user)}${context ? ` ${context}` : ""} -> response ${renderValue(example.response)}${tail}.${note}`;
}

/** Runs every registered veto in order. The first veto replaces the plan. */
export function validateTikaDirectorPlan(
  request: Pick<TikaDirectorRequest, "prompt" | "conversation" | "scene">,
  response: TikaDirectorResponse
): TikaDirectorResponse {
  if (response.kind !== "apply") return response;
  for (const capability of TIKA_CAPABILITIES) {
    const veto = capability.validate?.(request, response.actions);
    if (veto) return veto;
  }
  return response;
}

/** First model-free reading wins; the caller has already normalized the text. */
export function interpretWithCapabilities(
  command: string,
  context: TikaLocalContext
): TikaDirectorResponse | null {
  for (const capability of TIKA_CAPABILITIES) {
    const action = capability.local?.(command);
    if (!action) continue;
    return {
      kind: "apply",
      summary: capability.describe(action, context),
      actions: [action],
    };
  }
  return null;
}
