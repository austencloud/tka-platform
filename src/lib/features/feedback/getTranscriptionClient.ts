import { browser } from '$app/environment';
import type { ITranscriptionClient } from './services/contracts/ITranscriptionClient';
import { TranscriptionClient } from './services/implementations/TranscriptionClient';

let instance: ITranscriptionClient | null = null;

export function getTranscriptionClient(): ITranscriptionClient {
	if (!browser) throw new Error('getTranscriptionClient() is browser-only');
	return instance ??= new TranscriptionClient();
}
