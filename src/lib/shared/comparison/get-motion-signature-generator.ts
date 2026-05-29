import { browser } from '$app/environment';
import { MotionSignatureGenerator } from './services/motion-signature-generator';

let instance: MotionSignatureGenerator | null = null;

export function getMotionSignatureGenerator(): MotionSignatureGenerator {
	if (!browser) throw new Error('getMotionSignatureGenerator() is browser-only');
	return instance ??= new MotionSignatureGenerator();
}
