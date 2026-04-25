import { browser } from '$app/environment';
import type { IBeatSignatureGenerator } from './services/contracts/IBeatSignatureGenerator';
import { BeatSignatureGenerator } from './services/implementations/BeatSignatureGenerator';
import { getMotionSignatureGenerator } from './getMotionSignatureGenerator';

let instance: IBeatSignatureGenerator | null = null;

export function getBeatSignatureGenerator(): IBeatSignatureGenerator {
	if (!browser) throw new Error('getBeatSignatureGenerator() is browser-only');
	return instance ??= new BeatSignatureGenerator(getMotionSignatureGenerator());
}
