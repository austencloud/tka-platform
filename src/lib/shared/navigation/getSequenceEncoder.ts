import { browser } from '$app/environment';
import { SequenceEncoder } from './services/implementations/SequenceEncoder';

let instance: SequenceEncoder | null = null;

export function getSequenceEncoder(): SequenceEncoder {
	if (!browser) throw new Error('getSequenceEncoder() is browser-only');
	return instance ??= new SequenceEncoder();
}
