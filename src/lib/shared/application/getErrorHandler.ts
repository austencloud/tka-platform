import { browser } from '$app/environment';
import type { IErrorHandler } from './services/contracts/IErrorHandler';
import { ErrorHandler } from './services/implementations/ErrorHandler';

let instance: IErrorHandler | null = null;

export function getErrorHandler(): IErrorHandler {
	if (!browser) throw new Error('getErrorHandler() is browser-only');
	return instance ??= new ErrorHandler();
}
