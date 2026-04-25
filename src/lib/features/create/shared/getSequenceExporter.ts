import { browser } from '$app/environment';
import type { ISequenceExporter } from './services/contracts/ISequenceExporter';
import { SequenceExporter } from './services/implementations/SequenceExporter';

let instance: ISequenceExporter | null = null;

export function getSequenceExporter(): ISequenceExporter {
	if (!browser) throw new Error('getSequenceExporter() is browser-only');
	return instance ??= new SequenceExporter();
}
