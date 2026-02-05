/**
 * Voice Command Domain Types
 *
 * Type definitions for the "Hey Tika" voice control system.
 * Covers wake word detection, command interpretation, and dispatch.
 */

// ============================================================================
// Wake Word Detection
// ============================================================================

export type WakeWordState = "idle" | "listening" | "processing" | "error";

export interface WakeWordEvent {
  /** The raw command text after stripping the wake word */
  command: string;
  /** Speech recognition confidence (0-1) */
  confidence: number;
  /** When the command was detected */
  timestamp: number;
}

// ============================================================================
// Command Interpretation
// ============================================================================

export type VoiceCommandType =
  | "navigate_module"
  | "switch_tab"
  | "toggle_setting"
  | "unknown";

export interface VoiceCommand {
  type: VoiceCommandType;
  /** The resolved target (module ID, tab ID, or setting key) */
  target: string;
  /** Additional arguments for the command */
  args?: Record<string, string | boolean>;
  /** The original transcript text */
  rawText: string;
  /** Interpretation confidence (0-1) */
  confidence: number;
}

export interface CommandContext {
  currentModule: string;
  currentTab: string;
}

// ============================================================================
// Command Dispatch
// ============================================================================

export interface CommandResult {
  success: boolean;
  message: string;
}
