import { browser } from '$app/environment';

import { SequenceJsonExporter } from './services/implementations/SequenceJsonExporter';

let instance: SequenceJsonExporter | null = null;

export function getSequenceJsonExporter(): SequenceJsonExporter {
	if (!browser) throw new Error('getSequenceJsonExporter() is browser-only');
	return instance ??= new SequenceJsonExporter();
}
