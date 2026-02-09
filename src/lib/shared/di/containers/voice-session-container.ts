/**
 * Voice Session DI Container
 *
 * Registers services for recording, formatting, persisting, analyzing,
 * replaying, and promoting voice command sessions.
 */

import { createContainer } from "iti";
import { VoiceSessionRecorder } from "$lib/shared/voice-control/services/implementations/VoiceSessionRecorder";
import { VoiceSessionFormatter } from "$lib/features/voice-sessions/services/implementations/VoiceSessionFormatter";
import { VoiceSessionRepository } from "$lib/features/voice-sessions/services/implementations/VoiceSessionRepository";
import { VoiceSessionAnalyzer } from "$lib/features/voice-sessions/services/implementations/VoiceSessionAnalyzer";
import { VoiceSessionReplayer } from "$lib/features/voice-sessions/services/implementations/VoiceSessionReplayer";
import { TierPromotionEngine } from "$lib/features/voice-sessions/services/implementations/TierPromotionEngine";
import type { ICommandInterpreter } from "$lib/shared/voice-control/services/contracts/ICommandInterpreter";

export interface VoiceSessionContainerDeps {
  commandInterpreter: ICommandInterpreter;
}

export function createVoiceSessionContainer(deps: VoiceSessionContainerDeps) {
  return createContainer().add({
    voiceSessionRecorder: () => new VoiceSessionRecorder(),
    voiceSessionFormatter: () => new VoiceSessionFormatter(),
    voiceSessionRepository: () => new VoiceSessionRepository(),
    voiceSessionAnalyzer: () => new VoiceSessionAnalyzer(),
    voiceSessionReplayer: () => new VoiceSessionReplayer(deps.commandInterpreter),
    tierPromotionEngine: () => new TierPromotionEngine(),
  });
}

export type VoiceSessionContainer = ReturnType<typeof createVoiceSessionContainer>;
