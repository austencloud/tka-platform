import { browser } from '$app/environment';
import type { ISharer } from './services/contracts/ISharer';
import { Sharer } from './services/implementations/Sharer';
import { getSequenceRenderer } from '$lib/shared/render/getSequenceRenderer';

let instance: ISharer | null = null;

export function getSharer(): ISharer {
	if (!browser) throw new Error('getSharer() is browser-only');
	return instance ??= new Sharer(getSequenceRenderer());
}
