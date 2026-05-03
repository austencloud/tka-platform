import { browser } from '$app/environment';
import { SheetRouter } from './services/implementations/SheetRouter';

let instance: SheetRouter | null = null;

export function getSheetRouter(): SheetRouter {
	if (!browser) throw new Error('getSheetRouter() is browser-only');
	return instance ??= new SheetRouter();
}
