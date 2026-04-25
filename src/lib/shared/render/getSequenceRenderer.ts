import { browser } from '$app/environment';
import type { ISequenceRenderer } from './services/contracts/ISequenceRenderer';
import { SequenceRenderer } from './services/implementations/SequenceRenderer';
import { getImageComposer } from './getImageComposer';
import { getImageFormatConverter } from './getImageFormatConverter';

let instance: ISequenceRenderer | null = null;

export function getSequenceRenderer(): ISequenceRenderer {
	if (!browser) throw new Error('getSequenceRenderer() is browser-only');
	return instance ??= new SequenceRenderer(
		getImageComposer(),
		getImageFormatConverter()
	);
}
