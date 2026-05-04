import { VoiceSessionRecorder } from '$lib/shared/voice-control/services/implementations/VoiceSessionRecorder';
import * as voiceSessionFormatter from './services/voice-session-formatter';
import { VoiceSessionRepository } from './services/implementations/VoiceSessionRepository';
import * as voiceSessionAnalyzer from './services/voice-session-analyzer';
import { VoiceSessionReplayer } from './services/implementations/VoiceSessionReplayer';
import * as tierPromotionEngine from './services/tier-promotion-engine';
import { getCommandInterpreter } from '$lib/shared/voice-control/getVoiceControlServices';

let voiceSessionRecorder: VoiceSessionRecorder | null = null;
let voiceSessionRepository: VoiceSessionRepository | null = null;
let voiceSessionReplayer: VoiceSessionReplayer | null = null;

export function getVoiceSessionRecorder(): VoiceSessionRecorder {
  return voiceSessionRecorder ??= new VoiceSessionRecorder();
}

export function getVoiceSessionFormatter(): typeof voiceSessionFormatter {
  return voiceSessionFormatter;
}

export function getVoiceSessionRepository(): VoiceSessionRepository {
  return voiceSessionRepository ??= new VoiceSessionRepository();
}

export function getVoiceSessionAnalyzer(): typeof voiceSessionAnalyzer {
  return voiceSessionAnalyzer;
}

export function getVoiceSessionReplayer(): VoiceSessionReplayer {
  return voiceSessionReplayer ??= new VoiceSessionReplayer(getCommandInterpreter());
}

export function getTierPromotionEngine(): typeof tierPromotionEngine {
  return tierPromotionEngine;
}
