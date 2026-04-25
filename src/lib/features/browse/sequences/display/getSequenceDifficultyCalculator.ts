import { browser } from '$app/environment';
import type { ISequenceDifficultyCalculator } from './services/contracts/ISequenceDifficultyCalculator';
import { SequenceDifficultyCalculator } from './services/implementations/SequenceDifficultyCalculator';

let instance: ISequenceDifficultyCalculator | null = null;

export function getSequenceDifficultyCalculator(): ISequenceDifficultyCalculator {
	if (!browser) throw new Error('getSequenceDifficultyCalculator() is browser-only');
	return instance ??= new SequenceDifficultyCalculator();
}
