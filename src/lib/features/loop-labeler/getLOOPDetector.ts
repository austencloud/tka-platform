import { browser } from '$app/environment';
import type { ILOOPDetector } from './services/contracts/ILOOPDetector';
import { LOOPDetector } from './services/implementations/LOOPDetector';
import { getStepComparisonOrchestrator } from './getStepComparisonOrchestrator';
import { getTransformationAnalyzer } from './getTransformationAnalyzer';
import { getCandidateFormatter } from './getCandidateFormatter';
import { getPolyrhythmicDetector } from './getPolyrhythmicDetector';
import { getLayeredPathDetector } from './getLayeredPathDetector';

let instance: ILOOPDetector | null = null;

export function getLOOPDetector(): ILOOPDetector {
	if (!browser) throw new Error('getLOOPDetector() is browser-only');
	return instance ??= new LOOPDetector(
		getStepComparisonOrchestrator(),
		getTransformationAnalyzer(),
		getCandidateFormatter(),
		getPolyrhythmicDetector(),
		getLayeredPathDetector(),
	);
}
