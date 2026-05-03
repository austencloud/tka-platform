import { browser } from '$app/environment';

import { ErrorHandler } from './services/implementations/ErrorHandler';

let instance: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
	if (!browser) throw new Error('getErrorHandler() is browser-only');
	return instance ??= new ErrorHandler();
}
