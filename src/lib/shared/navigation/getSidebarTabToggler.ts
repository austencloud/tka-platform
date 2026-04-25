import { browser } from '$app/environment';
import type { ISidebarTabToggler } from './services/contracts/ISidebarTabToggler';
import { SidebarTabToggler } from './services/implementations/SidebarTabToggler';

let instance: ISidebarTabToggler | null = null;

export function getSidebarTabToggler(): ISidebarTabToggler {
	if (!browser) throw new Error('getSidebarTabToggler() is browser-only');
	return instance ??= new SidebarTabToggler();
}
