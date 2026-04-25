import { browser } from '$app/environment';
import type { IGapDetector } from './services/contracts/IGapDetector';
import { GapDetector } from './services/implementations/GapDetector';
import { getLetterToConceptMapper } from './getLetterToConceptMapper';
import { getQuizHistoryRecorder } from './getQuizHistoryRecorder';

let instance: IGapDetector | null = null;

export function getGapDetector(): IGapDetector {
	if (!browser) throw new Error('getGapDetector() is browser-only');
	return instance ??= new GapDetector(getLetterToConceptMapper(), getQuizHistoryRecorder());
}
