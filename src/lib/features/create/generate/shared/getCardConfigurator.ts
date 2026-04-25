import { browser } from '$app/environment';
import type { ICardConfigurator } from './services/contracts/ICardConfigurator';
import { CardConfigurator } from './services/implementations/CardConfigurator';

let instance: ICardConfigurator | null = null;

export function getCardConfigurator(): ICardConfigurator {
	if (!browser) throw new Error('getCardConfigurator() is browser-only');
	return instance ??= new CardConfigurator();
}
