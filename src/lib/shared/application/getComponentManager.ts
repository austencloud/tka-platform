import { browser } from '$app/environment';
import type { IComponentManager } from './services/contracts/IComponentManager';
import { ComponentManager } from './services/implementations/ComponentManager';

let instance: IComponentManager | null = null;

export function getComponentManager(): IComponentManager {
	if (!browser) throw new Error('getComponentManager() is browser-only');
	return instance ??= new ComponentManager();
}
