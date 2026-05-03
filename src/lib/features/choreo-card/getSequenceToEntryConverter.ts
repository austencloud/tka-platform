import { browser } from '$app/environment';
import { SequenceToEntryConverter } from './services/implementations/SequenceToEntryConverter';

let instance: SequenceToEntryConverter | null = null;

export function getSequenceToEntryConverter(): SequenceToEntryConverter {
	if (!browser) throw new Error('getSequenceToEntryConverter() is browser-only');
	return instance ??= new SequenceToEntryConverter();
}
