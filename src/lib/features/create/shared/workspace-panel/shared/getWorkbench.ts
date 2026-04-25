import { browser } from '$app/environment';
import type { IWorkbench } from './services/contracts/IWorkbench';
import { Workbench } from './services/implementations/Workbench';
import { getSequenceRepository } from '$lib/features/create/shared/getSequenceRepository';
import { getPersistenceService } from '$lib/shared/persistence/getPersistenceService';

let instance: IWorkbench | null = null;

export function getWorkbench(): IWorkbench {
	if (!browser) throw new Error('getWorkbench() is browser-only');
	return instance ??= new Workbench(getSequenceRepository(), getPersistenceService());
}
