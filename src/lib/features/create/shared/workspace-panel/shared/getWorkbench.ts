import { browser } from '$app/environment';
import { Workbench } from './services/implementations/Workbench';
import { getSequenceRepository } from '$lib/features/create/shared/getSequenceRepository';
import { getPersistenceService } from '$lib/shared/persistence/getPersistenceService';

let instance: Workbench | null = null;

export function getWorkbench(): Workbench {
	if (!browser) throw new Error('getWorkbench() is browser-only');
	return instance ??= new Workbench(getSequenceRepository(), getPersistenceService());
}
