import { browser } from '$app/environment';
import type { IFormDraftPersister } from './services/contracts/IFormDraftPersister';
import { FormDraftPersister } from './services/implementations/FormDraftPersister.svelte';

let instance: IFormDraftPersister | null = null;

export function getFormDraftPersister(): IFormDraftPersister {
	if (!browser) throw new Error('getFormDraftPersister() is browser-only');
	return instance ??= new FormDraftPersister();
}
