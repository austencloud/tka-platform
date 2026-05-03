import { browser } from '$app/environment';
import { SequenceDifficultyCalculator } from './services/implementations/SequenceDifficultyCalculator';

let instance: SequenceDifficultyCalculator | null = null;

export function getSequenceDifficultyCalculator(): SequenceDifficultyCalculator {
	if (!browser) throw new Error('getSequenceDifficultyCalculator() is browser-only');
	return instance ??= new SequenceDifficultyCalculator();
}
