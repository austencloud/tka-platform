import { browser } from '$app/environment';
import type { ISequenceEncoder } from './services/contracts/ISequenceEncoder';
import { SequenceEncoder } from './services/implementations/SequenceEncoder';

let instance: ISequenceEncoder | null = null;

export function getSequenceEncoder(): ISequenceEncoder {
	if (!browser) throw new Error('getSequenceEncoder() is browser-only');
	return instance ??= new SequenceEncoder();
}
