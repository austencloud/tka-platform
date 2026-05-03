import { browser } from '$app/environment';

import { SequenceExporter } from './services/implementations/SequenceExporter';

let instance: SequenceExporter | null = null;

export function getSequenceExporter(): SequenceExporter {
	if (!browser) throw new Error('getSequenceExporter() is browser-only');
	return instance ??= new SequenceExporter();
}
