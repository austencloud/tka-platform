import { browser } from '$app/environment';

import { SequenceAligner } from './services/sequence-aligner';
import { getStepSignatureGenerator } from './get-step-signature-generator';
import { getSpatialTransformDetector } from './get-spatial-transform-detector';

let instance: SequenceAligner | null = null;

export function getSequenceAligner(): SequenceAligner {
	if (!browser) throw new Error('getSequenceAligner() is browser-only');
	return instance ??= new SequenceAligner(getStepSignatureGenerator(), getSpatialTransformDetector());
}
