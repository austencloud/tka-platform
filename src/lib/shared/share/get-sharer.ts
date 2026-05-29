import { browser } from '$app/environment';
import { Sharer } from './services/sharer';
import { getSequenceRenderer } from '$lib/shared/render/get-sequence-renderer';

let instance: Sharer | null = null;

export function getSharer(): Sharer {
	if (!browser) throw new Error('getSharer() is browser-only');
	return instance ??= new Sharer(getSequenceRenderer());
}
