import { browser } from '$app/environment';
import type { ICodexPictographUpdater } from './services/contracts/ICodexPictographUpdater';
import { CodexPictographUpdater } from './services/implementations/CodexPictographUpdater';

let instance: ICodexPictographUpdater | null = null;

export function getCodexPictographUpdater(): ICodexPictographUpdater {
	if (!browser) throw new Error('getCodexPictographUpdater() is browser-only');
	return instance ??= new CodexPictographUpdater();
}
