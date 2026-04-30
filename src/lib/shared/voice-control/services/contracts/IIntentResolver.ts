/**
 * IIntentResolver
 *
 * Contract for the Tier 2 LLM-powered intent resolution layer.
 * When the regex-based CommandInterpreter returns "unknown",
 * this service attempts to resolve the user's intent via LLM.
 */

import type { IntentResolution } from "../../domain/intent-resolution-types";
import type { CommandContext, VoiceCommand } from "../../domain/voice-command-types";

export interface IIntentResolver {
  /**
   * Attempt to resolve a voice transcript into a structured command via LLM.
   *
   * @param rawText - The raw spoken text that regex couldn't parse
   * @param context - Current module/tab for context-aware resolution
   * @param previousCommand - Most recent resolved command for conversational context
   * @returns Resolved command(s), or escalateToChat=true for questions
   * @throws Never - gracefully degrades to system/unknown on error
   */
  resolve(
    rawText: string,
    context: CommandContext,
    previousCommand?: VoiceCommand,
  ): Promise<IntentResolution>;
}
