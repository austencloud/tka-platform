import { browser } from '$app/environment';

import { GapDetector } from './services/implementations/GapDetector';
import { getLetterToConceptMapper } from './getLetterToConceptMapper';
import { getQuizHistoryRecorder } from './getQuizHistoryRecorder';

let instance: GapDetector | null = null;

export function getGapDetector(): GapDetector {
	if (!browser) throw new Error('getGapDetector() is browser-only');
	return instance ??= new GapDetector(getLetterToConceptMapper(), getQuizHistoryRecorder());
}
