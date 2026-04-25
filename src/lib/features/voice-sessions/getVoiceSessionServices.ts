import { VoiceSessionRecorder } from '$lib/shared/voice-control/services/implementations/VoiceSessionRecorder';
import { VoiceSessionFormatter } from './services/implementations/VoiceSessionFormatter';
import { VoiceSessionRepository } from './services/implementations/VoiceSessionRepository';
import { VoiceSessionAnalyzer } from './services/implementations/VoiceSessionAnalyzer';
import { VoiceSessionReplayer } from './services/implementations/VoiceSessionReplayer';
import { TierPromotionEngine } from './services/implementations/TierPromotionEngine';
import { getCommandInterpreter } from '$lib/shared/voice-control/getVoiceControlServices';

let voiceSessionRecorder: VoiceSessionRecorder | null = null;
let voiceSessionFormatter: VoiceSessionFormatter | null = null;
let voiceSessionRepository: VoiceSessionRepository | null = null;
let voiceSessionAnalyzer: VoiceSessionAnalyzer | null = null;
let voiceSessionReplayer: VoiceSessionReplayer | null = null;
let tierPromotionEngine: TierPromotionEngine | null = null;

export function getVoiceSessionRecorder(): VoiceSessionRecorder {
  return voiceSessionRecorder ??= new VoiceSessionRecorder();
}

export function getVoiceSessionFormatter(): VoiceSessionFormatter {
  return voiceSessionFormatter ??= new VoiceSessionFormatter();
}

export function getVoiceSessionRepository(): VoiceSessionRepository {
  return voiceSessionRepository ??= new VoiceSessionRepository();
}

export function getVoiceSessionAnalyzer(): VoiceSessionAnalyzer {
  return voiceSessionAnalyzer ??= new VoiceSessionAnalyzer();
}

export function getVoiceSessionReplayer(): VoiceSessionReplayer {
  return voiceSessionReplayer ??= new VoiceSessionReplayer(getCommandInterpreter());
}

export function getTierPromotionEngine(): TierPromotionEngine {
  return tierPromotionEngine ??= new TierPromotionEngine();
}
