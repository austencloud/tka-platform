import type { TikaDirectorResponse } from "./tika-director";
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
