import { browser } from '$app/environment';
import { SequenceStatsCalculator } from './services/implementations/SequenceStatsCalculator';

let instance: SequenceStatsCalculator | null = null;

export function getSequenceStatsCalculator(): SequenceStatsCalculator {
	if (!browser) throw new Error('getSequenceStatsCalculator() is browser-only');
	return instance ??= new SequenceStatsCalculator();
}
