import { browser } from '$app/environment';
import type { ISequenceJsonExporter } from './services/contracts/ISequenceJsonExporter';
import { SequenceJsonExporter } from './services/implementations/SequenceJsonExporter';

let instance: ISequenceJsonExporter | null = null;

export function getSequenceJsonExporter(): ISequenceJsonExporter {
	if (!browser) throw new Error('getSequenceJsonExporter() is browser-only');
	return instance ??= new SequenceJsonExporter();
}
