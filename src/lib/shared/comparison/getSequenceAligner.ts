import { browser } from '$app/environment';

import { SequenceAligner } from './services/implementations/SequenceAligner';
import { getStepSignatureGenerator } from './getStepSignatureGenerator';
import { getSpatialTransformDetector } from './getSpatialTransformDetector';

let instance: SequenceAligner | null = null;

export function getSequenceAligner(): SequenceAligner {
	if (!browser) throw new Error('getSequenceAligner() is browser-only');
	return instance ??= new SequenceAligner(getStepSignatureGenerator(), getSpatialTransformDetector());
}
