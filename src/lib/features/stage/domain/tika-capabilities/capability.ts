import type { z } from "zod";
import type {
  TikaDirectorRequest,
  TikaDirectorResponse,
} from "../tika-director";

/**
 * A worked decision the planner is taught. The live battery replays every
 * example as a baseline case, so an example is real data, not prose.
 */
export interface TikaCapabilityExample {
  user: string;
  conversation?: TikaDirectorRequest["conversation"];
  scene?: Partial<TikaDirectorRequest["scene"]>;
  response: TikaDirectorResponse;
  /** One trailing sentence of rationale shown after the example. */
  note?: string;
}

export type TikaCapabilityVeto =
  | { kind: "clarify"; question: string }
  | { kind: "unsupported"; message: string };

export interface TikaLocalContext {
  currentBeat: number;
}

/**
 * One TIKA verb. The registry derives the action schema, the planner prompt,
 * the reviewer rules, the deterministic vetoes, and the model-free interpreter
 * from these descriptors, so a verb cannot be half-registered.
 */
export interface TikaCapability<A extends { type: string } = { type: string }> {
  type: A["type"];
  schema: z.ZodType<A>;
  /** One line for the planner's "Supported actions" list, after the type. */
  plannerLine: string;
  /** One line for the reviewer's capability block. */
  reviewerLine: string;
  examples: readonly TikaCapabilityExample[];
  /**
   * Model-free reading of a complete, normalized, standalone command. The
   * interpreter lower-cases, collapses whitespace, and strips politeness and
   * terminal punctuation before calling this.
   */
  local?: (command: string) => A | null;
  /**
   * Plan-level veto over the whole action list. Runs after schema parsing on
   * the server; it may reject a plan but never adds or changes actions.
   */
  validate?: (
    request: Pick<TikaDirectorRequest, "prompt" | "conversation" | "scene">,
    actions: readonly { type: string }[]
  ) => TikaCapabilityVeto | null;
  /** Summary sentence for a locally interpreted action. */
  describe: (action: A, context: TikaLocalContext) => string;
}
