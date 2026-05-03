import { browser } from '$app/environment';
import { Sharer } from './services/implementations/Sharer';
import { getSequenceRenderer } from '$lib/shared/render/getSequenceRenderer';

let instance: Sharer | null = null;

export function getSharer(): Sharer {
	if (!browser) throw new Error('getSharer() is browser-only');
	return instance ??= new Sharer(getSequenceRenderer());
}
