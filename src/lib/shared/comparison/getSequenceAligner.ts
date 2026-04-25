import { browser } from '$app/environment';
import type { ISequenceAligner } from './services/contracts/ISequenceAligner';
import { SequenceAligner } from './services/implementations/SequenceAligner';
import { getStepSignatureGenerator } from './getStepSignatureGenerator';
import { getSpatialTransformDetector } from './getSpatialTransformDetector';

let instance: ISequenceAligner | null = null;

export function getSequenceAligner(): ISequenceAligner {
	if (!browser) throw new Error('getSequenceAligner() is browser-only');
	return instance ??= new SequenceAligner(getStepSignatureGenerator(), getSpatialTransformDetector());
}
