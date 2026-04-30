/**
 * Intent Resolution Types
 *
 * Shared types for the tiered voice command resolution system.
 * Tier 1 (regex) and Tier 2 (LLM) both produce VoiceCommand objects.
 * These types define the LLM resolution layer.
 */

import type { VoiceCommand, VoiceCommandCategory } from "./voice-command-types";

// ============================================================================
// Intent Resolution
// ============================================================================

/** Result from the LLM intent resolver */
export interface IntentResolution {
  /** Resolved command(s) to dispatch. Phase 1: single command. Phase 2: compound. */
  commands: VoiceCommand[];
  /** If true, the user asked a question - route to TIKA chat instead of dispatching */
  escalateToChat: boolean;
  /** LLM confidence in its interpretation (0-1) */
  confidence: number;
}

/** Request body sent to /api/tika/voice-command */
export interface VoiceCommandRequest {
  /** Raw spoken text after wake word stripping */
  transcript: string;
  /** Current app state for context-aware resolution */
  currentModule: string;
  currentTab: string;
  /** Previous command for conversational context (Phase 3) */
  previousCommand?: VoiceCommand;
}

/** Response from /api/tika/voice-command */
export interface VoiceCommandResponse {
  commands: VoiceCommandLLMOutput[];
  escalateToChat: boolean;
  confidence: number;
}

/** LLM-generated command structure (before adding rawText) */
export interface VoiceCommandLLMOutput {
  category: VoiceCommandCategory;
  action: string;
  target: string;
  args?: Record<string, string | boolean | number>;
  confidence: number;
}

// ============================================================================
// Action Catalog
// ============================================================================

/** A single available voice command action */
export interface ActionDefinition {
  category: VoiceCommandCategory;
  action: string;
  description: string;
  validTargets?: string[];
  validArgs?: Record<string, string>;
  /** Module(s) where this action is available. Undefined = global. */
  activeInModules?: string[];
  /** Tab(s) where this action is available within its module. */
  activeInTabs?: string[];
}
