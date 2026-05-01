/**
 * Detector states:
 * - idle: not running
 * - listening: waiting for wake word ("Hey Tika")
 * - command_mode: mic is hot, all speech becomes commands
 * - processing: interpreting a command
 * - error: speech API error
 */
export type WakeWordState = "idle" | "listening" | "command_mode" | "processing" | "error";

export interface WakeWordEvent {
  /** The raw command text after stripping the wake word */
  command: string;
  /** Speech recognition confidence (0-1) */
  confidence: number;
  /** When the command was detected */
  timestamp: number;
}

export type VoiceCommandCategory =
  | "navigation"
  | "settings"
  | "playback"
  | "create"
  | "generator"
  | "sequence"
  | "ui"
  | "search"
  | "prop"
  | "system";

export interface VoiceCommand {
  category: VoiceCommandCategory;
  /** Specific action within the category: "play", "toggle", "undo", etc. */
  action: string;
  /** The resolved target (module ID, tab ID, setting key, prop type, etc.) */
  target: string;
  /** Additional arguments for the command */
  args?: Record<string, string | boolean | number>;
  /** The original transcript text */
  rawText: string;
  /** Interpretation confidence (0-1) */
  confidence: number;
}

export interface CommandContext {
  currentModule: string;
  currentTab: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
}
