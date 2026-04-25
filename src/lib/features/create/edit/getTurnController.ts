import { browser } from '$app/environment';
import { TurnController, type ITurnController } from './services/TurnController';

let instance: ITurnController | null = null;

export function getTurnController(): ITurnController {
	if (!browser) throw new Error('getTurnController() is browser-only');
	return instance ??= new TurnController();
}
