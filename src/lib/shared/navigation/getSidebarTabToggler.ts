import { browser } from '$app/environment';
import { SidebarTabToggler } from './services/implementations/SidebarTabToggler';

let instance: SidebarTabToggler | null = null;

export function getSidebarTabToggler(): SidebarTabToggler {
	if (!browser) throw new Error('getSidebarTabToggler() is browser-only');
	return instance ??= new SidebarTabToggler();
}
