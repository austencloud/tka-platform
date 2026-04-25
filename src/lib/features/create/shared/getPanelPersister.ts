import { browser } from '$app/environment';
import type { IPanelPersister } from './services/contracts/IPanelPersister';
import { PanelPersister } from './services/implementations/PanelPersister.svelte';

let instance: IPanelPersister | null = null;

export function getPanelPersister(): IPanelPersister {
	if (!browser) throw new Error('getPanelPersister() is browser-only');
	return instance ??= new PanelPersister();
}
