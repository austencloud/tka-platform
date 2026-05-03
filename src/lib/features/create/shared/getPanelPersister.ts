import { browser } from '$app/environment';

import { PanelPersister } from './services/implementations/PanelPersister.svelte';

let instance: PanelPersister | null = null;

export function getPanelPersister(): PanelPersister {
	if (!browser) throw new Error('getPanelPersister() is browser-only');
	return instance ??= new PanelPersister();
}
