/**
 * Voice Session DI Container
 *
 * Registers services for recording, formatting, and persisting voice command sessions.
 */

import { createContainer } from "iti";
import { VoiceSessionRecorder } from "$lib/shared/voice-control/services/implementations/VoiceSessionRecorder";
import { VoiceSessionFormatter } from "$lib/features/voice-sessions/services/implementations/VoiceSessionFormatter";
import { VoiceSessionRepository } from "$lib/features/voice-sessions/services/implementations/VoiceSessionRepository";

export function createVoiceSessionContainer() {
  return createContainer().add({
    voiceSessionRecorder: () => new VoiceSessionRecorder(),
    voiceSessionFormatter: () => new VoiceSessionFormatter(),
    voiceSessionRepository: () => new VoiceSessionRepository(),
  });
}

export type VoiceSessionContainer = ReturnType<typeof createVoiceSessionContainer>;
