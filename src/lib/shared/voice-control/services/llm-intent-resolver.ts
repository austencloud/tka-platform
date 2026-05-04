/**
 * LLM Intent Resolver
 *
 * Calls the /api/tika/voice-command endpoint to resolve voice transcripts
 * the regex chain couldn't parse.
 */

import type { IntentResolution, VoiceCommandRequest, VoiceCommandResponse } from "../domain/intent-resolution-types";
import type { CommandContext, VoiceCommand } from "../domain/voice-command-types";
import { VALID_CATEGORIES } from "../ai/action-catalog";

const TIMEOUT_MS = 2000;
const ENDPOINT = "/api/tika/voice-command";

function unknownFallback(rawText: string): IntentResolution {
  return {
    commands: [{
      category: "system",
      action: "unknown",
      target: "",
      rawText,
      confidence: 0,
    }],
    escalateToChat: false,
    confidence: 0,
  };
}

function validateAndTransform(
  data: VoiceCommandResponse,
  rawText: string,
): IntentResolution {
  if (data.escalateToChat) {
    return {
      commands: [],
      escalateToChat: true,
      confidence: data.confidence,
    };
  }

  if (!data.commands || data.commands.length === 0) {
    return unknownFallback(rawText);
  }

  const validatedCommands: VoiceCommand[] = [];

  for (const cmd of data.commands) {
    if (!VALID_CATEGORIES.has(cmd.category)) {
      console.warn(`[LLMIntentResolver] Unknown category "${cmd.category}", skipping`);
      continue;
    }

    validatedCommands.push({
      category: cmd.category,
      action: cmd.action,
      target: cmd.target || "",
      args: cmd.args,
      rawText,
      confidence: cmd.confidence ?? data.confidence,
    });
  }

  if (validatedCommands.length === 0) {
    return unknownFallback(rawText);
  }

  return {
    commands: validatedCommands,
    escalateToChat: false,
    confidence: data.confidence,
  };
}

export async function resolveIntent(
  rawText: string,
  context: CommandContext,
  previousCommand?: VoiceCommand,
): Promise<IntentResolution> {
  try {
    const body: VoiceCommandRequest = {
      transcript: rawText,
      currentModule: context.currentModule,
      currentTab: context.currentTab,
      ...(previousCommand ? { previousCommand } : {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[LLMIntentResolver] HTTP ${response.status}`);
      return unknownFallback(rawText);
    }

    const data: VoiceCommandResponse = await response.json();
    return validateAndTransform(data, rawText);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.warn("[LLMIntentResolver] Timed out after 2s");
    } else {
      console.warn("[LLMIntentResolver] Request failed:", error);
    }
    return unknownFallback(rawText);
  }
}
