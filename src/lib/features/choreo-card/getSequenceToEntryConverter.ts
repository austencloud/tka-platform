import { browser } from '$app/environment';
import type { ISequenceToEntryConverter } from './services/contracts/ISequenceToEntryConverter';
import { SequenceToEntryConverter } from './services/implementations/SequenceToEntryConverter';

let instance: ISequenceToEntryConverter | null = null;

export function getSequenceToEntryConverter(): ISequenceToEntryConverter {
	if (!browser) throw new Error('getSequenceToEntryConverter() is browser-only');
	return instance ??= new SequenceToEntryConverter();
}
