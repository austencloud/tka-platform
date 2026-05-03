import { VoiceSessionReplayer } from './services/implementations/VoiceSessionReplayer';
import { getCommandInterpreter } from '$lib/shared/voice-control/getCommandInterpreter';

let instance: VoiceSessionReplayer | null = null;
export function getVoiceSessionReplayer(): VoiceSessionReplayer {
  return instance ??= new VoiceSessionReplayer(getCommandInterpreter());
}
