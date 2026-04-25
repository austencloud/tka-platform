import { browser } from '$app/environment';
import type { ISheetRouter } from './services/contracts/ISheetRouter';
import { SheetRouter } from './services/implementations/SheetRouter';

let instance: ISheetRouter | null = null;

export function getSheetRouter(): ISheetRouter {
	if (!browser) throw new Error('getSheetRouter() is browser-only');
	return instance ??= new SheetRouter();
}
