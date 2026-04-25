import { browser } from '$app/environment';
import type { ISequenceStatsCalculator } from './services/contracts/ISequenceStatsCalculator';
import { SequenceStatsCalculator } from './services/implementations/SequenceStatsCalculator';

let instance: ISequenceStatsCalculator | null = null;

export function getSequenceStatsCalculator(): ISequenceStatsCalculator {
	if (!browser) throw new Error('getSequenceStatsCalculator() is browser-only');
	return instance ??= new SequenceStatsCalculator();
}
