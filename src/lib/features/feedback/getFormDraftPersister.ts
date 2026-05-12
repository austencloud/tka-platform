import { browser } from '$app/environment';

import { FormDraftPersister } from './services/FormDraftPersister.svelte';

let instance: FormDraftPersister | null = null;

export function getFormDraftPersister(): FormDraftPersister {
	if (!browser) throw new Error('getFormDraftPersister() is browser-only');
	return instance ??= new FormDraftPersister();
}
