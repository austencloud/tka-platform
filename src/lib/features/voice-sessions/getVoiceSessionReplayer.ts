import type { IVoiceSessionReplayer } from './services/contracts/IVoiceSessionReplayer';
import { VoiceSessionReplayer } from './services/implementations/VoiceSessionReplayer';
import { getCommandInterpreter } from '$lib/shared/voice-control/getCommandInterpreter';

let instance: IVoiceSessionReplayer | null = null;
export function getVoiceSessionReplayer(): IVoiceSessionReplayer {
  return instance ??= new VoiceSessionReplayer(getCommandInterpreter());
}
