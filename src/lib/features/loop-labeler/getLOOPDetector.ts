import { browser } from '$app/environment';
import type { ILOOPDetector } from '$lib/shared/create/services/ILOOPDetector';
import { LOOPDetector } from './services/implementations/LOOPDetector';
import { getStepComparisonOrchestrator } from './getStepComparisonOrchestrator';
import { getTransformationAnalyzer } from './getTransformationAnalyzer';
import * as polyrhythmicDetectorModule from './services/polyrhythmic-detector';
import * as layeredPathDetectorModule from './services/layered-path-detector';

let instance: ILOOPDetector | null = null;

export function getLOOPDetector(): ILOOPDetector {
	if (!browser) throw new Error('getLOOPDetector() is browser-only');
	return instance ??= new LOOPDetector(
		getStepComparisonOrchestrator(),
		getTransformationAnalyzer(),
		polyrhythmicDetectorModule,
		layeredPathDetectorModule,
	);
}
