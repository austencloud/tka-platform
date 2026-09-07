import type {
  TikaDirectorConversationMessage,
  TikaDirectorResponse,
} from "./tika-director";
import {
  interpretWithCapabilities,
  type TikaLocalContext,
} from "./tika-capabilities";

const OPENERS = /^(?:(?:hey|hi|ok|okay|so|alright|um),?\s+)+/;
const ADDRESS = /^tika[,:]?\s+/;
const REQUEST_PREFIX = /^(?:could|can|would|will) you\s+(?:please\s+)?/;

/**
 * Only complete, standalone commands can skip model interpretation. Matching
 * a few words could otherwise change props the user explicitly asked to keep.
 * Callers must route conversation follow-ups through the model with history.
 */
export function interpretStageDirectionLocally(
  prompt: string,
  context: TikaLocalContext = { currentBeat: 0 }
): TikaDirectorResponse | null {
  // Politeness and terminal punctuation never change what a command means.
  let command = prompt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!]+$/, "")
    .replace(OPENERS, "")
    .replace(ADDRESS, "");
  // "Could you put them in a line?" is a request, not a question, so the
  // question mark goes only when the request opener is present.
  if (REQUEST_PREFIX.test(command)) {
    command = command.replace(REQUEST_PREFIX, "").replace(/\?+$/, "");
  }
  command = command
    .replace(/^please\s+/, "")
    .replace(/,?\s+please$/, "")
    .replace(/,?\s+for me$/, "")
    .trim();
  return interpretWithCapabilities(command, context);
}

const REPEAT =
  /^(?:(?:a (?:bit|little|touch|tad|lot) |even |much |way |just |once )?(?:more|again)(?: please)?)$/;

/**
 * Model-free reading of a follow-up. The conversation stays deterministic only
 * while every earlier user turn was itself read locally: the first sentence the
 * patterns could not parse may carry a constraint ("never use fans") that only
 * the model can honor, so from then on every turn goes to the model. A pending
 * question also hands the answer to the model. "More" or "again" repeats the
 * previous spacing or shift tweak.
 */
export function interpretConversationLocally(
  prompt: string,
  conversation: readonly TikaDirectorConversationMessage[],
  context: TikaLocalContext
): TikaDirectorResponse | null {
  if (conversation.length === 0) {
    return interpretStageDirectionLocally(prompt, context);
  }
  let lastLocal: TikaDirectorResponse | null = null;
  let lastUserPrompt: string | undefined;
  for (let index = 0; index < conversation.length; index++) {
    const message = conversation[index]!;
    if (message.role === "assistant") {
      if (message.content.includes("?")) return null;
      continue;
    }
    lastLocal = interpretConversationLocally(
      message.content,
      conversation.slice(0, index),
      context
    );
    if (!lastLocal) return null;
    lastUserPrompt = message.content;
  }

  if (
    REPEAT.test(
      prompt
        .trim()
        .toLowerCase()
        .replace(/[.!]+$/, "")
    )
  ) {
    const action =
      lastLocal?.kind === "apply" ? lastLocal.actions[0] : undefined;
    const repeatable =
      lastLocal?.kind === "apply" &&
      lastLocal.actions.length === 1 &&
      action?.type === "arrange-formation" &&
      (action.spacing !== undefined || action.shift !== undefined);
    return repeatable && lastUserPrompt !== undefined
      ? interpretStageDirectionLocally(lastUserPrompt, context)
      : null;
  }
  return interpretStageDirectionLocally(prompt, context);
}
