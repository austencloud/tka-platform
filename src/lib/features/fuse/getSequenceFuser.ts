import { browser } from '$app/environment';

import { SequenceFuser } from './services/implementations/SequenceFuser';

let instance: SequenceFuser | null = null;

export function getSequenceFuser(): SequenceFuser {
	if (!browser) throw new Error('getSequenceFuser() is browser-only');
	return instance ??= new SequenceFuser();
}
