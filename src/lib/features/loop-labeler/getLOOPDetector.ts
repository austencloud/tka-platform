import { browser } from '$app/environment';
import type { ILOOPDetector } from './services/ILOOPDetector';
import { LOOPDetector } from './services/LOOPDetector';
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
