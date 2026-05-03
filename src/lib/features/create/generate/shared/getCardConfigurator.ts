import { browser } from '$app/environment';

import { CardConfigurator } from './services/implementations/CardConfigurator';

let instance: CardConfigurator | null = null;

export function getCardConfigurator(): CardConfigurator {
	if (!browser) throw new Error('getCardConfigurator() is browser-only');
	return instance ??= new CardConfigurator();
}
