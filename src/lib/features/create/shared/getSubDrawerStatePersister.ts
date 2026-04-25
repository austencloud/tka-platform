import { browser } from '$app/environment';
import type { ISubDrawerStatePersister } from './services/contracts/ISubDrawerStatePersister';
import { SubDrawerStatePersister } from './services/implementations/SubDrawerStatePersister';

let instance: ISubDrawerStatePersister | null = null;

export function getSubDrawerStatePersister(): ISubDrawerStatePersister {
	if (!browser) throw new Error('getSubDrawerStatePersister() is browser-only');
	return instance ??= new SubDrawerStatePersister();
}
