import { browser } from '$app/environment';
import type { IUndoManager } from './services/contracts/IUndoManager';
import { UndoManager } from './services/implementations/UndoManager';

let instance: IUndoManager | null = null;

export function getUndoManager(): IUndoManager {
	if (!browser) throw new Error('getUndoManager() is browser-only');
	return instance ??= new UndoManager();
}
