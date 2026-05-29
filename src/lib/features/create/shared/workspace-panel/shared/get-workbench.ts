import { browser } from '$app/environment';
import { Workbench } from './services/workbench';
import { getSequenceRepository } from '$lib/shared/create/getSequenceRepository';

let instance: Workbench | null = null;

export function getWorkbench(): Workbench {
	if (!browser) throw new Error('getWorkbench() is browser-only');
	return instance ??= new Workbench(getSequenceRepository());
}
