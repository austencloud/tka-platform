import { browser } from '$app/environment';

import { SubDrawerStatePersister } from './services/implementations/SubDrawerStatePersister';

let instance: SubDrawerStatePersister | null = null;

export function getSubDrawerStatePersister(): SubDrawerStatePersister {
	if (!browser) throw new Error('getSubDrawerStatePersister() is browser-only');
	return instance ??= new SubDrawerStatePersister();
}
