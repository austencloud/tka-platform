import { browser } from '$app/environment';
import { ComponentManager } from './services/implementations/ComponentManager';

let instance: ComponentManager | null = null;

export function getComponentManager(): ComponentManager {
	if (!browser) throw new Error('getComponentManager() is browser-only');
	return instance ??= new ComponentManager();
}
