import { browser } from '$app/environment';
import { TranscriptionClient } from './services/implementations/TranscriptionClient';

let instance: TranscriptionClient | null = null;

export function getTranscriptionClient(): TranscriptionClient {
	if (!browser) throw new Error('getTranscriptionClient() is browser-only');
	return instance ??= new TranscriptionClient();
}
