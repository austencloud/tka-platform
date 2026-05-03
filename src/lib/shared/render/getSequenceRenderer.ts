import { browser } from '$app/environment';
import { SequenceRenderer } from './services/implementations/SequenceRenderer';
import { getImageComposer } from './getImageComposer';
import { getImageFormatConverter } from './getImageFormatConverter';

let instance: SequenceRenderer | null = null;

export function getSequenceRenderer(): SequenceRenderer {
	if (!browser) throw new Error('getSequenceRenderer() is browser-only');
	return instance ??= new SequenceRenderer(
		getImageComposer(),
		getImageFormatConverter()
	);
}
