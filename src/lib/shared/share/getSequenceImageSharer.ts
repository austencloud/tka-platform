import { browser } from '$app/environment';
import type { ISequenceImageSharer } from './services/contracts/ISequenceImageSharer';
import { SequenceImageSharer } from './services/implementations/SequenceImageSharer';
import { getSequenceRenderer } from '$lib/shared/render/getSequenceRenderer';

let instance: ISequenceImageSharer | null = null;

export function getSequenceImageSharer(): ISequenceImageSharer {
	if (!browser) throw new Error('getSequenceImageSharer() is browser-only');
	return instance ??= new SequenceImageSharer(getSequenceRenderer());
}
