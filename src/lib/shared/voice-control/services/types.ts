/**
 * Co-exported types from retired interface contracts.
 */

import type {
  VoiceSession,
  ResolutionTier,
  LLMResolutionDetails,
  ChatResponseDetails,
} from "../domain/voice-session-types";
import type { VoiceCommand, VoiceCommandCategory, CommandResult } from "../domain/voice-command-types";

// === From IVoiceSessionRecorder ===

export interface RecordEventParams {
  transcript: string;
  speechConfidence: number;
  tier: ResolutionTier;
  interpretedCommand: VoiceCommand | null;
  dispatchResult: CommandResult | null;
  context: { module: string; tab: string };
  latencyMs: number;
  llmDetails?: LLMResolutionDetails;
  chatDetails?: ChatResponseDetails;
}
export type SessionEndedCallback = (session: VoiceSession) => void;

// === From ICommandDispatcher ===

export interface IVoiceCommandHandler {
  /** Which command categories this handler can execute */
  readonly supportedCategories: VoiceCommandCategory[];

  /** Execute a voice command */
  execute(command: VoiceCommand): Promise<CommandResult>;
}

