import { browser } from '$app/environment';
import type { ISequenceFuser } from './services/contracts/ISequenceFuser';
import { SequenceFuser } from './services/implementations/SequenceFuser';

let instance: ISequenceFuser | null = null;

export function getSequenceFuser(): ISequenceFuser {
	if (!browser) throw new Error('getSequenceFuser() is browser-only');
	return instance ??= new SequenceFuser();
}
